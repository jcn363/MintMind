/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ChildProcess, spawn } from 'child_process';
import { EventEmitter } from 'events';
import { StringDecoder } from 'string_decoder';
import { URI } from '../../../../base/common/uri.js';
import { ITextSearchPreviewOptions } from '../common/search.js';
import { TextSearchResult2 } from '../common/searchExtTypes.js';

export class RipgrepRustParserClient extends EventEmitter {
	private child: ChildProcess | null = null;
	private stringDecoder: StringDecoder;
	private remainder = '';
	private isDone = false;
	private rootUri: string;
	private maxResults: number;
	private previewOptions: ITextSearchPreviewOptions;

	constructor(maxResults: number, root: URI, previewOptions: ITextSearchPreviewOptions) {
		super();
		this.maxResults = maxResults;
		this.rootUri = root.toString();
		this.previewOptions = previewOptions;
		this.stringDecoder = new StringDecoder('utf8');

		this.spawnProcess();
	}

	private spawnProcess(): void {
		try {
			const binaryPath = './src-tauri/ripgrep-rust-parser';
			this.child = spawn(binaryPath, [], {
				stdio: ['pipe', 'pipe', 'pipe'],
				env: { ...process.env, MINTMIND_PARENT_PID: process.pid.toString() }
			});

			if (!this.child.stdin || !this.child.stdout || !this.child.stderr) {
				throw new Error('Child process stdio not properly configured');
			}

			// Send root URI as first line to initialize
			this.child.stdin.write(this.rootUri + '\n');

			// Handle stdout - parse JSON results and emit events
			this.child.stdout.on('data', (data: Buffer) => {
				this.handleStdoutData(data);
			});

			// Handle stderr for logging
			this.child.stderr.on('data', (data: Buffer) => {
				console.error('RipgrepRustParserClient stderr:', data.toString());
			});

			// Handle process exit
			this.child.on('exit', (code: number | null, signal: string | null) => {
				this.handleProcessExit(code, signal);
			});

			// Handle process errors
			this.child.on('error', (err: Error) => {
				console.error('RipgrepRustParserClient process error:', err);
				this.emit('error', err);
			});

		} catch (err) {
			console.error('Failed to spawn Rust parser process:', err);
			this.emit('error', err);
		}
	}

	private handleStdoutData(data: Buffer): void {
		if (this.isDone) {
			return;
		}

		const decodedData = this.stringDecoder.write(data);
		this.handleDecodedData(decodedData);
	}

	private handleDecodedData(decodedData: string): void {
		// Append to remainder and process complete lines
		this.remainder += decodedData;

		let newlineIdx = this.remainder.indexOf('\n');
		while (newlineIdx >= 0) {
			const line = this.remainder.substring(0, newlineIdx).trim();
			this.remainder = this.remainder.substring(newlineIdx + 1);

			if (line) {
				try {
					const result: TextSearchResult2 = JSON.parse(line);
					this.emit('result', result);
				} catch (err) {
					console.error('Failed to parse result from Rust parser:', line, err);
				}
			}

			newlineIdx = this.remainder.indexOf('\n');
		}
	}

	handleData(data: Buffer | string): void {
		if (this.isDone || !this.child?.stdin) {
			return;
		}

		const dataStr = typeof data === 'string' ? data : data.toString('utf8');
		try {
			this.child.stdin.write(dataStr);
		} catch (err) {
			console.error('Failed to write data to Rust parser stdin:', err);
			this.emit('error', err);
		}
	}

	cancel(): void {
		this.isDone = true;
		this.cleanup();
	}

	flush(): void {
		if (this.isDone) {
			return;
		}

		// Send EOF to trigger flush in Rust parser
		if (this.child?.stdin) {
			try {
				this.child.stdin.end();
			} catch (err) {
				console.error('Failed to flush Rust parser:', err);
			}
		}
	}

	private handleProcessExit(code: number | null, signal: string | null): void {
		// Process any remaining data in decoder
		const remaining = this.stringDecoder.end();
		if (remaining) {
			this.handleDecodedData(remaining);
		}

		// Emit done event
		this.emit('done');

		// Cleanup
		this.cleanup();

		if (code !== 0 && code !== null) {
			console.warn(`Rust parser process exited with code ${code}`);
		}
		if (signal) {
			console.warn(`Rust parser process terminated by signal ${signal}`);
		}
	}

	private cleanup(): void {
		if (this.child) {
			try {
				this.child.kill();
			} catch (err) {
				// Ignore kill errors
			}
			this.child = null;
		}
	}

	// Override EventEmitter on method for TypeScript typing
	override on(event: 'result', listener: (result: TextSearchResult2) => void): this;
	override on(event: 'done', listener: () => void): this;
	override on(event: 'error', listener: (error: Error) => void): this;
	override on(event: string, listener: (...args: any[]) => void): this {
		return super.on(event, listener);
	}
}