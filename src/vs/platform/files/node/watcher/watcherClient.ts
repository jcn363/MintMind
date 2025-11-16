/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { DisposableStore } from '../../../../base/common/lifecycle.js';
import { FileAccess } from '../../../../base/common/network.js';
import { spawn, SpawnOptions, ChildProcess } from 'child_process';
import * as readline from 'readline';
import { AbstractUniversalWatcherClient, IFileChange, ILogMessage, IUniversalWatcher } from '../../common/watcher.js';
import { UniversalWatcherProxy } from './universalWatcherProxy.js';

export class JSONRPCClient {
	private child: ChildProcess;
	private nextId = 1;
	private pendingRequests = new Map<number, { resolve: (value: unknown) => void; reject: (error: unknown) => void }>();
	private onNotification?: (method: string, params: unknown) => void;

		constructor(command: string, args: string[], options: SpawnOptions) {
			this.child = spawn(command, args, { ...options, stdio: ['pipe', 'pipe', 'pipe'] })!;
			if (!this.child.stdout || !this.child.stdin) {
				throw new Error('Child process stdio not properly configured');
			}
			const rl = readline.createInterface({ input: this.child.stdout, output: this.child.stdin });
		rl.on('line', (line) => {
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
							pending.reject(error);
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
			setTimeout(() => {
				if (this.pendingRequests.has(id)) {
					this.pendingRequests.delete(id);
					reject(`Request timeout for method ${method}`);
				}
			}, 30000);
		});
	}

	dispose(): void {
		this.child.kill();
	}
}


export class UniversalWatcherClient extends AbstractUniversalWatcherClient {

	constructor(
		onFileChanges: (changes: IFileChange[]) => void,
		onLogMessage: (msg: ILogMessage) => void,
		verboseLogging: boolean
	) {
		super(onFileChanges, onLogMessage, verboseLogging);

		this.init();
	}

	private getWatcherBinaryPath(): string {
		// Use robust platform-specific path resolution for the Rust watcher binary
		let basePath: string;
		try {
			basePath = FileAccess.asFileUri('vs/code/electron-main/watcher-rust').fsPath;
		} catch {
			// Fallback for development environments
			basePath = require('path').join(__dirname, '..', '..', '..', 'code', 'electron-main', 'watcher-rust');
		}

		// Add platform-specific extension if needed
		if (process.platform === 'win32') {
			return basePath + '.exe';
		}
		return basePath;
	}

	protected override createWatcher(disposables: DisposableStore): IUniversalWatcher {
		const binaryPath = this.getWatcherBinaryPath();
		const watcher = new UniversalWatcherProxy(binaryPath, process.env as Record<string, string>);
		disposables.add(watcher);
		return watcher;
	}
}
