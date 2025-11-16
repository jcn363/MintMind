/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
//@ts-check
/// <reference lib="webworker" />

/** @type {ServiceWorkerGlobalScope} */
const sw = /** @type {any} */ (self);

const VERSION = 4;

const resourceCacheName = `vscode-resource-cache-${VERSION}`;
const aggressiveCacheName = `vscode-aggressive-cache-${VERSION}`;
const predictiveCacheName = `vscode-predictive-cache-${VERSION}`;

const rootPath = sw.location.pathname.replace(/\/service-worker.js$/, '');

const searchParams = new URL(location.toString()).searchParams;

const remoteAuthority = searchParams.get('remoteAuthority');

/** @type {MessagePort|undefined} */
let outerIframeMessagePort;

/**
 * Origin used for resources
 */
const resourceBaseAuthority = searchParams.get('vscode-resource-base-authority');

/**
 * Configuración de caching agresivo
 */
const CACHE_CONFIG = {
  // Recursos críticos que se cachean agresivamente
  criticalResources: [
    'vs/workbench/workbench.desktop.main.js',
    'vs/workbench/workbench.common.main.js',
    'vs/editor/editor.main.js',
    'vs/workbench/browser/workbench.js'
  ],

  // Patrones de chunks lazy que se pre-cachean
  lazyChunkPatterns: [
    /^vs\/workbench\/contrib\/.*\.js$/,
    /^vs\/editor\/standalone\/.*\.js$/,
    /^vs\/platform\/.*\.js$/
  ],

  // Recursos que se cachean predictivamente
  predictiveResources: [
    'vs/workbench/contrib/chat/browser/chat.contribution.js',
    'vs/workbench/contrib/debug/browser/debug.contribution.js',
    'vs/workbench/contrib/extensions/browser/extensions.contribution.js'
  ],

  // Duración del cache agresivo
  aggressiveCacheDuration: 24 * 60 * 60 * 1000, // 24 horas

  // Umbral de frecuencia para chunks populares
  popularChunkThreshold: 5
};

/**
 * Mapa de frecuencia de acceso para chunks
 */
const chunkAccessFrequency = new Map();

/**
 * @param {string} name
 * @param {Record<string, string>} [options]
 */
const perfMark = (name, options = {}) => {
	performance.mark(`webview/service-worker/${name}`, {
		detail: {
			...options
		}
	});
}

perfMark('scriptStart');

/** @type {number} */
const resolveTimeout = 30_000;

/**
 * @template T
 * @typedef {{ status: 'ok', value: T } | { status: 'timeout' }} RequestStoreResult
 */

/**
 * @template T
 * @typedef {{ resolve: (x: RequestStoreResult<T>) => void, promise: Promise<RequestStoreResult<T>> }} RequestStoreEntry
 */

/**
 * @template T
 */
class RequestStore {
	constructor() {
		/** @type {Map<number, RequestStoreEntry<T>>} */
		this.map = new Map();
		/** @type {number} */
		this.requestPool = 0;
	}

	/**
	 * @returns {{ requestId: number, promise: Promise<RequestStoreResult<T>> }}
	 */
	create() {
		const requestId = ++this.requestPool;

		/** @type {(x: RequestStoreResult<T>) => void} */
		let resolve;
		const promise = new Promise(r => resolve = r);

		/** @type {RequestStoreEntry<T>} */
		const entry = { resolve, promise };
		this.map.set(requestId, entry);

		const dispose = () => {
			clearTimeout(timeout);
			const existingEntry = this.map.get(requestId);
			if (existingEntry === entry) {
				existingEntry.resolve({ status: 'timeout' });
				this.map.delete(requestId);
			}
		};
		const timeout = setTimeout(dispose, resolveTimeout);
		return { requestId, promise };
	}

	/**
	 * @param {number} requestId
	 * @param {T} result
	 * @returns {boolean}
	 */
	resolve(requestId, result) {
		const entry = this.map.get(requestId);
		if (!entry) {
			return false;
		}
		entry.resolve({ status: 'ok', value: result });
		this.map.delete(requestId);
		return true;
	}
}

/**
 * Map of requested paths to responses.
 */
/** @type {RequestStore<ResourceResponse>} */
const resourceRequestStore = new RequestStore();

/**
 * Map of requested localhost origins to optional redirects.
 */
/** @type {RequestStore<string|undefined>} */
const localhostRequestStore = new RequestStore();

const unauthorized = () =>
	new Response('Unauthorized', { status: 401, });

const notFound = () =>
	new Response('Not Found', { status: 404, });

const methodNotAllowed = () =>
	new Response('Method Not Allowed', { status: 405, });

const requestTimeout = () =>
	new Response('Request Timeout', { status: 408, });

/**
 * Función de caching agresivo para chunks frecuentes
 * @param {Request} request
 * @param {Response} response
 */
async function aggressiveCache(request, response) {
  const url = new URL(request.url);
  const pathname = url.pathname;

  // Verificar si es un chunk lazy frecuente
  const isFrequentLazyChunk = CACHE_CONFIG.lazyChunkPatterns.some(pattern =>
    pattern.test(pathname)
  );

  if (isFrequentLazyChunk) {
    const frequency = chunkAccessFrequency.get(pathname) || 0;
    chunkAccessFrequency.set(pathname, frequency + 1);

    if (frequency >= CACHE_CONFIG.popularChunkThreshold) {
      const cache = await caches.open(aggressiveCacheName);
      // Cache agresivo con expiración
      const responseClone = response.clone();
      responseClone.headers.set('sw-cache-time', Date.now().toString());
      responseClone.headers.set('sw-cache-type', 'aggressive');
      await cache.put(request, responseClone);
    }
  }

  // Cache predictivo para recursos críticos
  if (CACHE_CONFIG.criticalResources.includes(pathname)) {
    const cache = await caches.open(predictiveCacheName);
    const responseClone = response.clone();
    responseClone.headers.set('sw-cache-type', 'predictive');
    await cache.put(request, responseClone);

    // Precargar recursos predictivos asociados
    preloadPredictiveResources();
  }
}

/**
 * Función de precarga predictiva
 */
async function preloadPredictiveResources() {
  const cache = await caches.open(predictiveCacheName);

  for (const resource of CACHE_CONFIG.predictiveResources) {
    const resourceUrl = `${sw.origin}${rootPath}/${resource}`;
    try {
      const response = await fetch(resourceUrl);
      if (response.ok) {
        const responseClone = response.clone();
        responseClone.headers.set('sw-cache-type', 'predictive-preload');
        await cache.put(resourceUrl, responseClone);
      }
    } catch (error) {
      // Ignorar errores de precarga
    }
  }
}

/**
 * Función de limpieza de cache expirado
 */
async function cleanupExpiredCache() {
  const now = Date.now();
  const cacheNames = [resourceCacheName, aggressiveCacheName, predictiveCacheName];

  for (const cacheName of cacheNames) {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();

    for (const request of keys) {
      const response = await cache.match(request);
      if (response) {
        const cacheTime = parseInt(response.headers.get('sw-cache-time') || '0');
        if (now - cacheTime > CACHE_CONFIG.aggressiveCacheDuration) {
          await cache.delete(request);
        }
      }
    }
  }
}

sw.addEventListener('message', async (event) => {
	if (!event.source) {
		return;
	}

	/** @type {Client} */
	const source = event.source;
	switch (event.data.channel) {
		case 'version': {
			perfMark('version/request');
			outerIframeMessagePort = event.ports[0];
			sw.clients.get(source.id).then(client => {
				perfMark('version/reply');
				if (client) {
					client.postMessage({
						channel: 'version',
						version: VERSION
					});
				}
			});
			return;
		}
		case 'did-load-resource': {
			/** @type {ResourceResponse} */
			const response = event.data.data;
			if (!resourceRequestStore.resolve(response.id, response)) {
				console.log('Could not resolve unknown resource', response.path);
			}
			return;
		}
		case 'did-load-localhost': {
			const data = event.data.data;
			if (!localhostRequestStore.resolve(data.id, data.location)) {
				console.log('Could not resolve unknown localhost', data.origin);
			}
			return;
		}
		default: {
			console.log('Unknown message');
			return;
		}
	}
});

sw.addEventListener('fetch', (event) => {
	const requestUrl = new URL(event.request.url);

	// Intentar servir desde cache agresivo primero
	if (event.request.method === 'GET') {
		event.respondWith(
			serveFromAggressiveCache(event.request).catch(() =>
				processOriginalRequest(event)
			)
		);
		return;
	}

	// Procesar request original
	event.respondWith(processOriginalRequest(event));
});

/**
 * Servir desde cache agresivo con lógica inteligente
 * @param {Request} request
 * @returns {Promise<Response>}
 */
async function serveFromAggressiveCache(request) {
  const url = new URL(request.url);
  const pathname = url.pathname;

  // Verificar cache agresivo
  const aggressiveCache = await caches.open(aggressiveCacheName);
  const cachedResponse = await aggressiveCache.match(request);

  if (cachedResponse) {
    // Verificar si no está expirado
    const cacheTime = parseInt(cachedResponse.headers.get('sw-cache-time') || '0');
    if (Date.now() - cacheTime < CACHE_CONFIG.aggressiveCacheDuration) {
      perfMark('cache-hit-aggressive', { url: pathname });
      return cachedResponse;
    } else {
      // Cache expirado, eliminar
      await aggressiveCache.delete(request);
    }
  }

  // Verificar cache predictivo
  const predictiveCache = await caches.open(predictiveCacheName);
  const predictiveResponse = await predictiveCache.match(request);

  if (predictiveResponse) {
    perfMark('cache-hit-predictive', { url: pathname });
    return predictiveResponse;
  }

  // No hay cache, lanzar error para fallback
  throw new Error('No cache available');
}

/**
 * Procesar request original con caching mejorado
 * @param {FetchEvent} event
 * @returns {Promise<Response>}
 */
async function processOriginalRequest(event) {
	const requestUrl = new URL(event.request.url);

	if (typeof resourceBaseAuthority === 'string' && requestUrl.protocol === 'https:' && requestUrl.hostname.endsWith('.' + resourceBaseAuthority)) {
		switch (event.request.method) {
			case 'GET':
			case 'HEAD': {
				const firstHostSegment = requestUrl.hostname.slice(0, requestUrl.hostname.length - (resourceBaseAuthority.length + 1));
				const scheme = firstHostSegment.split('+', 1)[0];
				const authority = firstHostSegment.slice(scheme.length + 1); // may be empty
				return processResourceRequest(event, {
					scheme,
					authority,
					path: requestUrl.pathname,
					query: requestUrl.search.replace(/^\?/, ''),
				});
			}
			default: {
				return methodNotAllowed();
			}
		}
	}

	// If we're making a request against the remote authority, we want to go
	// through VS Code itself so that we are authenticated properly.  If the
	// service worker is hosted on the same origin we will have cookies and
	// authentication will not be an issue.
	if (requestUrl.origin !== sw.origin && requestUrl.host === remoteAuthority) {
		switch (event.request.method) {
			case 'GET':
			case 'HEAD': {
				return processResourceRequest(event, {
					path: requestUrl.pathname,
					scheme: requestUrl.protocol.slice(0, requestUrl.protocol.length - 1),
					authority: requestUrl.host,
					query: requestUrl.search.replace(/^\?/, ''),
				});
			}
			default: {
				return methodNotAllowed();
			}
		}
	}

	// See if it's a localhost request
	if (requestUrl.origin !== sw.origin && requestUrl.host.match(/^(localhost|127.0.0.1|0.0.0.0):(\d+)$/)) {
		return processLocalhostRequest(event, requestUrl);
	}

	// Default fetch for other requests
	return fetch(event.request);
}

sw.addEventListener('install', (event) => {
	event.waitUntil(
		sw.skipWaiting().then(() => {
			// Limpiar caches antiguos al instalar
			return cleanupExpiredCache();
		})
	);
});

sw.addEventListener('activate', (event) => {
	event.waitUntil(
		sw.clients.claim().then(() => {
			// Limpiar caches expirados periódicamente
			setInterval(cleanupExpiredCache, 60 * 60 * 1000); // Cada hora
		})
	);
});

// Resto del código existente...