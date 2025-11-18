/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { appConfigDir } from '@tauri-apps/api/path';
import * as path from 'node:path';
import { bootstrapESM } from './bootstrap-esm.js';
import { product } from './bootstrap-meta.js';

// Bootstrap ESM
await bootstrapESM();

// Initialize Tauri app configuration
async function initializeTauriApp() {
	// Set up user data directory
	const userDataPath = await appConfigDir();

	// Configure NLS
	const nlsConfig = {
		userLocale: 'en',
		osLocale: 'en',
		resolvedLanguage: 'en',
		defaultMessagesFile: path.join(import.meta.dirname, 'nls.messages.json'),
		locale: 'en',
		availableLanguages: {}
	};

	process.env['MINTMIND_NLS_CONFIG'] = JSON.stringify(nlsConfig);
	process.env['MINTMIND_CODE_CACHE_PATH'] = path.join(userDataPath, 'CachedData', product.commit || 'dev');

	// Load main application
	await import('./vs/code/tauri-main/main.js');
}

// Start the application
initializeTauriApp().catch(console.error);
