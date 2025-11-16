/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ProxyChannel } from '../../../../base/parts/ipc/common/ipc.js';
import { Server as ChildProcessServer } from '../../../../base/parts/ipc/node/ipc.cp.js';
import { Server as UtilityProcessServer } from '../../../../base/parts/ipc/node/ipc.mp.js';
import { isUtilityProcess } from '../../../../base/parts/sandbox/node/electronTypes.js';
import { FileAccess } from '../../../../base/common/network.js';
import { spawn, SpawnOptions, ChildProcess } from 'child_process';
import * as readline from 'readline';
import { UniversalWatcherProxy } from './universalWatcherProxy.js';
import { DisposableStore } from '../../../../base/common/lifecycle.js';

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


let server: ChildProcessServer<string> | UtilityProcessServer;
if (isUtilityProcess(process)) {
	server = new UtilityProcessServer();
} else {
	server = new ChildProcessServer('watcher');
}

const rustBinaryPath = getWatcherRustBinaryPath();
const service = new UniversalWatcherProxy(rustBinaryPath, process.env as Record<string, string>);

function getWatcherRustBinaryPath(): string {
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
server.registerChannel('watcher', ProxyChannel.fromService(service, new DisposableStore()));
