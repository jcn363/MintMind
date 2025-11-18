/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { invoke } from '@tauri-apps/api/core';
import { emit, listen, once, UnlistenFn } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { ISandboxConfiguration } from '../common/sandboxTypes.js';

// Validation function reused from electron preload.ts
function validateIPC(channel: string): true | never {
	if (!channel?.startsWith('vscode:')) {
		throw new Error(`Unsupported event IPC channel '${channel}'`);
	}
	return true;
}

// Channel to command mapping for invoke calls
const channelToCommandMapping: { [key: string]: string } = {
	'vscode:fetchShellEnv': 'fetch_shell_env',
	'vscode:notifyZoomLevel': 'notify_zoom_level',
	'vscode:toggleDevTools': 'toggle_dev_tools',
	'vscode:getDiagnosticInfo': 'get_diagnostic_info',
	'vscode:reloadWindow': 'reload_window',
	'vscode:openDevTools': 'open_dev_tools',
	// Add more mappings as needed
};

// Tauri-compatible IpcRenderer shim
class TauriIpcRenderer {
	send(channel: string, ...args: unknown[]): void {
		if (validateIPC(channel)) {
			emit(channel, args).catch(console.error);
		}
	}

	async invoke(channel: string, ...args: unknown[]): Promise<unknown> {
		validateIPC(channel);
		const command = channelToCommandMapping[channel] || 'ipc_invoke';
		// For commands that require window_label, add it to the arguments
		if (command === 'notify_zoom_level') {
			const window = getCurrentWindow();
			const windowLabel = window.label;
			return invoke(command, {
				window_label: windowLabel,
		} else if (command === 'reload_window' || command === 'open_dev_tools') {
			const window = getCurrentWindow();
			const windowLabel = window.label;
			return invoke(command, { window_label: windowLabel });
		}
				zoom_level: args[0] as number
			});
		} else if (command === 'toggle_dev_tools') {
			const window = getCurrentWindow();
			const windowLabel = window.label;
			return invoke(command, { window_label: windowLabel });
		}
		if (command === 'ipc_invoke') {
			return invoke(command, { channel, args });
		}
		// Pass args as a single object for commands that expect structured parameters
		return invoke(command, args.length === 1 ? args[0] : args);
	}

	on(channel: string, listener: (event: any, ...args: unknown[]) => void): this {
		validateIPC(channel);
		const wrappedListener = (event: any) => {
			listener(event, ...(event.payload || []));
		};
		listen(channel, wrappedListener).catch(console.error);
		return this;
	}

	once(channel: string, listener: (event: any, ...args: unknown[]) => void): this {
		validateIPC(channel);
		const wrappedListener = (event: any) => {
			listener(event, ...(event.payload || []));
		};
		once(channel, wrappedListener).catch(console.error);
		return this;
	}

	removeListener(channel: string, listener: (event: any, ...args: unknown[]) => void): this {
		// Note: Tauri doesn't have a direct equivalent, so we'll use unlisten
		// This is a simplified implementation
		console.warn('removeListener not fully implemented for Tauri');
		return this;
	}
}

// Tauri-compatible Process shim
class TauriProcess {
	private _processInfo: any = null;
	private _cwd: string = '';
	private _memoryInfo: any = null;

	async init(): Promise<void> {
		this._processInfo = await invoke('get_process_info');
		this._cwd = await invoke('current_dir');
		this._memoryInfo = await invoke('get_process_memory_info');
	}

	get platform(): string {
		return this._processInfo?.platform || 'unknown';
	}

	get arch(): string {
		return this._processInfo?.arch || 'unknown';
	}

	get env(): any {
		return this._processInfo?.env || {};
	}

	get versions(): any {
		return this._processInfo?.versions || {};
	}

	get type(): string {
		return 'renderer';
	}

	get execPath(): string {
		return this._processInfo?.execPath || '';
	}

	cwd(): string {
		return this._cwd;
	}

	async shellEnv(): Promise<any> {
		return invoke('fetch_shell_env');
	}

	getProcessMemoryInfo(): Promise<any> {
		return Promise.resolve(this._memoryInfo);
	}
}

// Tauri-compatible WebFrame shim
class TauriWebFrame {
	setZoomLevel(level: number): void {
		invoke('set_zoom_level', { level }).catch(console.error);
	}
}

// Tauri-compatible WebUtils shim
class TauriWebUtils {
	getPathForFile(file: File): string {
		// Cache the path synchronously after initial fetch
		if (!(file as any)._cachedPath) {
			// For synchronous access, we need to block or have pre-fetched
			// For now, return the name directly as a synchronous operation
			(file as any)._cachedPath = file.name;
		}
		return (file as any)._cachedPath;
	}
}

// Tauri-compatible IpcMessagePort shim
class TauriIpcMessagePort {
	acquire(responseChannel: string, nonce: string): void {
		if (validateIPC(responseChannel)) {
			const listener = (event: any) => {
				if (event.payload?.nonce === nonce) {
					window.postMessage(nonce, '*', event.payload?.ports || []);
				}
			};
			listen(responseChannel, listener).catch(console.error);
		}
	}
}

// Context object for configuration resolution
class TauriContext {
	private _configuration: ISandboxConfiguration | undefined;
	private _resolveConfigurationPromise: Promise<ISandboxConfiguration> | undefined;

	configuration(): ISandboxConfiguration | undefined {
		return this._configuration;
	}

	async resolveConfiguration(): Promise<ISandboxConfiguration> {
		if (this._resolveConfigurationPromise) {
			return this._resolveConfigurationPromise;
		}

		this._resolveConfigurationPromise = (async () => {
			const window = getCurrentWindow();
			const windowLabel = window.label; // Get window label (string)
			this._configuration = await invoke('get_window_config', { windowLabel });
			return this._configuration;
		})();

		return this._resolveConfigurationPromise;
	}
}

// Initialize instances
const ipcRenderer = new TauriIpcRenderer();
const process = new TauriProcess();
const webFrame = new TauriWebFrame();
const webUtils = new TauriWebUtils();
const ipcMessagePort = new TauriIpcMessagePort();
const context = new TauriContext();

// Initialize process info on module load
process.init().catch(console.error);

// Export the vscode object matching the shape from globals.ts
export const vscode = {
	ipcRenderer,
	ipcMessagePort,
	webFrame,
	webUtils,
	process,
	context,
};