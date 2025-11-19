/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ChildProcess, SpawnOptions, spawn } from 'child_process';
import { createInterface } from 'readline';
import { EventEmitter } from 'events';
import { URI } from '../../../../base/common/uri.js';
import { ITextSearchPreviewOptions } from '../common/search.js';
import { FileAccess } from '../../../../base/common/network.js';

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

		// Handle stderr
		if (this.child.stderr) {
			this.child.stderr.on('data', (data) => {
				console.error('RipgrepParserClient stderr:', data.toString());
			});
		}

		// Handle process errors
		this.child.on('error', (err) => {
			console.error('RipgrepParserClient process error:', err);
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

export class RipgrepParserClient extends EventEmitter {
	private client: JSONRPCClient;
	private maxResults: number;
	private root: URI;
	private previewOptions: ITextSearchPreviewOptions;

	constructor(maxResults: number, root: URI, previewOptions: ITextSearchPreviewOptions) {
		super();
		this.maxResults = maxResults;
		this.root = root;
		this.previewOptions = previewOptions;

		const binaryPath = this.getParserBinaryPath();
		this.client = new JSONRPCClient(binaryPath, ['serve'], { env: { ...process.env, MINTMIND_PARENT_PID: process.pid.toString() } });
		this.client.setOnNotification((method, params) => {
			switch (method) {
				case 'onResult':
					this.emit('result', params);
					break;
				case 'hitLimit':
					this.emit('hitLimit');
					break;
			}
		});
	}

	private getParserBinaryPath(): string {
		let basePath: string;
		try {
			basePath = FileAccess.asFileUri('vs/code/electron-main/ripgrep-parser-rust').fsPath;
		} catch {
			// Fallback for development environments
			basePath = require('path').join(__dirname, '..', '..', '..', '..', 'code', 'electron-main', 'ripgrep-parser-rust');
		}

		// Add platform-specific extension if needed
		if (process.platform === 'win32') {
			return basePath + '.exe';
		}
		return basePath;
	}

	handleData(data: Buffer | string): void {
		const dataStr = typeof data === 'string' ? data : data.toString('utf8');
		this.client.call('parse_line', { data: dataStr });
	}

	cancel(): void {
		this.client.dispose();
	}

	async flush(): Promise<void> {
		await this.client.call('flush');
	}
}