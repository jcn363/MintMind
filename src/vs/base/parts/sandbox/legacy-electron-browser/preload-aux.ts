/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

(function () {

	// Tauri API replacements for Electron APIs
	const ipcRenderer = {
		send(channel: string, ...args: unknown[]): void {
			window.__TAURI__.invoke(channel, { args });
		},
		invoke(channel: string, ...args: unknown[]): Promise<unknown> {
			return window.__TAURI__.invoke(channel, ...args);
		}
	};

	const webFrame = {
		setZoomLevel(level: number): void {
			window.__TAURI__.webview.setZoom(level);
		}
	};

	const contextBridge = {
		exposeInMainWorld(key: string, obj: any): void {
			(window as any)[key] = obj;
		}
	};

	function validateIPC(channel: string): true | never {
		if (!channel?.startsWith('vscode:')) {
			throw new Error(`Unsupported event IPC channel '${channel}'`);
		}

		return true;
	}

	const globals = {

		/**
		 * A minimal set of methods exposed from Electron's `ipcRenderer`
		 * to support communication to main process.
		 */
		ipcRenderer: {

			send(channel: string, ...args: unknown[]): void {
				if (validateIPC(channel)) {
					ipcRenderer.send(channel, ...args);
				}
			},

			invoke(channel: string, ...args: unknown[]): Promise<unknown> {
				validateIPC(channel);

				return ipcRenderer.invoke(channel, ...args);
			}
		},

		/**
		 * Support for subset of methods of Electron's `webFrame` type.
		 */
		webFrame: {

			setZoomLevel(level: number): void {
				if (typeof level === 'number') {
					webFrame.setZoomLevel(level);
				}
			}
		}
	};

	try {
		contextBridge.exposeInMainWorld('vscode', globals);
	} catch (error) {
		console.error(error);
	}
}());
