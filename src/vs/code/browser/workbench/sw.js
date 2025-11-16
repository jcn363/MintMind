/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
const CACHE_NAME = 'mintmind-v1';
const OFFLINE_URL = 'offline.html';

// Recursos críticos para cachear
const CRITICAL_RESOURCES = [
  '/',
  '/favicon.ico',
  '/manifest.json',
  '/out/vs/workbench/workbench.css',
  '/resources/server/code-192.png',
  '/resources/server/favicon.ico'
];

// Instalación del Service Worker
self.addEventListener('install', (event) => {
  console.log('Service Worker: Instalando...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Cacheando recursos críticos...');
        return cache.addAll(CRITICAL_RESOURCES);
      })
      .catch((error) => {
        console.error('Service Worker: Error durante la instalación:', error);
      })
  );
  self.skipWaiting();
});

// Activación del Service Worker
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activando...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Service Worker: Eliminando cache antiguo:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Interceptar peticiones
self.addEventListener('fetch', (event) => {
  // Solo interceptar peticiones GET
  if (event.request.method !== 'GET') {
    return;
  }

  // Para recursos de la aplicación, intentar cache primero
  if (event.request.url.includes('/out/') ||
      event.request.url.includes('/resources/') ||
      event.request.url.includes('/favicon.ico') ||
      event.request.url.includes('/manifest.json')) {

    event.respondWith(
      caches.match(event.request)
        .then((response) => {
          if (response) {
            return response;
          }

          return fetch(event.request)
            .then((response) => {
              // Cachear recursos exitosos
              if (response.status === 200 && response.type === 'basic') {
                const responseToCache = response.clone();
                caches.open(CACHE_NAME)
                  .then((cache) => {
                    cache.put(event.request, responseToCache);
                  });
              }
              return response;
            })
            .catch(() => {
              // Si falla la red y es un recurso crítico, devolver página offline básica
              if (event.request.destination === 'document') {
                return caches.match(OFFLINE_URL);
              }
            });
        })
    );
  }
});

// Manejar mensajes desde el cliente
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});