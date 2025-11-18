/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'node:fs';
import { register } from 'node:module';
import { readTextFile, writeTextFile } from '@tauri-apps/api/fs';
import { product, pkg } from './bootstrap-meta.js';
import './bootstrap-node.js';
import * as performance from './vs/base/common/performance.js';
import { INLSConfiguration } from './vs/nls.js';
import { createModuleLogger } from './vs/base/common/logger.js';

// Install a hook to module resolution to map 'fs' to 'original-fs' for Tauri compatibility
// 'original-fs' mapping is maintained for compatibility with VS Code's file system abstractions but is now used with Tauri's plugin-fs.
// Check for Tauri runtime (via __TAURI__ global) or Node.js mode
if (process.env['TAURI_RUN_AS_NODE'] || (typeof globalThis !== 'undefined' && '__TAURI__' in globalThis)) {
	const jsCode = `
	export async function resolve(specifier, context, nextResolve) {
		if (specifier === 'fs') {
			return {
				format: 'builtin',
				shortCircuit: true,
				url: 'node:original-fs'
			};
		}

		// Defer to the next hook in the chain, which would be the
		// Node.js default resolve if this is the last user-specified loader.
		return nextResolve(specifier, context);
	}`;
	register(`data:text/javascript;base64,${Buffer.from(jsCode).toString('base64')}`, import.meta.url);
}

// Prepare globals that are needed for running
globalThis._MINTMIND_PRODUCT_JSON = { ...product };
globalThis._MINTMIND_PACKAGE_JSON = { ...pkg };
globalThis._MINTMIND_FILE_ROOT = import.meta.dirname;

//#region NLS helpers

const logger = createModuleLogger('bootstrap-esm');

let setupNLSResult: Promise<INLSConfiguration | undefined> | undefined = undefined;

function setupNLS(): Promise<INLSConfiguration | undefined> {
	if (!setupNLSResult) {
		setupNLSResult = doSetupNLS();
	}

	return setupNLSResult;
}

async function doSetupNLS(): Promise<INLSConfiguration | undefined> {
	performance.mark('code/willLoadNls');

	let nlsConfig: INLSConfiguration | undefined = undefined;

	let messagesFile: string | undefined;
	if (process.env['MINTMIND_NLS_CONFIG']) {
		try {
			nlsConfig = JSON.parse(process.env['MINTMIND_NLS_CONFIG']);
			if (nlsConfig?.languagePack?.messagesFile) {
				messagesFile = nlsConfig.languagePack.messagesFile;
			} else if (nlsConfig?.defaultMessagesFile) {
				messagesFile = nlsConfig.defaultMessagesFile;
			}

			globalThis._MINTMIND_NLS_LANGUAGE = nlsConfig?.resolvedLanguage;
		} catch (e) {
			logger.error(`Error reading MINTMIND_NLS_CONFIG from environment`, e);
		}
	}

	if (
		process.env['MINTMIND_DEV'] ||	// no NLS support in dev mode
		!messagesFile					// no NLS messages file
	) {
		return undefined;
	}

	try {
		// Use Tauri fs operations when in Tauri environment, fallback to Node.js fs
		const isTauri = typeof window !== 'undefined' && window.__TAURI__;
		let messagesContent: string;

		if (isTauri) {
			messagesContent = await readTextFile(messagesFile);
		} else {
			messagesContent = (await fs.promises.readFile(messagesFile)).toString();
		}

		globalThis._MINTMIND_NLS_MESSAGES = JSON.parse(messagesContent);
	} catch (error) {
		logger.error(`Error reading NLS messages file ${messagesFile}`, error);

		// Mark as corrupt: this will re-create the language pack cache next startup
		if (nlsConfig?.languagePack?.corruptMarkerFile) {
			try {
				// Use Tauri fs operations when in Tauri environment, fallback to Node.js fs
				const isTauri = typeof window !== 'undefined' && window.__TAURI__;
				if (isTauri) {
					await writeTextFile(nlsConfig.languagePack.corruptMarkerFile, 'corrupted');
				} else {
					await fs.promises.writeFile(nlsConfig.languagePack.corruptMarkerFile, 'corrupted');
				}
			} catch (error) {
				logger.error(`Error writing corrupted NLS marker file`, error);
			}
		}

		// Fallback to the default message file to ensure english translation at least
		if (nlsConfig?.defaultMessagesFile && nlsConfig.defaultMessagesFile !== messagesFile) {
			try {
				// Use Tauri fs operations when in Tauri environment, fallback to Node.js fs
				const isTauri = typeof window !== 'undefined' && window.__TAURI__;
				let defaultMessagesContent: string;

				if (isTauri) {
					defaultMessagesContent = await readTextFile(nlsConfig.defaultMessagesFile);
				} else {
					defaultMessagesContent = (await fs.promises.readFile(nlsConfig.defaultMessagesFile)).toString();
				}

				globalThis._MINTMIND_NLS_MESSAGES = JSON.parse(defaultMessagesContent);
			} catch (error) {
				logger.error(`Error reading default NLS messages file ${nlsConfig.defaultMessagesFile}`, error);
			}
		}
	}

	performance.mark('code/didLoadNls');

	return nlsConfig;
}

//#endregion

export async function bootstrapESM(): Promise<void> {

	// NLS
	await setupNLS();
}
