/* ---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Workbench web main entry point for ESM modules.
 * This file is the main entry point for the web version of the workbench.
 */

// Re-export all public APIs from the workbench web module
export * from './browser/web.factory.js';

// Set up global configuration if not already set
if (!globalThis._MINTMIND_FILE_ROOT) {
	const baseUrl = new URL('.', import.meta.url).href;
	globalThis._MINTMIND_FILE_ROOT = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
}

// Initialize the application when loaded in a browser context
if (typeof document !== 'undefined') {
	const init = async () => {
		try {
			// Import the workbench module
			const { initializeWorkbench } = await import('./browser/workbench.js');

			// Initialize the workbench with default options
			const workbench = await initializeWorkbench(document.body, {
				extraClasses: [],
				resetLayout: false
			});

			// Return the workbench instance for further use if needed
			return workbench;
		} catch (error) {
			console.error('Failed to initialize workbench:', error);
			throw error;
		}
	};

	// Initialize when the DOM is ready
	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', () => init().catch(console.error));
	} else {
		init().catch(console.error);
	}
}
