/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Event } from '../../../base/common/event.js';
import { VSBuffer } from '../../../base/common/buffer.js';
import { CancellationToken } from '../../../base/common/cancellation.js';
import { localize } from '../../../nls.js';
import { createFileSystemProviderError, IFileAtomicReadOptions, IFileDeleteOptions, IFileOpenOptions, IFileOverwriteOptions, IFileReadStreamOptions, FileSystemProviderCapabilities, FileSystemProviderError, FileSystemProviderErrorCode, FileType, IFileWriteOptions, IFileSystemProviderWithFileAtomicReadCapability, IFileSystemProviderWithFileCloneCapability, IFileSystemProviderWithFileFolderCopyCapability, IFileSystemProviderWithFileReadStreamCapability, IFileSystemProviderWithFileReadWriteCapability, IFileSystemProviderWithOpenReadWriteCloseCapability, isFileOpenForWriteOptions, IStat, FilePermission, IFileSystemProviderWithFileAtomicWriteCapability, IFileSystemProviderWithFileAtomicDeleteCapability, IFileChange, IFileSystemProviderWithFileRealpathCapability } from '../common/files.js';
import { AbstractDiskFileSystemProvider } from '../common/diskFileSystemProvider.js';
import { spawn } from 'child_process';
import { join } from 'path';
import { tmpdir } from 'os';

export interface IFileIOResponse {
	method: string;
	params: unknown;
}

export class DiskFileSystemProviderClient extends AbstractDiskFileSystemProvider implements
	IFileSystemProviderWithFileReadWriteCapability,
	IFileSystemProviderWithOpenReadWriteCloseCapability,
	IFileSystemProviderWithFileReadStreamCapability,
	IFileSystemProviderWithFileFolderCopyCapability,
	IFileSystemProviderWithFileAtomicReadCapability,
	IFileSystemProviderWithFileAtomicWriteCapability,
	IFileSystemProviderWithFileAtomicDeleteCapability,
	IFileSystemProviderWithFileCloneCapability,
	IFileSystemProviderWithFileRealpathCapability {

	private static readonly FILEIO_BINARY_NAME = 'fileio';

	private fileioProcess: unknown | undefined;
	private requestId = 0;
	private pendingRequests = new Map<number, { resolve: (value: unknown) => void; reject: (error: unknown) => void }>();

	//#region File Capabilities

	readonly onDidChangeCapabilities = Event.None;

	private _capabilities: FileSystemProviderCapabilities | undefined;
	get capabilities(): FileSystemProviderCapabilities {
		if (!this._capabilities) {
			this._capabilities =
				FileSystemProviderCapabilities.FileReadWrite |
				FileSystemProviderCapabilities.FileOpenReadWriteClose |
				FileSystemProviderCapabilities.FileReadStream |
				FileSystemProviderCapabilities.FileFolderCopy |
				FileSystemProviderCapabilities.FileWriteUnlock |
				FileSystemProviderCapabilities.FileAtomicRead |
				FileSystemProviderCapabilities.FileAtomicWrite |
				FileSystemProviderCapabilities.FileAtomicDelete |
				FileSystemProviderCapabilities.FileClone |
				FileSystemProviderCapabilities.FileRealpath;

			if (process.platform === 'linux') {
				this._capabilities |= FileSystemProviderCapabilities.PathCaseSensitive;
			}
		}

		return this._capabilities;
	}

	//#endregion

	constructor(private logService: unknown) {
		super();
		this.ensureFileIOService();
	}

	private ensureFileIOService(): void {
		if (this.fileioProcess) {
			return; // Already running
		}

		try {
			// Spawn the fileio binary
			const binaryPath = this.findFileIOBinary();
			this.fileioProcess = spawn(binaryPath, [], {
				stdio: ['pipe', 'pipe', 'pipe'],
				env: { ...process.env, RUST_LOG: 'info' }
			});

			// Handle stdout (responses from fileio service)
			this.fileioProcess.stdout.on('data', (data: Buffer) => {
				try {
					const response: IFileIOResponse = JSON.parse(data.toString().trim());
					this.handleResponse(response);
				} catch (error) {
					this.logService.error('Failed to parse fileio response:', error);
				}
			});

			// Handle stderr (logs from fileio service)
			this.fileioProcess.stderr.on('data', (data: Buffer) => {
				this.logService.trace('FileIO stderr:', data.toString().trim());
			});

			// Handle process exit
			this.fileioProcess.on('exit', (code: number) => {
				this.logService.warn(`FileIO process exited with code ${code}`);
				this.fileioProcess = undefined;
				// Reject all pending requests
				for (const { reject } of this.pendingRequests.values()) {
					reject(new Error('FileIO service exited'));
				}
				this.pendingRequests.clear();
			});

			// Handle process errors
			this.fileioProcess.on('error', (error: Error) => {
				this.logService.error('FileIO process error:', error);
				this.fileioProcess = undefined;
			});

		} catch (error) {
			this.logService.error('Failed to start FileIO service:', error);
			throw error;
		}
	}

	private findFileIOBinary(): string {
		// For now, assume it's in the same directory as the Node.js process
		// In production, this should be configurable or found via PATH
		const possiblePaths = [
			join(process.cwd(), 'target', 'release', DiskFileSystemProviderClient.FILEIO_BINARY_NAME),
			join(process.cwd(), 'target', 'debug', DiskFileSystemProviderClient.FILEIO_BINARY_NAME),
			DiskFileSystemProviderClient.FILEIO_BINARY_NAME // Assume in PATH
		];

		for (const path of possiblePaths) {
			try {
				require('fs').accessSync(path);
				return path;
			} catch {
				// Continue to next path
			}
		}

		throw new Error(`FileIO binary not found. Searched paths: ${possiblePaths.join(', ')}`);
	}

	private sendRequest(method: string, params: unknown): Promise<unknown> {
		return new Promise((resolve, reject) => {
			const id = ++this.requestId;
			const request = { id, method, params };

			this.pendingRequests.set(id, { resolve, reject });

			try {
				const message = JSON.stringify(request) + '\n';
				this.fileioProcess.stdin.write(message);
			} catch (error) {
				this.pendingRequests.delete(id);
				reject(error);
			}
		});
	}

	private handleResponse(response: IFileIOResponse): void {
		const id = (response as unknown).id;
		const pending = this.pendingRequests.get(id);
		if (!pending) {
			this.logService.warn('Received response for unknown request ID:', id);
			return;
		}

		this.pendingRequests.delete(id);

		if (response.method === 'onFileIOResponse') {
			const result = response.params;
			if (result.Error) {
				pending.reject(this.createErrorFromResponse(result.Error));
			} else {
				pending.resolve(result);
			}
		} else {
			pending.reject(new Error(`Unexpected response method: ${response.method}`));
		}
	}

	private createErrorFromResponse(error: unknown): FileSystemProviderError {
		let code: FileSystemProviderErrorCode;
		switch (error.code) {
			case 'ENOENT':
				code = FileSystemProviderErrorCode.FileNotFound;
				break;
			case 'EPERM':
			case 'EACCES':
				code = FileSystemProviderErrorCode.NoPermissions;
				break;
			case 'EEXIST':
				code = FileSystemProviderErrorCode.FileExists;
				break;
			case 'EISDIR':
				code = FileSystemProviderErrorCode.FileIsADirectory;
				break;
			case 'ENOTDIR':
				code = FileSystemProviderErrorCode.FileNotADirectory;
				break;
			default:
				code = FileSystemProviderErrorCode.Unknown;
		}
		return createFileSystemProviderError(error.message, code);
	}

	private async callFileIOService(operation: string, params: unknown): Promise<unknown> {
		try {
			this.ensureFileIOService();
			const response = await this.sendRequest('onFileIORequest', {
				method: operation,
				params
			});
			return response;
		} catch (error) {
			// Fallback to TypeScript implementation if service fails
			this.logService.warn(`FileIO service failed for ${operation}, falling back to TS implementation:`, error);
			throw error; // For now, just throw. In production, implement fallback logic.
		}
	}

	//#region File Metadata Resolving

	async stat(resource: URI): Promise<IStat> {
		const result = await this.callFileIOService('Stat', {
			path: this.toFilePath(resource)
		});

		return {
			type: this.toFileType(result.type, result.is_directory, result.is_file, result.is_symlink),
			ctime: result.ctime,
			mtime: result.mtime,
			size: result.size,
			permissions: result.permissions === 0 ? FilePermission.Locked : undefined
		};
	}

	async realpath(resource: URI): Promise<string> {
		const result = await this.callFileIOService('RealPath', {
			path: this.toFilePath(resource)
		});
		return result;
	}

	async readdir(resource: URI): Promise<[string, FileType][]> {
		const result = await this.callFileIOService('ReadDir', {
			path: this.toFilePath(resource)
		});

		return result.map((entry: unknown) => [
			entry.name,
			this.toFileType(entry.type, entry.is_directory, entry.is_file, entry.is_symlink)
		]);
	}

	private toFileType(type: number, isDirectory: boolean, isFile: boolean, isSymlink: boolean): FileType {
		let fileType: FileType = FileType.Unknown;
		if (isFile) {
			fileType = FileType.File;
		} else if (isDirectory) {
			fileType = FileType.Directory;
		}
		if (isSymlink) {
			fileType |= FileType.SymbolicLink;
		}
		return fileType;
	}

	//#endregion

	//#region File Reading/Writing

	async readFile(resource: URI, options?: IFileAtomicReadOptions): Promise<Uint8Array> {
		const result = await this.callFileIOService('ReadFile', {
			path: this.toFilePath(resource),
			atomic: options?.atomic
		});
		return VSBuffer.wrap(Buffer.from(result.content, result.encoding || 'utf8')).buffer;
	}

	readFileStream(resource: URI, opts: IFileReadStreamOptions, token: CancellationToken): unknown {
		// For streaming, we might need to implement a more complex RPC mechanism
		// For now, fallback to base implementation
		return super.readFileStream(resource, opts, token);
	}

	async writeFile(resource: URI, content: Uint8Array, opts: IFileWriteOptions): Promise<void> {
		await this.callFileIOService('WriteFile', {
			path: this.toFilePath(resource),
			content: Buffer.from(content).toString(opts.encoding || 'utf8'),
			encoding: opts.encoding,
			atomic: opts.atomic,
			create: opts.create,
			overwrite: opts.overwrite,
			unlock: opts.unlock
		});
	}

	async open(resource: URI, opts: IFileOpenOptions): Promise<number> {
		const result = await this.callFileIOService('OpenFile', {
			path: this.toFilePath(resource),
			create: opts.create,
			unlock: opts.unlock
		});
		return result.handle;
	}

	async close(fd: number): Promise<void> {
		await this.callFileIOService('CloseFile', {
			handle: fd
		});
	}

	async read(fd: number, pos: number, data: Uint8Array, offset: number, length: number): Promise<number> {
		const result = await this.callFileIOService('ReadFileHandle', {
			handle: fd,
			position: pos,
			length
		});
		data.set(result.data.slice(0, result.bytes_read), offset);
		return result.bytes_read;
	}

	async write(fd: number, pos: number, data: Uint8Array, offset: number, length: number): Promise<number> {
		const result = await this.callFileIOService('WriteFileHandle', {
			handle: fd,
			position: pos,
			data: Array.from(data.slice(offset, offset + length)),
			offset,
			length
		});
		return result.bytes_written;
	}

	//#endregion

	//#region Move/Copy/Delete/Create Folder

	async mkdir(resource: URI): Promise<void> {
		await this.callFileIOService('MkDir', {
			path: this.toFilePath(resource),
			recursive: true
		});
	}

	async delete(resource: URI, opts: IFileDeleteOptions): Promise<void> {
		await this.callFileIOService('Delete', {
			path: this.toFilePath(resource),
			recursive: opts.recursive,
			atomic: opts.atomic
		});
	}

	async rename(from: URI, to: URI, opts: IFileOverwriteOptions): Promise<void> {
		await this.callFileIOService('Rename', {
			old_path: this.toFilePath(from),
			new_path: this.toFilePath(to)
		});
	}

	async copy(from: URI, to: URI, opts: IFileOverwriteOptions): Promise<void> {
		await this.callFileIOService('Copy', {
			source: this.toFilePath(from),
			destination: this.toFilePath(to),
			overwrite: opts.overwrite
		});
	}

	async cloneFile(from: URI, to: URI): Promise<void> {
		await this.callFileIOService('Clone', {
			source: this.toFilePath(from),
			destination: this.toFilePath(to)
		});
	}

	//#endregion

	dispose(): void {
		if (this.fileioProcess) {
			this.fileioProcess.kill();
			this.fileioProcess = undefined;
		}
		super.dispose();
	}
}