/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { VSBuffer } from '../../../base/common/buffer.js';
import { CancellationToken } from '../../../base/common/cancellation.js';
import { Event } from '../../../base/common/event.js';
import { DisposableStore, IDisposable } from '../../../base/common/lifecycle.js';
import { basename, dirname, join } from '../../../base/common/path.js';
import { isLinux, isWindows } from '../../../base/common/platform.js';
import { extUriBiasedIgnorePathCase, joinPath, basename as resourcesBasename, dirname as resourcesDirname } from '../../../base/common/resources.js';
import { newWriteableStream, ReadableStreamEvents } from '../../../base/common/stream.js';
import { URI } from '../../../base/common/uri.js';
import { localize } from '../../../nls.js';
import { createFileSystemProviderError, IFileAtomicReadOptions, IFileDeleteOptions, IFileOpenOptions, IFileOverwriteOptions, IFileReadStreamOptions, FileSystemProviderCapabilities, FileSystemProviderError, FileSystemProviderErrorCode, FileType, IFileWriteOptions, IFileSystemProviderWithFileAtomicReadCapability, IFileSystemProviderWithFileCloneCapability, IFileSystemProviderWithFileFolderCopyCapability, IFileSystemProviderWithFileReadStreamCapability, IFileSystemProviderWithFileReadWriteCapability, IFileSystemProviderWithOpenReadWriteCloseCapability, isFileOpenForWriteOptions, IStat, FilePermission, IFileSystemProviderWithFileAtomicWriteCapability, IFileSystemProviderWithFileAtomicDeleteCapability, IFileChange, IFileSystemProviderWithFileRealpathCapability } from '../common/files.js';
import { readFileIntoStream } from '../common/io.js';
import { AbstractNonRecursiveWatcherClient, AbstractUniversalWatcherClient, ILogMessage } from '../common/watcher.js';
import { AbstractDiskFileSystemProvider } from '../common/diskFileSystemProvider.js';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

/**
 * File handle for open file operations
 */
interface IFileHandle {
	fd: number;
	position: number;
	path: string;
	isWriting: boolean;
}

/**
 * Copy options for file operations
 */
interface ICopyOptions {
	overwrite?: boolean;
}

/**
 * Move options for file operations
 */
interface IMoveOptions {
	overwrite?: boolean;
}

/**
 * Search options for file operations
 */
interface ISearchOptions {
	pattern?: string;
	caseSensitive?: boolean;
	recursive?: boolean;
}

// =============================================================================
// TAURI INVOKE WRAPPERS
// =============================================================================

/**
 * Invoke Tauri command for reading text file
 */
async function invokeReadTextFile(path: string): Promise<string> {
	return window.__TAURI__.invoke('read_text_file', { path });
}

/**
 * Invoke Tauri command for reading binary file
 */
async function invokeReadBinaryFile(path: string): Promise<Uint8Array> {
	const result: number[] = await window.__TAURI__.invoke('read_binary_file', { path });
	return new Uint8Array(result);
}

/**
 * Invoke Tauri command for writing text file
 */
async function invokeWriteTextFile(path: string, content: string): Promise<void> {
	return window.__TAURI__.invoke('write_text_file', { path, content });
}

/**
 * Invoke Tauri command for writing binary file
 */
async function invokeWriteBinaryFile(path: string, content: Uint8Array): Promise<void> {
	return window.__TAURI__.invoke('write_binary_file', { path, content: Array.from(content) });
}

/**
 * Invoke Tauri command for checking file existence
 */
async function invokeExists(path: string): Promise<boolean> {
	return window.__TAURI__.invoke('exists', { path });
}

/**
 * Invoke Tauri command for getting file metadata
 */
async function invokeMetadata(path: string): Promise<{
	path: string;
	size: number;
	is_dir: boolean;
	is_file: boolean;
	modified?: number;
	created?: number;
	readonly: boolean;
}> {
	return window.__TAURI__.invoke('metadata', { path });
}

/**
 * Invoke Tauri command for reading directory
 */
async function invokeReadDir(path: string): Promise<Array<{
	name: string;
	path: string;
	is_dir: boolean;
	is_file: boolean;
	size?: number;
	modified?: number;
}>> {
	return window.__TAURI__.invoke('read_dir', { path });
}

/**
 * Invoke Tauri command for creating directory
 */
async function invokeCreateDir(path: string): Promise<void> {
	return window.__TAURI__.invoke('create_dir', { path });
}

/**
 * Invoke Tauri command for removing file
 */
async function invokeRemoveFile(path: string): Promise<void> {
	return window.__TAURI__.invoke('remove_file', { path });
}

/**
 * Invoke Tauri command for removing directory
 */
async function invokeRemoveDir(path: string): Promise<void> {
	return window.__TAURI__.invoke('remove_dir', { path });
}

/**
 * Invoke Tauri command for removing directory recursively
 */
async function invokeRemoveDirAll(path: string): Promise<void> {
	return window.__TAURI__.invoke('remove_dir_all', { path });
}

/**
 * Invoke Tauri command for copying file
 */
async function invokeCopyFile(from: string, to: string, options?: ICopyOptions): Promise<number> {
	return window.__TAURI__.invoke('copy_file', { from, to, options });
}

/**
 * Invoke Tauri command for renaming/moving
 */
async function invokeRename(from: string, to: string, options?: IMoveOptions): Promise<void> {
	return window.__TAURI__.invoke('rename', { from, to, options });
}

/**
 * Invoke Tauri command for atomic file write
 */
async function invokeWriteFileAtomic(path: string, content: string): Promise<void> {
	return window.__TAURI__.invoke('write_file_atomic', { path, content });
}

/**
 * Invoke Tauri command for atomic directory copy
 */
async function invokeCopyDirAtomic(from: string, to: string): Promise<void> {
	return window.__TAURI__.invoke('copy_dir_atomic', { from, to });
}

/**
 * Invoke Tauri command for getting current directory
 */
async function invokeCurrentDir(): Promise<string> {
	return window.__TAURI__.invoke('current_dir');
}

/**
 * Invoke Tauri command for getting home directory
 */
async function invokeHomeDir(): Promise<string> {
	return window.__TAURI__.invoke('home_dir');
}

/**
 * Invoke Tauri command for getting temp directory
 */
async function invokeTempDir(): Promise<string> {
	return window.__TAURI__.invoke('temp_dir');
}

/**
 * Invoke Tauri command for getting path separator
 */
async function invokePathSeparator(): Promise<string> {
	return window.__TAURI__.invoke('path_separator');
}

// =============================================================================
// FILE HANDLE OPERATIONS
// =============================================================================

/**
 * File handle manager for open file operations
 */
class FileHandleManager {
	private static instance: FileHandleManager;
	private handles = new Map<number, IFileHandle>();
	private nextFd = 1;

	static getInstance(): FileHandleManager {
		if (!FileHandleManager.instance) {
			FileHandleManager.instance = new FileHandleManager();
		}
		return FileHandleManager.instance;
	}

	/**
	 * Create a new file handle
	 */
	createHandle(path: string, isWriting: boolean): number {
		const fd = this.nextFd++;
		this.handles.set(fd, {
			fd,
			position: 0,
			path,
			isWriting
		});
		return fd;
	}

	/**
	 * Get file handle by descriptor
	 */
	getHandle(fd: number): IFileHandle | undefined {
		return this.handles.get(fd);
	}

	/**
	 * Update position for file handle
	 */
	updatePosition(fd: number, position: number): void {
		const handle = this.handles.get(fd);
		if (handle) {
			handle.position = position;
		}
	}

	/**
	 * Close file handle
	 */
	closeHandle(fd: number): void {
		this.handles.delete(fd);
	}
}

// =============================================================================
// TAURI FILESYSTEM PROVIDER
// =============================================================================

export class TauriFileSystemProvider extends AbstractDiskFileSystemProvider implements
	IFileSystemProviderWithFileReadWriteCapability,
	IFileSystemProviderWithOpenReadWriteCloseCapability,
	IFileSystemProviderWithFileReadStreamCapability,
	IFileSystemProviderWithFileFolderCopyCapability,
	IFileSystemProviderWithFileAtomicReadCapability,
	IFileSystemProviderWithFileAtomicWriteCapability,
	IFileSystemProviderWithFileAtomicDeleteCapability,
	IFileSystemProviderWithFileCloneCapability,
	IFileSystemProviderWithFileRealpathCapability {

	private static readonly TRACE_LOG_RESOURCE_LOCKS = false; // not enabled by default because very spammy
	private readonly handleManager = FileHandleManager.getInstance();

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

			if (isLinux) {
				this._capabilities |= FileSystemProviderCapabilities.PathCaseSensitive;
			}
		}

		return this._capabilities;
	}

	//#endregion

	//#region File Metadata Resolving

	async stat(resource: URI): Promise<IStat> {
		try {
			const filePath = this.toFilePath(resource);
			const metadata = await invokeMetadata(filePath);

			return {
				type: this.toType(metadata),
				ctime: metadata.created ? metadata.created * 1000 : Date.now(), // Convert to milliseconds
				mtime: metadata.modified ? metadata.modified * 1000 : Date.now(),
				size: metadata.size,
				permissions: metadata.readonly ? FilePermission.Locked : undefined
			};
		} catch (error) {
			throw this.toFileSystemProviderError(error);
		}
	}

	private toType(metadata: { is_file: boolean; is_dir: boolean }): FileType {
		if (metadata.is_file) {
			return FileType.File;
		} else if (metadata.is_dir) {
			return FileType.Directory;
		} else {
			return FileType.Unknown;
		}
	}

	async realpath(resource: URI): Promise<string> {
		// Tauri doesn't have a direct realpath command, so we'll use the file path as-is
		// This could be enhanced with a custom Tauri command if needed
		return this.toFilePath(resource);
	}

	async readdir(resource: URI): Promise<[string, FileType][]> {
		try {
			const filePath = this.toFilePath(resource);
			const entries = await invokeReadDir(filePath);

			return entries.map(entry => [
				entry.name,
				entry.is_file ? FileType.File : entry.is_dir ? FileType.Directory : FileType.Unknown
			]);
		} catch (error) {
			throw this.toFileSystemProviderError(error);
		}
	}

	//#endregion

	//#region File Reading/Writing

	private readonly resourceLocks = new Map<string, Promise<any>>(resource => extUriBiasedIgnorePathCase.getComparisonKey(resource));

	private async createResourceLock(resource: URI): Promise<IDisposable> {
		const filePath = this.toFilePath(resource);
		this.traceLock(`[Tauri FileSystemProvider]: createResourceLock() - request to acquire resource lock (${filePath})`);

		// Await pending locks for resource
		const existingLock = this.resourceLocks.get(filePath);
		if (existingLock) {
			this.traceLock(`[Tauri FileSystemProvider]: createResourceLock() - waiting for resource lock to be released (${filePath})`);
			await existingLock;
		}

		// Create new lock promise
		let resolveLock: () => void;
		const lockPromise = new Promise<void>((resolve) => {
			resolveLock = resolve;
		});

		this.resourceLocks.set(filePath, lockPromise);

		this.traceLock(`[Tauri FileSystemProvider]: createResourceLock() - new resource lock created (${filePath})`);

		return {
			dispose: () => {
				this.traceLock(`[Tauri FileSystemProvider]: createResourceLock() - resource lock dispose() (${filePath})`);
				this.resourceLocks.delete(filePath);
				resolveLock();
			}
		};
	}

	async readFile(resource: URI, options?: IFileAtomicReadOptions): Promise<Uint8Array> {
		let lock: IDisposable | undefined = undefined;
		try {
			if (options?.atomic) {
				this.traceLock(`[Tauri FileSystemProvider]: atomic read operation started (${this.toFilePath(resource)})`);
				lock = await this.createResourceLock(resource);
			}

			const filePath = this.toFilePath(resource);
			return await invokeReadBinaryFile(filePath);
		} catch (error) {
			throw this.toFileSystemProviderError(error);
		} finally {
			lock?.dispose();
		}
	}

	private traceLock(msg: string): void {
		if (TauriFileSystemProvider.TRACE_LOG_RESOURCE_LOCKS) {
			this.logService.trace(msg);
		}
	}

	readFileStream(resource: URI, opts: IFileReadStreamOptions, token: CancellationToken): ReadableStreamEvents<Uint8Array> {
		const stream = newWriteableStream<Uint8Array>(data => VSBuffer.concat(data.map(data => VSBuffer.wrap(data))).buffer);

		readFileIntoStream(this, resource, stream, data => data, opts, token);

		return stream;
	}

	async writeFile(resource: URI, content: Uint8Array, opts: IFileWriteOptions): Promise<void> {
		try {
			const filePath = this.toFilePath(resource);

			// Validate target unless { create: true, overwrite: true }
			if (!opts.create || !opts.overwrite) {
				const fileExists = await invokeExists(filePath);
				if (fileExists) {
					if (!opts.overwrite) {
						throw createFileSystemProviderError(localize('fileExists', "File already exists"), FileSystemProviderErrorCode.FileExists);
					}
				} else {
					if (!opts.create) {
						throw createFileSystemProviderError(localize('fileNotExists', "File does not exist"), FileSystemProviderErrorCode.FileNotFound);
					}
				}
			}

			// For binary content, use binary write
			if (content.length > 0) {
				await invokeWriteBinaryFile(filePath, content);
			} else {
				// Empty content - create empty file
				await invokeWriteTextFile(filePath, '');
			}
		} catch (error) {
			throw await this.toFileSystemProviderWriteError(resource, error);
		}
	}

	private readonly writeHandles = new Map<number, URI>();

	async open(resource: URI, opts: IFileOpenOptions): Promise<number> {
		const filePath = this.toFilePath(resource);

		// Validate file exists for reading
		if (!isFileOpenForWriteOptions(opts)) {
			const exists = await invokeExists(filePath);
			if (!exists) {
				throw createFileSystemProviderError(localize('fileNotExists', "File does not exist"), FileSystemProviderErrorCode.FileNotFound);
			}
		}

		// Create file handle
		const fd = this.handleManager.createHandle(filePath, isFileOpenForWriteOptions(opts));

		// Remember that this handle was used for writing
		if (isFileOpenForWriteOptions(opts)) {
			this.writeHandles.set(fd, resource);
		}

		return fd;
	}

	async close(fd: number): Promise<void> {
		// Remove this handle from write handles
		this.writeHandles.delete(fd);

		// Close handle in manager
		this.handleManager.closeHandle(fd);
	}

	async read(fd: number, pos: number, data: Uint8Array, offset: number, length: number): Promise<number> {
		const handle = this.handleManager.getHandle(fd);
		if (!handle) {
			throw createFileSystemProviderError("Invalid file handle", FileSystemProviderErrorCode.Unknown);
		}

		try {
			// Read entire file and extract requested portion
			// This is a simplified implementation - in a full implementation,
			// you might want to implement streaming reads
			const fileContent = await invokeReadBinaryFile(handle.path);

			const startPos = Math.max(0, pos);
			const endPos = Math.min(fileContent.length, startPos + length);
			const bytesToCopy = Math.max(0, endPos - startPos);

			if (bytesToCopy > 0) {
				data.set(fileContent.subarray(startPos, endPos), offset);
			}

			this.handleManager.updatePosition(fd, startPos + bytesToCopy);
			return bytesToCopy;
		} catch (error) {
			throw this.toFileSystemProviderError(error);
		}
	}

	async write(fd: number, pos: number, data: Uint8Array, offset: number, length: number): Promise<number> {
		const handle = this.handleManager.getHandle(fd);
		if (!handle) {
			throw createFileSystemProviderError("Invalid file handle", FileSystemProviderErrorCode.Unknown);
		}

		try {
			// Read current file content
			let fileContent: Uint8Array;
			try {
				fileContent = await invokeReadBinaryFile(handle.path);
			} catch {
				fileContent = new Uint8Array(0);
			}

			// Calculate new content
			const dataToWrite = data.subarray(offset, offset + length);
			const newContent = new Uint8Array(Math.max(fileContent.length, pos + length));
			newContent.set(fileContent);
			newContent.set(dataToWrite, pos);

			// Write back to file
			await invokeWriteBinaryFile(handle.path, newContent);

			this.handleManager.updatePosition(fd, pos + length);
			return length;
		} catch (error) {
			throw await this.toFileSystemProviderWriteError(this.writeHandles.get(fd), error);
		}
	}

	//#endregion

	//#region Move/Copy/Delete/Create Folder

	async mkdir(resource: URI): Promise<void> {
		try {
			await invokeCreateDir(this.toFilePath(resource));
		} catch (error) {
			throw this.toFileSystemProviderError(error);
		}
	}

	async delete(resource: URI, opts: IFileDeleteOptions): Promise<void> {
		try {
			const filePath = this.toFilePath(resource);

			if (opts.recursive) {
				await invokeRemoveDirAll(filePath);
			} else {
				// Try to remove as file first, then as directory
				try {
					await invokeRemoveFile(filePath);
				} catch {
					await invokeRemoveDir(filePath);
				}
			}
		} catch (error) {
			throw this.toFileSystemProviderError(error);
		}
	}

	async rename(from: URI, to: URI, opts: IFileOverwriteOptions): Promise<void> {
		const fromFilePath = this.toFilePath(from);
		const toFilePath = this.toFilePath(to);

		if (fromFilePath === toFilePath) {
			return; // simulate node.js behaviour here and do a no-op if paths match
		}

		try {
			// Validate the move operation can perform
			await this.validateMoveCopy(from, to, 'move', opts.overwrite);

			// Rename
			await invokeRename(fromFilePath, toFilePath, { overwrite: opts.overwrite });
		} catch (error) {
			throw this.toFileSystemProviderError(error);
		}
	}

	async copy(from: URI, to: URI, opts: IFileOverwriteOptions): Promise<void> {
		const fromFilePath = this.toFilePath(from);
		const toFilePath = this.toFilePath(to);

		if (fromFilePath === toFilePath) {
			return; // simulate node.js behaviour here and do a no-op if paths match
		}

		try {
			// Validate the copy operation can perform
			await this.validateMoveCopy(from, to, 'copy', opts.overwrite);

			// Check if source is directory
			const fromMetadata = await invokeMetadata(fromFilePath);
			if (fromMetadata.is_dir) {
				await invokeCopyDirAtomic(fromFilePath, toFilePath);
			} else {
				await invokeCopyFile(fromFilePath, toFilePath, { overwrite: opts.overwrite });
			}
		} catch (error) {
			throw this.toFileSystemProviderError(error);
		}
	}

	private async validateMoveCopy(from: URI, to: URI, mode: 'move' | 'copy', overwrite?: boolean): Promise<void> {
		const fromFilePath = this.toFilePath(from);
		const toFilePath = this.toFilePath(to);

		let isSameResourceWithDifferentPathCase = false;
		const isPathCaseSensitive = !!(this.capabilities & FileSystemProviderCapabilities.PathCaseSensitive);
		if (!isPathCaseSensitive) {
			isSameResourceWithDifferentPathCase = fromFilePath.toLowerCase() === toFilePath.toLowerCase();
		}

		if (isSameResourceWithDifferentPathCase) {
			// You cannot copy the same file to the same location with different
			// path case unless you are on a case sensitive file system
			if (mode === 'copy') {
				throw createFileSystemProviderError(localize('fileCopyErrorPathCase', "File cannot be copied to same path with different path case"), FileSystemProviderErrorCode.FileExists);
			}
			else if (mode === 'move') {
				return;
			}
		}

		// Here we have to see if the target to move/copy to exists or not.
		// We need to respect the `overwrite` option to throw in case the
		// target exists.

		const fromExists = await invokeExists(fromFilePath);
		if (!fromExists) {
			throw createFileSystemProviderError(localize('fileMoveCopyErrorNotFound', "File to move/copy does not exist"), FileSystemProviderErrorCode.FileNotFound);
		}

		const toExists = await invokeExists(toFilePath);
		if (toExists && !overwrite) {
			throw createFileSystemProviderError(localize('fileMoveCopyErrorExists', "File at target already exists and thus will not be moved/copied to unless overwrite is specified"), FileSystemProviderErrorCode.FileExists);
		}
	}

	//#endregion

	//#region Clone File

	async cloneFile(from: URI, to: URI): Promise<void> {
		return this.doCloneFile(from, to, false /* optimistically assume parent folders exist */);
	}

	private async doCloneFile(from: URI, to: URI, mkdir: boolean): Promise<void> {
		const fromFilePath = this.toFilePath(from);
		const toFilePath = this.toFilePath(to);

		const isPathCaseSensitive = !!(this.capabilities & FileSystemProviderCapabilities.PathCaseSensitive);
		if (fromFilePath === toFilePath || (!isPathCaseSensitive && fromFilePath.toLowerCase() === toFilePath.toLowerCase())) {
			return; // cloning is only supported `from` and `to` are different files
		}

		// Implement clone by using copy
		const locks = new DisposableStore();

		try {
			locks.add(await this.createResourceLock(from));
			locks.add(await this.createResourceLock(to));

			if (mkdir) {
				await invokeCreateDir(dirname(toFilePath));
			}

			await invokeCopyFile(fromFilePath, toFilePath, { overwrite: true });
		} catch (error) {
			if (error.message.includes('ENOENT') && !mkdir) {
				return this.doCloneFile(from, to, true);
			}

			throw this.toFileSystemProviderError(error);
		} finally {
			locks.dispose();
		}
	}

	//#endregion

	//#region File Watching

	protected createUniversalWatcher(
		onChange: (changes: IFileChange[]) => void,
		onLogMessage: (msg: ILogMessage) => void,
		verboseLogging: boolean
	): AbstractUniversalWatcherClient {
		// TODO: Implement Tauri-based file watching
		// For now, return a no-op watcher
		return {
			setVerboseLogging: () => {},
			setRoots: () => {},
			stop: () => {},
			dispose: () => {}
		} as any;
	}

	protected createNonRecursiveWatcher(
		onChange: (changes: IFileChange[]) => void,
		onLogMessage: (msg: ILogMessage) => void,
		verboseLogging: boolean
	): AbstractNonRecursiveWatcherClient {
		// TODO: Implement Tauri-based file watching
		// For now, return a no-op watcher
		return {
			setVerboseLogging: () => {},
			setRoots: () => {},
			stop: () => {},
			dispose: () => {}
		} as any;
	}

	//#endregion

	//#region Helpers

	private toFileSystemProviderError(error: any): FileSystemProviderError {
		if (error instanceof FileSystemProviderError) {
			return error; // avoid double conversion
		}

		let resultError: Error | string = error;
		let code: FileSystemProviderErrorCode;

		// Extract message from error (could be string or object with message)
		const message: string = typeof error === 'string' ? error : (error?.message || '');

		// Pattern-match on known substrings from Rust Tauri error messages
		if (message.includes('No such file') || message.includes('does not exist')) {
			code = FileSystemProviderErrorCode.FileNotFound;
		} else if (message.includes("Destination '") && message.includes("' already exists")) {
			code = FileSystemProviderErrorCode.FileExists;
		} else if (message.includes('Permission denied') || message.includes('Access is denied')) {
			code = FileSystemProviderErrorCode.NoPermissions;
		} else if (message.includes('Is a directory')) {
			code = FileSystemProviderErrorCode.FileIsADirectory;
		} else if (message.includes('Not a directory')) {
			code = FileSystemProviderErrorCode.FileNotADirectory;
		} else {
			code = FileSystemProviderErrorCode.Unknown;
		}

		return createFileSystemProviderError(resultError, code);
	}

	private async toFileSystemProviderWriteError(resource: URI | undefined, error: any): Promise<FileSystemProviderError> {
		let fileSystemProviderWriteError = this.toFileSystemProviderError(error);

		// If the write error signals permission issues, we try
		// to read the file's mode to see if the file is write
		// locked.
		if (resource && fileSystemProviderWriteError.code === FileSystemProviderErrorCode.NoPermissions) {
			try {
				const metadata = await invokeMetadata(this.toFilePath(resource));
				if (metadata.readonly) {
					fileSystemProviderWriteError = createFileSystemProviderError(error, FileSystemProviderErrorCode.FileWriteLocked);
				}
			} catch (error) {
				this.logService.trace(error); // ignore - return original error
			}
		}

		return fileSystemProviderWriteError;
	}

	//#endregion
}

// =============================================================================
// PATH NORMALIZATION UTILITIES
// =============================================================================

/**
 * Normalize file paths for Tauri backend
 */
export class TauriPathNormalizer {
	/**
	 * Normalize a URI to file path for Tauri backend
	 */
	static toFilePath(resource: URI): string {
		return resource.fsPath;
	}

	/**
	 * Convert file path back to URI
	 */
	static toURI(filePath: string): URI {
		return URI.file(filePath);
	}

	/**
	 * Check if path is absolute
	 */
	static isAbsolute(path: string): boolean {
		return path.startsWith('/') || (isWindows && /^[a-zA-Z]:/.test(path));
	}

	/**
	 * Normalize path separators to current platform
	 */
	static normalizeSeparators(path: string): string {
		if (isWindows) {
			return path.replace(/\//g, '\\');
		} else {
			return path.replace(/\\/g, '/');
		}
	}

	/**
	 * Join paths using platform-specific separator
	 */
	static join(...paths: string[]): string {
		return join(...paths);
	}

	/**
	 * Get directory name from path
	 */
	static dirname(path: string): string {
		return dirname(path);
	}

	/**
	 * Get base name from path
	 */
	static basename(path: string): string {
		return basename(path);
	}
}

// =============================================================================
// ERROR HANDLING
// =============================================================================

/**
 * Enhanced error handling for Tauri filesystem operations
 */
export class TauriFileSystemError extends Error {
	constructor(
		message: string,
		public readonly code: string,
		public readonly path?: string
	) {
		super(message);
		this.name = 'TauriFileSystemError';
	}
}

/**
 * Convert Tauri error to filesystem provider error
 */
export function convertTauriError(error: any, path?: string): FileSystemProviderError {
	if (error instanceof TauriFileSystemError) {
		return createFileSystemProviderError(error.message, getErrorCode(error.code));
	}

	// Handle string errors from Tauri
	if (typeof error === 'string') {
		return createFileSystemProviderError(error, FileSystemProviderErrorCode.Unknown);
	}

	// Handle object errors
	if (error && typeof error === 'object') {
		const message = error.message || 'Unknown error';
		const code = getErrorCode(error.code || 'UNKNOWN');
		return createFileSystemProviderError(message, code);
	}

	return createFileSystemProviderError('Unknown error', FileSystemProviderErrorCode.Unknown);
}

/**
 * Convert error code string to FileSystemProviderErrorCode
 */
function getErrorCode(code: string): FileSystemProviderErrorCode {
	switch (code) {
		case 'ENOENT':
			return FileSystemProviderErrorCode.FileNotFound;
		case 'EEXIST':
			return FileSystemProviderErrorCode.FileExists;
		case 'EISDIR':
			return FileSystemProviderErrorCode.FileIsADirectory;
		case 'ENOTDIR':
			return FileSystemProviderErrorCode.FileNotADirectory;
		case 'EPERM':
		case 'EACCES':
			return FileSystemProviderErrorCode.NoPermissions;
		default:
			return FileSystemProviderErrorCode.Unknown;
	}
}