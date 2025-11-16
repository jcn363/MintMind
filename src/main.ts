/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { invoke } from '@tauri-apps/api/tauri';
import { appConfigDir } from '@tauri-apps/api/path';
import { readTextFile } from '@tauri-apps/api/fs';
import { product } from './bootstrap-meta.js';
import { bootstrapESM } from './bootstrap-esm.js';
import { parse } from './vs/base/common/jsonc.js';
import { performance } from 'node:perf_hooks';
import * as os from 'node:os';
import * as path from 'node:path';

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

	process.env['VSCODE_NLS_CONFIG'] = JSON.stringify(nlsConfig);
	process.env['VSCODE_CODE_CACHE_PATH'] = path.join(userDataPath, 'CachedData', product.commit || 'dev');

	// Load main application
	await import('./vs/code/tauri-main/main.js');
}

// Start the application
initializeTauriApp().catch(console.error);