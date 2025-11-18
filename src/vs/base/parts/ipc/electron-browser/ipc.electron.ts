/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { VSBuffer } from '../../../common/buffer.js';
import { Event } from '../../../common/event.js';
import { IDisposable } from '../../../common/lifecycle.js';
import { IPCClient } from '../common/ipc.js';
import { Protocol as ElectronProtocol } from '../common/ipc.electron.js';
import { ipcRenderer } from '../../sandbox/electron-browser/globals.js';

/**
 * An implementation of `IPCClient` on top of Tauri IPC communication
 * provided from sandbox globals (via preload script).
 */
export class Client extends IPCClient implements IDisposable {

	private protocol: ElectronProtocol;

	private static async createProtocol(): Promise<ElectronProtocol> {
		// Check if running under Tauri runtime
		if (typeof window !== 'undefined' && (window as any).__TAURI__) {
			// Use Tauri-compatible protocol
			const { listen, emit, invoke } = await import('@tauri-apps/api/event');
			const { getCurrentWindow } = await import('@tauri-apps/api/window');

			return new class implements ElectronProtocol {
				private readonly _onMessage = new Event.Emitter<VSBuffer>();
				public readonly onMessage = this._onMessage.event;

				constructor() {
					// Initialize Tauri IPC listener
					listen('vscode:message', (event) => {
						try {
							const data = typeof event.payload === 'string' ? JSON.parse(event.payload) : event.payload;
							const buffer = VSBuffer.wrap(new Uint8Array(data));
							this._onMessage.fire(buffer);
						} catch (error) {
							console.error('Failed to process Tauri message:', error);
						}
					}).catch(error => {
						console.error('Failed to setup Tauri message listener:', error);
					});
				}

				send(message: VSBuffer): void {
					emit('vscode:message', Array.from(message.buffer)).catch(error => {
						console.error('Failed to send Tauri message:', error);
					});
				}

				disconnect(): void {
					emit('vscode:disconnect').catch(error => {
						console.error('Failed to disconnect Tauri IPC:', error);
					});
				}
			}();
		}

		// Fallback to Electron IPC
		const onMessage = Event.fromNodeEventEmitter<VSBuffer>(ipcRenderer, 'vscode:message', (_, message) => VSBuffer.wrap(message));
		ipcRenderer.send('vscode:hello');

		return new ElectronProtocol(ipcRenderer, onMessage);
	}

	constructor(id: string) {
		// Initialize synchronously with placeholder, then replace with real protocol
		this.protocol = {} as any;
		Client.createProtocol().then(protocol => {
			this.protocol = protocol;
			// Note: super() is already called with placeholder, we can't re-call it
		});

		super(this.protocol, id);
	}

	override dispose(): void {
		if (this.protocol?.disconnect) {
			this.protocol.disconnect();
		}
		super.dispose();
	}
}
