/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ChildProcess, SpawnOptions, spawn } from 'child_process';
import { createInterface } from 'readline';
import { Emitter } from '../../../../base/common/event.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { IFileChange, ILogMessage, IUniversalWatchRequest, IUniversalWatcher, IWatcherErrorEvent } from '../../common/watcher.js';

class JSONRPCClient {
	private child: ChildProcess;
	private nextId = 1;
	private pendingRequests = new Map<number, { resolve: (value: unknown) => void; reject: (error: unknown) => void }>();
	private onNotification?: (method: string, params: unknown) => void;

	constructor(command: string, args: string[], options: SpawnOptions) {
		this.child = spawn(command, args, { ...options, stdio: ['pipe', 'pipe', 'pipe'] })!;
		if (!this.child.stdout || !this.child.stdin) {
			throw new Error('Child process stdio not properly configured');
		}
		const rl = createInterface({ input: this.child.stdout, output: this.child.stdin });
		rl.on('line', (line: string) => {
			try {
				const decoded = Buffer.from(line, 'base64').toString('utf8');
				const message = JSON.parse(decoded);
				if ('id' in message) {
					// response
					const { id, result, error } = message;
					const pending = this.pendingRequests.get(id);
					if (pending) {
						this.pendingRequests.delete(id);
						if (error) {
							pending.reject(new Error(error.message));
						} else {
							pending.resolve(result);
						}
					}
				} else {
					// notification
					const { method, params } = message;
					this.onNotification?.(method, params);
				}
			} catch (e) {
				// ignore invalid messages
			}
		});
	}

	setOnNotification(handler: (method: string, params: unknown) => void) {
		this.onNotification = handler;
	}

	async call(method: string, params?: unknown): Promise<unknown> {
		const id = this.nextId++;
		const request = { jsonrpc: '2.0', id, method, params };
		const encoded = Buffer.from(JSON.stringify(request)).toString('base64');
		if (this.child.stdin) {
			this.child.stdin.write(encoded + '\n');
		}
		return new Promise((resolve, reject) => {
			this.pendingRequests.set(id, { resolve, reject });
		});
	}

	dispose(): void {
		this.child.kill();
	}
}

export class UniversalWatcherProxy extends Disposable implements IUniversalWatcher {
	private client: JSONRPCClient;
	private _onDidChangeFile = this._register(new Emitter<IFileChange[]>());
	readonly onDidChangeFile = this._onDidChangeFile.event;
	private _onDidError = this._register(new Emitter<IWatcherErrorEvent>());
	readonly onDidError = this._onDidError.event;
	private _onDidLogMessage = this._register(new Emitter<ILogMessage>());
	readonly onDidLogMessage = this._onDidLogMessage.event;

		constructor(rustBinaryPath: string, env: Record<string, string>) {
			super();
			this.client = this._register(new JSONRPCClient(rustBinaryPath, ['serve'], { env: { ...env, MINTMIND_PARENT_PID: process.pid.toString() } }))!;
		this.client.setOnNotification((method, params) => {
			switch (method) {
				case 'onDidChangeFile':
					this._onDidChangeFile.fire(params);
					break;
				case 'onDidError':
					this._onDidError.fire({ error: params });
					break;
				case 'onDidLogMessage':
					this._onDidLogMessage.fire(params);
					break;
			}
		});
	}

	async watch(requests: IUniversalWatchRequest[]): Promise<void> {
		await this.client.call('watch', requests);
	}

	async setVerboseLogging(enabled: boolean): Promise<void> {
		await this.client.call('setVerboseLogging', enabled);
	}

	async stop(): Promise<void> {
		await this.client.call('stop');
	}
}