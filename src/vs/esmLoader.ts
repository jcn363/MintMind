/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AppResourcePath, FileAccess } from './base/common/network.js';
import { URI } from './base/common/uri.js';

const moduleCache = new Map<string, Promise<unknown>>();

/**
 * Import an ESM module in a standardized way across the application.
 * This replaces the previous AMD-style module loading with native ESM.
 *
 * @param modulePath - The path to the module to import
 * @returns Promise that resolves to the imported module
 */
export async function importESModule<T>(modulePath: string): Promise<T> {
	// Use the cache if available
	if (moduleCache.has(modulePath)) {
		return moduleCache.get(modulePath) as Promise<T>;
	}

	try {
		// Use dynamic import to load the module
		const modulePromise = import(modulePath);

		// Cache the promise to prevent duplicate imports
		moduleCache.set(modulePath, modulePromise);

		return modulePromise as Promise<T>;
	} catch (error) {
		console.error(`Failed to import module: ${modulePath}`, error);
		throw error;
	}
}

/**
 * Resolve a module path to its full URL in a web context
 * @param basePath - The base path to resolve from
 * @param modulePath - The module path to resolve
 * @returns The resolved module URL
 */
export function resolveModuleUrl(basePath: string, modulePath: string): string {
	try {
		// Handle absolute URLs
		if (modulePath.startsWith('http://') || modulePath.startsWith('https://')) {
			return modulePath;
		}

		// Handle root-relative paths
		if (modulePath.startsWith('/')) {
			const url = new URL(window.location.origin);
			url.pathname = modulePath;
			return url.toString();
		}

		// Handle relative paths
		const baseUrl = new URL(basePath, window.location.href);
		return new URL(modulePath, baseUrl).toString();
	} catch (error) {
		console.error(`Failed to resolve module URL: ${modulePath}`, error);
		throw error;
	}
}

/**
 * Get a resource URI for a given path
 * @param resource - The resource path
 * @returns The resource URI
 */
export function getResourceUri(resource: AppResourcePath): URI {
	return URI.parse(FileAccess.asBrowserUri(resource).toString(true));
}

/**
 * Load a module with error handling and retry logic
 * @param modulePath - The path to the module to load
 * @param maxRetries - Maximum number of retry attempts
 * @returns Promise that resolves to the loaded module
 */
export async function loadModule<T>(
	modulePath: string,
	maxRetries = 3
): Promise<T> {
	let lastError: Error | null = null;

	for (let attempt = 0; attempt < maxRetries; attempt++) {
		try {
			return await importESModule<T>(modulePath);
		} catch (error) {
			lastError = error as Error;
			console.warn(`Attempt ${attempt + 1} failed to load module: ${modulePath}`, error);

			// Exponential backoff before retry
			if (attempt < maxRetries - 1) {
				await new Promise(resolve => setTimeout(resolve, 100 * Math.pow(2, attempt)));
			}
		}
	}

	throw new Error(`Failed to load module after ${maxRetries} attempts: ${lastError?.message}`);
}

// Export the public API
export default {
	importESModule,
	resolveModuleUrl,
	getResourceUri,
	loadModule
};
