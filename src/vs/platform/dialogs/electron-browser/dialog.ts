/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { fromNow } from '../../../base/common/date.js';
import { isLinuxSnap } from '../../../base/common/platform.js';
import { localize } from '../../../nls.js';
import { IOSProperties } from '../../native/common/native.js';
import { IProductService } from '../../product/common/productService.js';
import { process } from '../../../base/parts/sandbox/electron-browser/globals.js';

export async function createNativeAboutDialogDetails(productService: IProductService, osProps: IOSProperties): Promise<{ title: string; details: string; detailsToCopy: string }> {
	let version = productService.version;
	if (productService.target) {
		version = `${version} (${productService.target} setup)`;
	} else if (productService.darwinUniversalAssetId) {
		version = `${version} (Universal)`;
	}

	const getDetails = async (useAgo: boolean): Promise<string> => {
		return localize({ key: 'aboutDetail', comment: ['Tauri, Chromium, Node.js and V8 are product names that need no translation'] },
			"Version: {0}\nCommit: {1}\nDate: {2}\nTauri: {3}\nChromium: {4}\nNode.js: {5}\nV8: {6}\nOS: {7}",
			version,
			productService.commit || 'Unknown',
			productService.date ? `${productService.date}${useAgo ? ' (' + fromNow(new Date(productService.date), true) + ')' : ''}` : 'Unknown',
			// Tauri version (from @tauri-apps/api)
			await (async () => {
				try {
					const { getTauriVersion } = await import('@tauri-apps/api/app');
					return await getTauriVersion();
				} catch {
					return 'N/A (Tauri)';
				}
			})(),
			// Note: Chrome version may not be available in Tauri's system webview (WebKit on macOS/Linux, WebView2 on Windows)
			process.versions['chrome'] || 'N/A (WebView)',
			process.versions['node'] || 'N/A',
			process.versions['v8'],
			`${osProps.type} ${osProps.arch} ${osProps.release}${isLinuxSnap ? ' snap' : ''}`
		);
	};

	const details = await getDetails(true);
	const detailsToCopy = await getDetails(false);

	return {
		title: productService.nameLong,
		details: details,
		detailsToCopy: detailsToCopy
	};
}
