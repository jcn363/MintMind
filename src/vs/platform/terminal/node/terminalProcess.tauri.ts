/* ---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { UnlistenFn, invoke, listen } from '@tauri-apps/api/core';
import { Emitter } from '../../../base/common/event.js';
import { Disposable } from '../../../base/common/lifecycle.js';
import { crypto } from '../../../base/node/crypto.js';
import { ILogService } from '../../log/common/log.js';
import { IProductService } from '../../product/common/productService.js';
import { FlowControlConstants, GeneralShellType, IProcessProperty, IProcessPropertyMap, IProcessReadyEvent, IShellLaunchConfig, ITerminalChildProcess, ITerminalLaunchError, ITerminalLaunchResult, ITerminalProcessOptions, PosixShellType, ProcessPropertyType } from '../common/terminal.js';
import { IShellIntegrationConfigInjection, getShellIntegrationInjection } from './terminalEnvironment.js';

const posixShellTypeMap = new Map<string, PosixShellType>([
	['bash', PosixShellType.Bash],
	['csh', PosixShellType.Csh],
	['fish', PosixShellType.Fish],
	['ksh', PosixShellType.Ksh],
	['sh', PosixShellType.Sh],
	['zsh', PosixShellType.Zsh],
]);

const generalShellTypeMap = new Map<string, GeneralShellType>([
	['pwsh', GeneralShellType.PowerShell],
	['powershell', GeneralShellType.PowerShell],
	['python', GeneralShellType.Python],
	['julia', GeneralShellType.Julia],
	['nu', GeneralShellType.NuShell],
	['node', GeneralShellType.Node],
]);

export class TauriTerminalProcess extends Disposable implements ITerminalChildProcess {
	readonly id = 0;
	readonly shouldPersist = false;

	private _ptyId: string;
	private _properties: IProcessPropertyMap = {
		cwd: '',
		initialCwd: '',
		fixedDimensions: { cols: undefined, rows: undefined },
		title: '',
		shellType: undefined,
		hasChildProcesses: true,
		resolvedShellLaunchConfig: {},
		overrideDimensions: undefined,
		failedShellIntegrationActivation: false,
		usedShellIntegrationInjection: undefined,
		shellIntegrationInjectionFailureReason: undefined,
	};
	private _exitCode: number | undefined;
	private _isPtyPaused: boolean = false;
	private _unacknowledgedCharCount: number = 0;
	private _initialCwd: string;
	private _eventListeners: UnlistenFn[] = [];

	private readonly _onProcessData = this._register(new Emitter<string>());
	readonly onProcessData = this._onProcessData.event;
	private readonly _onProcessReady = this._register(new Emitter<IProcessReadyEvent>());
	readonly onProcessReady = this._onProcessReady.event;
	private readonly _onDidChangeProperty = this._register(new Emitter<IProcessProperty>());
	readonly onDidChangeProperty = this._onDidChangeProperty.event;
	private readonly _onProcessExit = this._register(new Emitter<number>());
	readonly onProcessExit = this._onProcessExit.event;

	constructor(
		readonly shellLaunchConfig: IShellLaunchConfig,
		cwd: string,
		private readonly _env: { [key: string]: string },
		private readonly _options: ITerminalProcessOptions,
		@ILogService private readonly _logService: ILogService,
		@IProductService private readonly _productService: IProductService,
	) {
		super();
		this._ptyId = crypto.randomUUID();
		this._initialCwd = cwd;
		this._properties[ProcessPropertyType.InitialCwd] = this._initialCwd;
		this._properties[ProcessPropertyType.Cwd] = this._initialCwd;
		this._setupEventListeners();
	}

	private _setupEventListeners(): void {
		// Listen for data events from the PTY
		const dataUnlisten = listen<string>(`pty:data`, (event) => {
			const { ptyId, data } = JSON.parse(event.payload);
			if (ptyId !== this._ptyId) {
				return;
			}

			// Handle flow control
			this._unacknowledgedCharCount += data.length;
			if (!this._isPtyPaused && this._unacknowledgedCharCount > FlowControlConstants.HighWatermarkChars) {
				this._logService.trace(`Flow control: Pause (${this._unacknowledgedCharCount} > ${FlowControlConstants.HighWatermarkChars})`);
				this._isPtyPaused = true;
				// Note: Tauri backend handles pausing internally
			}

			this._onProcessData.fire(data);
		});
		this._eventListeners.push(dataUnlisten);

		// Listen for exit events
		const exitUnlisten = listen<{ ptyId: string; exitCode: number }>(`pty:exit`, (event) => {
			const { ptyId, exitCode } = event.payload;
			if (ptyId !== this._ptyId) {
				return;
			}
			this._exitCode = exitCode;
			this._onProcessExit.fire(exitCode);
		});
		this._eventListeners.push(exitUnlisten);

		// Listen for title changes
		const titleUnlisten = listen<{ ptyId: string; title: string }>(`pty:title-changed`, (event) => {
			const { ptyId, title } = event.payload;
			if (ptyId !== this._ptyId) {
				return;
			}
			this._onDidChangeProperty.fire({ type: ProcessPropertyType.Title, value: title });
		});
		this._eventListeners.push(titleUnlisten);

		// Listen for CWD changes
		const cwdUnlisten = listen<{ ptyId: string; cwd: string }>(`pty:cwd-changed`, (event) => {
			const { ptyId, cwd } = event.payload;
			if (ptyId !== this._ptyId) {
				return;
			}
			this._properties[ProcessPropertyType.Cwd] = cwd;
			this._onDidChangeProperty.fire({ type: ProcessPropertyType.Cwd, value: cwd });
		});
		this._eventListeners.push(cwdUnlisten);
	}

	async start(): Promise<ITerminalLaunchError | ITerminalLaunchResult | undefined> {
		try {
			// Prepare shell integration configuration
			const injection = await getShellIntegrationInjection(this.shellLaunchConfig, this._options, this._env, this._logService, this._productService);

			let shellIntegrationConfig: IShellIntegrationConfigInjection | undefined;
			if (injection.type === 'injection') {
				this._onDidChangeProperty.fire({ type: ProcessPropertyType.UsedShellIntegrationInjection, value: true });
				if (injection.envMixin) {
					// Merge environment variables
					Object.assign(this._env, injection.envMixin);
				}
				shellIntegrationConfig = injection;
			} else {
				this._onDidChangeProperty.fire({ type: ProcessPropertyType.FailedShellIntegrationActivation, value: true });
				this._onDidChangeProperty.fire({ type: ProcessPropertyType.ShellIntegrationInjectionFailureReason, value: injection.reason });
				// Even if shell integration injection failed, still set the nonce if one was provided
				if (this._options.shellIntegration.nonce) {
					this._env['MINTMIND_NONCE'] = this._options.shellIntegration.nonce;
				}
			}

			// Spawn the PTY process
			const spawnResult = await invoke<{ pid: number; cwd: string }>('pty_spawn', {
				ptyId: this._ptyId,
				shellLaunchConfig: {
					executable: this.shellLaunchConfig.executable,
					args: shellIntegrationConfig?.newArgs || this.shellLaunchConfig.args || [],
					cwd: this._initialCwd,
					env: this._env,
				},
			});

			// Fire process ready event
			this._onProcessReady.fire({
				pid: spawnResult.pid,
				cwd: spawnResult.cwd,
				windowsPty: undefined, // Tauri handles this internally
			});

			// Start data streaming
			await invoke('pty_start_data_stream', { ptyId: this._ptyId });

			// Return launch result if shell integration modified args
			if (shellIntegrationConfig?.newArgs) {
				return { injectedArgs: shellIntegrationConfig.newArgs };
			}

			return undefined;
		} catch (err) {
			this._logService.error('Failed to spawn Tauri PTY process', err);
			const message = err instanceof Error ? `A native exception occurred during launch (${err.message})` : 'Failed to spawn terminal process';
			return { message };
		}
	}

	input(data: string, isBinary: boolean = false): void {
		if (this._store.isDisposed) {
			return;
		}
		invoke('pty_write', {
			ptyId: this._ptyId,
			data,
			isBinary,
		}).catch(err => {
			this._logService.error('Failed to write to PTY', err);
		});
	}

	processBinary(data: string): Promise<void> {
		this.input(data, true);
		return Promise.resolve();
	}

	resize(cols: number, rows: number): void {
		if (this._store.isDisposed) {
			return;
		}
		if (typeof cols !== 'number' || typeof rows !== 'number' || isNaN(cols) || isNaN(rows)) {
			return;
		}
		// Ensure that cols and rows are always >= 1
		cols = Math.max(cols, 1);
		rows = Math.max(rows, 1);

		invoke('pty_resize', {
			ptyId: this._ptyId,
			cols,
			rows,
		}).catch(err => {
			this._logService.trace('Failed to resize PTY', err);
		});
	}

	sendSignal(signal: string): void {
		if (this._store.isDisposed) {
			return;
		}
		invoke('pty_kill', {
			ptyId: this._ptyId,
			signal,
		}).catch(err => {
			this._logService.error('Failed to send signal to PTY', err);
		});
	}

	shutdown(immediate: boolean): void {
		if (this._store.isDisposed) {
			return;
		}
		invoke('pty_shutdown', {
			ptyId: this._ptyId,
			immediate,
		}).catch(err => {
			this._logService.error('Failed to shutdown PTY', err);
		});
	}

	acknowledgeDataEvent(charCount: number): void {
		// Prevent lower than 0 to heal from errors
		this._unacknowledgedCharCount = Math.max(this._unacknowledgedCharCount - charCount, 0);
		this._logService.trace(`Flow control: Ack ${charCount} chars (unacknowledged: ${this._unacknowledgedCharCount})`);

		if (this._isPtyPaused && this._unacknowledgedCharCount < FlowControlConstants.LowWatermarkChars) {
			this._logService.trace(`Flow control: Resume (${this._unacknowledgedCharCount} < ${FlowControlConstants.LowWatermarkChars})`);
			this._isPtyPaused = false;
		}

		invoke('pty_acknowledge_data', {
			ptyId: this._ptyId,
			charCount,
		}).catch(err => {
			this._logService.error('Failed to acknowledge data', err);
		});
	}

	clearUnacknowledgedChars(): void {
		this._unacknowledgedCharCount = 0;
		this._logService.trace(`Flow control: Cleared all unacknowledged chars, forcing resume`);
		if (this._isPtyPaused) {
			this._isPtyPaused = false;
		}
		invoke('pty_clear_unacknowledged', {
			ptyId: this._ptyId,
		}).catch(err => {
			this._logService.error('Failed to clear unacknowledged chars', err);
		});
	}

	async getInitialCwd(): Promise<string> {
		return Promise.resolve(this._initialCwd);
	}

	async getCwd(): Promise<string> {
		try {
			const cwd = await invoke<string>('pty_get_cwd', { ptyId: this._ptyId });
			this._properties[ProcessPropertyType.Cwd] = cwd;
			return cwd;
		} catch (err) {
			this._logService.error('Failed to get CWD', err);
			return this._initialCwd;
		}
	}

	async refreshProperty<T extends ProcessPropertyType>(type: T): Promise<IProcessPropertyMap[T]> {
		switch (type) {
			case ProcessPropertyType.Cwd: {
				const newCwd = await this.getCwd();
				if (newCwd !== this._properties.cwd) {
					this._properties.cwd = newCwd;
					this._onDidChangeProperty.fire({ type: ProcessPropertyType.Cwd, value: this._properties.cwd });
				}
				return newCwd as IProcessPropertyMap[T];
			}
			case ProcessPropertyType.InitialCwd: {
				const initialCwd = await this.getInitialCwd();
				if (initialCwd !== this._properties.initialCwd) {
					this._properties.initialCwd = initialCwd;
					this._onDidChangeProperty.fire({ type: ProcessPropertyType.InitialCwd, value: this._properties.initialCwd });
				}
				return initialCwd as IProcessPropertyMap[T];
			}
			case ProcessPropertyType.Title: {
				try {
					const title = await invoke<string>('pty_get_title', { ptyId: this._ptyId });
					this._properties[ProcessPropertyType.Title] = title;
					this._onDidChangeProperty.fire({ type: ProcessPropertyType.Title, value: title });
					return title as IProcessPropertyMap[T];
				} catch (err) {
					this._logService.error('Failed to get title', err);
					return this._properties.title as IProcessPropertyMap[T];
				}
			}
			case ProcessPropertyType.ShellType: {
				try {
					const shellType = await invoke<string>('pty_get_shell_type', { ptyId: this._ptyId });
					const resolvedShellType = posixShellTypeMap.get(shellType) || generalShellTypeMap.get(shellType);
					this._properties[ProcessPropertyType.ShellType] = resolvedShellType;
					this._onDidChangeProperty.fire({ type: ProcessPropertyType.ShellType, value: resolvedShellType });
					return resolvedShellType as IProcessPropertyMap[T];
				} catch (err) {
					this._logService.error('Failed to get shell type', err);
					return this._properties.shellType as IProcessPropertyMap[T];
				}
			}
			default:
				return this._properties[type] as IProcessPropertyMap[T];
		}
	}

	async updateProperty<T extends ProcessPropertyType>(type: T, value: IProcessPropertyMap[T]): Promise<void> {
		switch (type) {
			case ProcessPropertyType.FixedDimensions:
				this._properties.fixedDimensions = value as IProcessPropertyMap[ProcessPropertyType.FixedDimensions];
				break;
			case ProcessPropertyType.OverrideDimensions:
				this._properties.overrideDimensions = value as IProcessPropertyMap[ProcessPropertyType.OverrideDimensions];
				break;
		}
	}

	clearBuffer(): void {
		// No-op: portable-pty doesn't support buffer clearing
		this._logService.trace('clearBuffer called but not supported by portable-pty');
	}

	async setUnicodeVersion(version: '6' | '11'): Promise<void> {
		// No-op: Unicode version is handled by the terminal renderer
	}

	async setNextCommandId(commandLine: string, commandId: string): Promise<void> {
		// No-op: command IDs are tracked on the renderer side
	}

	override dispose(): void {
		// Clean up event listeners
		this._eventListeners.forEach(unlisten => unlisten());
		this._eventListeners = [];
		super.dispose();
	}
}
