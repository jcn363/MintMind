/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { WebviewWindow, getCurrentWindow, getAllWindows } from '@tauri-apps/api/window';
import { invoke } from '@tauri-apps/api/tauri';
import { UnlistenFn, listen } from '@tauri-apps/api/event';
import { DeferredPromise, RunOnceScheduler, timeout, Delayer } from '../../../base/common/async.js';
import { CancellationToken } from '../../../base/common/cancellation.js';
import { toErrorMessage } from '../../../base/common/errorMessage.js';
import { Emitter, Event } from '../../../base/common/event.js';
import { Disposable, DisposableStore, IDisposable, MutableDisposable, toDisposable } from '../../../base/common/lifecycle.js';
import { FileAccess, Schemas } from '../../../base/common/network.js';
import { getMarks, mark } from '../../../base/common/performance.js';
import { isBigSurOrNewer, isLinux, isMacintosh, isWindows } from '../../../base/common/platform.js';
import { URI } from '../../../base/common/uri.js';
import { localize } from '../../../nls.js';
import { release } from 'os';
import { ISerializableCommandAction } from '../../action/common/action.js';
import { IBackupMainService } from '../../backup/electron-main/backup.js';
import { IConfigurationChangeEvent, IConfigurationService } from '../../configuration/common/configuration.js';
import { IDialogMainService } from '../../dialogs/electron-main/dialogMainService.js';
import { NativeParsedArgs } from '../../environment/common/argv.js';
import { IEnvironmentMainService } from '../../environment/electron-main/environmentMainService.js';
import { isLaunchedFromCli } from '../../environment/node/argvHelper.js';
import { IFileService } from '../../files/common/files.js';
import { ILifecycleMainService } from '../../lifecycle/electron-main/lifecycleMainService.js';
import { ILogService } from '../../log/common/log.js';
import { IProductService } from '../../product/common/productService.js';
import { IIPCObjectUrl, IProtocolMainService } from '../../protocol/electron-main/protocol.js';
import { resolveMarketplaceHeaders } from '../../externalServices/common/marketplace.js';
import { IApplicationStorageMainService, IStorageMainService } from '../../storage/electron-main/storageMainService.js';
import { ITelemetryService } from '../../telemetry/common/telemetry.js';
import { ThemeIcon } from '../../../base/common/themables.js';
import { IThemeMainService } from '../../theme/electron-main/themeMainService.js';
import { getMenuBarVisibility, IFolderToOpen, INativeWindowConfiguration, IWindowSettings, IWorkspaceToOpen, MenuBarVisibility, hasNativeTitlebar, useNativeFullScreen, useWindowControlsOverlay, DEFAULT_CUSTOM_TITLEBAR_HEIGHT, TitlebarStyle, MenuSettings } from '../../window/common/window.js';
import { defaultBrowserWindowOptions, getAllWindowsExcludingOffscreen, IWindowsMainService, OpenContext, WindowStateValidator } from './windows.js';
import { ISingleFolderWorkspaceIdentifier, IWorkspaceIdentifier, isSingleFolderWorkspaceIdentifier, isWorkspaceIdentifier, toWorkspaceIdentifier } from '../../workspace/common/workspace.js';
import { IWorkspacesManagementMainService } from '../../workspaces/electron-main/workspacesManagementMainService.js';
import { IWindowState, ICodeWindow, ILoadEvent, WindowMode, WindowError, LoadReason, defaultWindowState, IBaseWindow } from '../../window/electron-main/window.js';
import { IPolicyService } from '../../policy/common/policy.js';
import { IUserDataProfile } from '../../userDataProfile/common/userDataProfile.js';
import { IStateService } from '../../state/node/state.js';
import { IUserDataProfilesMainService } from '../../userDataProfile/electron-main/userDataProfile.js';
import { ILoggerMainService } from '../../log/electron-main/loggerService.js';
import { IInstantiationService } from '../../instantiation/common/instantiation.js';
import { VSBuffer } from '../../../base/common/buffer.js';
import { errorHandler } from '../../../base/common/errors.js';
import { FocusMode } from '../../native/common/native.js';

export interface IWindowCreationOptions {
	readonly state: IWindowState;
	readonly extensionDevelopmentPath?: string[];
	readonly isExtensionTestHost?: boolean;
}

interface ITouchBarSegment {
	readonly id: string;
	label?: string;
	icon?: any;
}

interface ILoadOptions {
	readonly isReload?: boolean;
	readonly disableExtensions?: boolean;
}

const enum ReadyState {

	/**
	 * This window has not loaded anything yet
	 * and this is the initial state of every
	 * window.
	 */
	NONE,

	/**
	 * This window is navigating, either for the
	 * first time or subsequent times.
	 */
	NAVIGATING,

	/**
	 * This window has finished loading and is ready
	 * to forward IPC requests to the web contents.
	 */
	READY
}

// Tauri-specific window state management
interface ITauriWindowState {
	label: string;
	isMinimized?: boolean;
	isMaximized?: boolean;
	isFullscreen?: boolean;
	isFocused?: boolean;
	isDecorated?: boolean;
	isVisible?: boolean;
	width?: number;
	height?: number;
	x?: number;
	y?: number;
	scaleFactor?: number;
}

interface ITauriWindowConfig {
	label: string;
	title?: string;
	width?: number;
	height?: number;
	x?: number;
	y?: number;
	minWidth?: number;
	minHeight?: number;
	maxWidth?: number;
	maxHeight?: number;
	resizable?: boolean;
	maximizable?: boolean;
	minimizable?: boolean;
	closable?: boolean;
	fullscreen?: boolean;
	center?: boolean;
	decorations?: boolean;
	alwaysOnTop?: boolean;
	skipTaskbar?: boolean;
	theme?: string;
	titleBarStyle?: string;
	transparent?: boolean;
	shadow?: boolean;
	parent?: string;
	url?: string;
}

interface WindowCreationResult {
	label: string;
	id: number;
}

// Simplified DockBadgeManager for Tauri
class DockBadgeManager {
	static readonly INSTANCE = new DockBadgeManager();
	private readonly windows = new Set<string>();

	acquireBadge(window: IBaseWindow): IDisposable {
		this.windows.add(window.id.toString());
		return {
			dispose: () => {
				this.windows.delete(window.id.toString());
			}
		};
	}
}

export abstract class TauriBaseWindow extends Disposable implements IBaseWindow {
	//#region Events
	private readonly _onDidClose = this._register(new Emitter<void>());
	readonly onDidClose = this._onDidClose.event;

	private readonly _onDidMaximize = this._register(new Emitter<void>());
	readonly onDidMaximize = this._onDidMaximize.event;

	private readonly _onDidUnmaximize = this._register(new Emitter<void>());
	readonly onDidUnmaximize = this._onDidUnmaximize.event;

	private readonly _onDidTriggerSystemContextMenu = this._register(new Emitter<{ x: number; y: number }>());
	readonly onDidTriggerSystemContextMenu = this._onDidTriggerSystemContextMenu.event;

	private readonly _onDidEnterFullScreen = this._register(new Emitter<void>());
	readonly onDidEnterFullScreen = this._onDidEnterFullScreen.event;

	private readonly _onDidLeaveFullScreen = this._register(new Emitter<void>());
	readonly onDidLeaveFullScreen = this._onDidLeaveFullScreen.event;

	private readonly _onDidChangeAlwaysOnTop = this._register(new Emitter<boolean>());
	readonly onDidChangeAlwaysOnTop = this._onDidChangeAlwaysOnTop.event;
	//#endregion

	abstract readonly id: number;
	protected _lastFocusTime = Date.now();
	get lastFocusTime(): number { return this._lastFocusTime; }

	private maximizedWindowState: IWindowState | undefined;
	protected _win: WebviewWindow | null = null;
	get win() { return this._win; }

	protected setWin(win: WebviewWindow): void {
		this._win = win;
		this.setupEventListeners();
	}

	private setupEventListeners(): void {
		if (!this._win) return;
		const win = this._win;

		this._register(this.listenToWindowEvent('tauri://close-requested', () => {
			this._onDidClose.fire();
			this.dispose();
		}));

		this._register(this.listenToWindowEvent('tauri://focus', () => {
			this.clearNotifyFocus();
			this._lastFocusTime = Date.now();
		}));

		this._register(this.listenToWindowEvent('tauri://blur', () => {}));

		this._register(this.listenToWindowEvent('tauri://window-fullscreen-enter', () => {
			this._onDidEnterFullScreen.fire();
		}));

		this._register(this.listenToWindowEvent('tauri://window-fullscreen-exit', () => {
			this._onDidLeaveFullScreen.fire();
		}));

		this._register(this.listenToWindowEvent('tauri://resize', async () => {
			const isMaximized = await win.isMaximized().catch(() => false);
			if (isMaximized) {
				this._onDidMaximize.fire();
			} else {
				this._onDidUnmaximize.fire();
			}
		}));

		this._register(this.listenToWindowEvent('tauri://window-always-on-top-changed', (event) => {
			const alwaysOnTop = (event.payload as any)?.alwaysOnTop ?? false;
			this._onDidChangeAlwaysOnTop.fire(alwaysOnTop);
		}));
	}

	private listenToWindowEvent(event: string, handler: (event: any) => void): IDisposable {
		let unlisten: UnlistenFn | undefined;
		listen(event, handler).then((fn) => {
			unlisten = fn;
		}).catch((err) => {
			this.logService?.error(`Failed to listen to window event ${event}:`, err);
		});

		return toDisposable(() => {
			if (unlisten) {
				unlisten();
			}
		});
	}

	constructor(
		protected readonly configurationService: IConfigurationService,
		protected readonly stateService: IStateService,
		protected readonly environmentMainService: IEnvironmentMainService,
		protected readonly logService: ILogService
	) {
		super();
	}

	protected async applyState(state: IWindowState, hasMultipleDisplays = true): Promise<void> {
		if (!this._win) return;

		try {
			if (state.mode === WindowMode.Maximized || state.mode === WindowMode.Fullscreen) {
				await this._win.maximize();
				if (state.mode === WindowMode.Fullscreen) {
					this.setFullScreen(true, true);
				}
				await this._win.show();
			} else if ([state.width, state.height, state.x, state.y].every(value => typeof value === 'number')) {
				await this._win.setSize({ width: state.width!, height: state.height! });
				await this._win.setPosition({ x: state.x!, y: state.y! });
			}
		} catch (error) {
			this.logService?.error('Failed to apply window state:', error);
		}
	}

	private representedFilename: string | undefined;

	setRepresentedFilename(filename: string): void {
		this.representedFilename = filename;
	}

	getRepresentedFilename(): string | undefined {
		return this.representedFilename;
	}

	private documentEdited: boolean | undefined;

	setDocumentEdited(edited: boolean): void {
		this.documentEdited = edited;
	}

	isDocumentEdited(): boolean {
		return !!this.documentEdited;
	}

	async focus(options?: { mode: FocusMode }): Promise<void> {
		switch (options?.mode ?? FocusMode.Transfer) {
			case FocusMode.Transfer:
				await this.doFocusWindow();
				break;
			case FocusMode.Notify:
				this.showNotifyFocus();
				break;
			case FocusMode.Force:
				await this.doFocusWindow();
				break;
		}
	}

	private readonly notifyFocusDisposable = this._register(new MutableDisposable());

	private showNotifyFocus(): void {
		const disposables = new DisposableStore();
		this.notifyFocusDisposable.value = disposables;

		if (this as any) {
			disposables.add(DockBadgeManager.INSTANCE.acquireBadge(this as any));
		}
	}

	private clearNotifyFocus(): void {
		this.notifyFocusDisposable.clear();
	}

	private async doFocusWindow(): Promise<void> {
		const win = this.win;
		if (!win) return;

		try {
			const isMinimized = await win.isMinimized().catch(() => false);
			if (isMinimized) {
				await win.unminimize();
			}
			await win.setFocus();
		} catch (error) {
			this.logService?.error('Failed to focus window:', error);
		}
	}

	private static readonly windowControlHeightStateStorageKey = 'windowControlHeight';

	async updateWindowControls(options: { height?: number; backgroundColor?: string; foregroundColor?: string }): Promise<void> {
		const win = this.win;
		if (!win) return;

		if (options.height) {
			this.stateService.setItem(TauriCodeWindow.windowControlHeightStateStorageKey, options.height);
		}
		// Simplified for Tauri - window controls are handled differently
	}

	toggleFullScreen(): void {
		this.setFullScreen(!this.isFullScreen, false);
	}

	protected async setFullScreen(fullscreen: boolean, fromRestore: boolean): Promise<void> {
		if (useNativeFullScreen(this.configurationService)) {
			await this.setNativeFullScreen(fullscreen, fromRestore);
		} else {
			await this.setSimpleFullScreen(fullscreen);
		}
	}

	get isFullScreen(): boolean {
		if (isMacintosh && typeof (this as any).transientIsNativeFullScreen === 'boolean') {
			return (this as any).transientIsNativeFullScreen;
		}
		// Async check would be needed in practice
		return false;
	}

	private transientIsNativeFullScreen: boolean | undefined;
	private joinNativeFullScreenTransition: DeferredPromise<boolean> | undefined;

	private async setNativeFullScreen(fullscreen: boolean, fromRestore: boolean): Promise<void> {
		if (!this._win) return;

		try {
			await this._win.setFullscreen(fullscreen);
			this.transientIsNativeFullScreen = fullscreen;

			if (isMacintosh) {
				const joinNativeFullScreenTransition = this.joinNativeFullScreenTransition = new DeferredPromise<boolean>();
				(async () => {
					const transitioned = await Promise.race([
						joinNativeFullScreenTransition.p,
						timeout(10000).then(() => false)
					]);

					if (this.joinNativeFullScreenTransition !== joinNativeFullScreenTransition) {
						return;
					}

					this.transientIsNativeFullScreen = undefined;
					this.joinNativeFullScreenTransition = undefined;
				})();
			}
		} catch (error) {
			this.logService?.error('Failed to set native fullscreen:', error);
		}
	}

	private async setSimpleFullScreen(fullscreen: boolean): Promise<void> {
		if (!this._win) return;

		try {
			if (await this._win.isFullscreen()) {
				await this.setNativeFullScreen(false, false);
			}
			await this._win.setFullscreen(fullscreen);
		} catch (error) {
			this.logService?.error('Failed to set simple fullscreen:', error);
		}
	}

	abstract matches(webContents: any): boolean;

	override dispose(): void {
		super.dispose();
		this._win = null!;
	}
}

export class TauriCodeWindow extends TauriBaseWindow implements ICodeWindow {
	//#region Events
	private readonly _onWillLoad = this._register(new Emitter<ILoadEvent>());
	readonly onWillLoad = this._onWillLoad.event;

	private readonly _onDidSignalReady = this._register(new Emitter<void>());
	readonly onDidSignalReady = this._onDidSignalReady.event;

	private readonly _onDidDestroy = this._register(new Emitter<void>());
	readonly onDidDestroy = this._onDidDestroy.event;
	//#endregion

	//#region Properties
	private _id: number;
	get id(): number { return this._id; }

	protected override _win: WebviewWindow;

	get backupPath(): string | undefined { return this._config?.backupPath; }

	get openedWorkspace(): IWorkspaceIdentifier | ISingleFolderWorkspaceIdentifier | undefined { return this._config?.workspace; }

	get profile(): IUserDataProfile | undefined {
		if (!this.config) {
			return undefined;
		}

		const profile = this.userDataProfilesService.profiles.find(profile => profile.id === this.config?.profiles.profile.id);
		if (this.isExtensionDevelopmentHost && profile) {
			return profile;
		}

		return this.userDataProfilesService.getProfileForWorkspace(this.config.workspace ?? toWorkspaceIdentifier(this.backupPath, this.isExtensionDevelopmentHost)) ?? this.userDataProfilesService.defaultProfile;
	}

	get remoteAuthority(): string | undefined { return this._config?.remoteAuthority; }

	private _config: INativeWindowConfiguration | undefined;
	get config(): INativeWindowConfiguration | undefined { return this._config; }

	get isExtensionDevelopmentHost(): boolean { return !!(this._config?.extensionDevelopmentPath); }

	get isExtensionTestHost(): boolean { return !!(this._config?.extensionTestsPath); }

	get isExtensionDevelopmentTestFromCli(): boolean { return this.isExtensionDevelopmentHost && this.isExtensionTestHost && !this._config?.debugId; }
	//#endregion

	private readonly windowState: IWindowState;
	private currentMenuBarVisibility: MenuBarVisibility | undefined;
	private readonly whenReadyCallbacks: { (window: ICodeWindow): void }[] = [];
	private readonly touchBarGroups: ITouchBarSegment[][] = [];
	private currentHttpProxy: string | undefined = undefined;
	private currentNoProxy: string | undefined = undefined;
	private customZoomLevel: number | undefined = undefined;
	private readonly configObjectUrl: IIPCObjectUrl<INativeWindowConfiguration>;
	private pendingLoadConfig: INativeWindowConfiguration | undefined;
	private wasLoaded = false;
	private readonly jsCallStackMap: Map<string, number>;
	private readonly jsCallStackEffectiveSampleCount: number;
	private readonly jsCallStackCollector: Delayer<void>;
	private readonly jsCallStackCollectorStopScheduler: RunOnceScheduler;

	constructor(
		config: IWindowCreationOptions,
		@ILogService logService: ILogService,
		@ILoggerMainService private readonly loggerMainService: ILoggerMainService,
		@IEnvironmentMainService environmentMainService: IEnvironmentMainService,
		@IPolicyService private readonly policyService: IPolicyService,
		@IUserDataProfilesMainService private readonly userDataProfilesService: IUserDataProfilesMainService,
		@IFileService private readonly fileService: IFileService,
		@IApplicationStorageMainService private readonly applicationStorageMainService: IApplicationStorageMainService,
		@IStorageMainService private readonly storageMainService: IStorageMainService,
		@IConfigurationService configurationService: IConfigurationService,
		@IThemeMainService private readonly themeMainService: IThemeMainService,
		@IWorkspacesManagementMainService private readonly workspacesManagementMainService: IWorkspacesManagementMainService,
		@IBackupMainService private readonly backupMainService: IBackupMainService,
		@ITelemetryService private readonly telemetryService: ITelemetryService,
		@IDialogMainService private readonly dialogMainService: IDialogMainService,
		@ILifecycleMainService private readonly lifecycleMainService: ILifecycleMainService,
		@IProductService private readonly productService: IProductService,
		@IProtocolMainService protocolMainService: IProtocolMainService,
		@IWindowsMainService private readonly windowsMainService: IWindowsMainService,
		@IStateService stateService: IStateService,
		@IInstantiationService instantiationService: IInstantiationService
	) {
		super(configurationService, stateService, environmentMainService, logService);

		this.configObjectUrl = this._register(protocolMainService.createIPCObjectUrl<INativeWindowConfiguration>());
		const [state, hasMultipleDisplays] = this.restoreWindowState(config.state);
		this.windowState = state;
		this.logService.trace('window#ctor: using window state', state);

		this.createTauriWindow(state, hasMultipleDisplays);
		this._lastFocusTime = Date.now();

		let sampleInterval = parseInt(this.environmentMainService.args['unresponsive-sample-interval'] || '1000');
		let samplePeriod = parseInt(this.environmentMainService.args['unresponsive-sample-period'] || '15000');
		if (sampleInterval <= 0 || samplePeriod <= 0 || sampleInterval > samplePeriod) {
			this.logService.warn(`Invalid unresponsive sample interval (${sampleInterval}ms) or period (${samplePeriod}ms), using defaults.`);
			sampleInterval = 1000;
			samplePeriod = 15000;
		}

		this.jsCallStackMap = new Map<string, number>();
		this.jsCallStackEffectiveSampleCount = Math.round(samplePeriod / sampleInterval);
		this.jsCallStackCollector = this._register(new Delayer<void>(sampleInterval));
		this.jsCallStackCollectorStopScheduler = this._register(new RunOnceScheduler(() => {
			this.stopCollectingJScallStacks();
		}, samplePeriod));

		this.onConfigurationUpdated();
		this.registerListeners();
	}

	private async createTauriWindow(state: IWindowState, hasMultipleDisplays: boolean): Promise<void> {
		try {
			const windowConfig: ITauriWindowConfig = {
				label: `window-${Date.now()}`,
				title: this.productService.nameLong,
				width: state.width || 1024,
				height: state.height || 768,
				x: state.x,
				y: state.y,
				minWidth: 400,
				minHeight: 300,
				resizable: true,
				maximizable: true,
				minimizable: true,
				closable: true,
				center: !state.x && !state.y,
				decorations: true,
			};

			const result: WindowCreationResult = await invoke('create_window', { config: windowConfig });
			const { label, id } = result;
			this._win = await WebviewWindow.getByLabel(label);
			this._id = id;

			this.setWin(this._win);
			await this.applyState(this.windowState, hasMultipleDisplays);
			this._lastFocusTime = Date.now();
		} catch (error) {
			this.logService.error('Failed to create Tauri window:', error);
			throw error;
		}
	}

	private readyState = ReadyState.NONE;

	setReady(): void {
		this.logService.trace(`window#load: window reported ready (id: ${this._id})`);
		this.readyState = ReadyState.READY;

		while (this.whenReadyCallbacks.length) {
			this.whenReadyCallbacks.pop()!(this);
		}

		this._onDidSignalReady.fire();
	}

	ready(): Promise<ICodeWindow> {
		return new Promise<ICodeWindow>(resolve => {
			if (this.isReady) {
				return resolve(this);
			}
			this.whenReadyCallbacks.push(resolve);
		});
	}

	get isReady(): boolean {
		return this.readyState === ReadyState.READY;
	}

	get whenClosedOrLoaded(): Promise<void> {
		return new Promise<void>(resolve => {
			const closeListener = this.onDidClose(() => {
				closeListener.dispose();
				loadListener.dispose();
				resolve();
			});

			const loadListener = this.onWillLoad(() => {
				closeListener.dispose();
				loadListener.dispose();
				resolve();
			});
		});
	}

	private registerListeners(): void {
		this._register(this.onDidEnterFullScreen(() => {
			this.sendWhenReady('vscode:enterFullScreen', CancellationToken.None);
		}));

		this._register(this.onDidLeaveFullScreen(() => {
			this.sendWhenReady('vscode:leaveFullScreen', CancellationToken.None);
		}));

		this._register(this.configurationService.onDidChangeConfiguration(e => this.onConfigurationUpdated(e)));
		this._register(this.workspacesManagementMainService.onDidDeleteUntitledWorkspace(e => this.onDidDeleteUntitledWorkspace(e)));
	}

	private async onWindowError(error: string, details?: any): Promise<void> {
		switch (error) {
			case 'PROCESS_GONE':
				this.logService.error(`CodeWindow: renderer process gone (reason: ${details?.reason || '<unknown>'}, code: ${details?.code || '<unknown>'})`);
				break;
			case 'UNRESPONSIVE':
				this.logService.error('CodeWindow: detected unresponsive');
				break;
			case 'RESPONSIVE':
				this.logService.error('CodeWindow: recovered from unresponsive');
				break;
			case 'LOAD':
				this.logService.error(`CodeWindow: failed to load (reason: ${details?.reason || '<unknown>'}, code: ${details?.code || '<unknown>'})`);
				break;
		}

		this.telemetryService.publicLog2('windowerror', {
			type: error,
			reason: details?.reason,
			code: details?.code
		});

		switch (error) {
			case 'UNRESPONSIVE':
			case 'PROCESS_GONE':
				if (this.isExtensionDevelopmentTestFromCli) {
					this.lifecycleMainService.kill(1);
					return;
				}

				if (this.environmentMainService.args['enable-smoke-test-driver']) {
					await this.destroyWindow(false, false);
					this.lifecycleMainService.quit();
					return;
				}

				if (error === 'UNRESPONSIVE') {
					this.jsCallStackCollector.trigger(() => this.startCollectingJScallStacks());
					this.jsCallStackCollectorStopScheduler.schedule();

					const { response, checkboxChecked } = await this.dialogMainService.showMessageBox({
						type: 'warning',
						buttons: [
							localize({ key: 'reopen', comment: ['&& denotes a mnemonic'] }, "&&Reopen"),
							localize({ key: 'close', comment: ['&& denotes a mnemonic'] }, "&&Close"),
							localize({ key: 'wait', comment: ['&& denotes a mnemonic'] }, "&&Keep Waiting")
						],
						message: localize('appStalled', "The window is not responding"),
						detail: localize('appStalledDetail', "You can reopen or close the window or keep waiting."),
						checkboxLabel: this._config?.workspace ? localize('doNotRestoreEditors', "Don't restore editors") : undefined
					}, this._win);

					if (response !== 2) {
						const reopen = response === 0;
						this.stopCollectingJScallStacks();
						await this.destroyWindow(reopen, checkboxChecked);
					}
				} else if (error === 'PROCESS_GONE') {
					const { response, checkboxChecked } = await this.dialogMainService.showMessageBox({
						type: 'warning',
						buttons: [
							this._config?.workspace ? localize({ key: 'reopen', comment: ['&& denotes a mnemonic'] }, "&&Reopen") : localize({ key: 'newWindow', comment: ['&& denotes a mnemonic'] }, "&&New Window"),
							localize({ key: 'close', comment: ['&& denotes a mnemonic'] }, "&&Close")
						],
						message: localize('appGone', "The window terminated unexpectedly"),
						detail: this._config?.workspace ?
							localize('appGoneDetailWorkspace', "We are sorry for the inconvenience. You can reopen the window to continue where you left off.") :
							localize('appGoneDetailEmptyWindow', "We are sorry for the inconvenience. You can open a new empty window to start again."),
						checkboxLabel: this._config?.workspace ? localize('doNotRestoreEditors', "Don't restore editors") : undefined
					}, this._win);

					const reopen = response === 0;
					await this.destroyWindow(reopen, checkboxChecked);
				}
				break;
			case 'RESPONSIVE':
				this.stopCollectingJScallStacks();
				break;
		}
	}

	private async destroyWindow(reopen: boolean, skipRestoreEditors: boolean): Promise<void> {
		const workspace = this._config?.workspace;

		if (skipRestoreEditors && workspace) {
			try {
				const workspaceStorage = this.storageMainService.workspaceStorage(workspace);
				await workspaceStorage.init();
				workspaceStorage.delete('memento/workbench.parts.editor');
				await workspaceStorage.close();
			} catch (error) {
				this.logService.error(error);
			}
		}

		this._onDidDestroy.fire();

		try {
			if (reopen && this._config) {
				let uriToOpen: IWorkspaceToOpen | IFolderToOpen | undefined = undefined;
				let forceEmpty = undefined;
				if (isSingleFolderWorkspaceIdentifier(workspace)) {
					uriToOpen = { folderUri: workspace.uri };
				} else if (isWorkspaceIdentifier(workspace)) {
					uriToOpen = { workspaceUri: workspace.configPath };
				} else {
					forceEmpty = true;
				}

				const window = (await this.windowsMainService.open({
					context: OpenContext.API,
					userEnv: this._config.userEnv,
					cli: {
						...this.environmentMainService.args,
						_: []
					},
					urisToOpen: uriToOpen ? [uriToOpen] : undefined,
					forceEmpty,
					forceNewWindow: true,
					remoteAuthority: this.remoteAuthority
				})).at(0);
				window?.focus();
			}
		} finally {
			if (this._win) {
				await this._win.close();
			}
		}
	}

	private onDidDeleteUntitledWorkspace(workspace: IWorkspaceIdentifier): void {
		if (this._config?.workspace?.id === workspace.id) {
			this._config.workspace = undefined;
		}
	}

	private onConfigurationUpdated(e?: IConfigurationChangeEvent): void {
		if (!e || e.affectsConfiguration(MenuSettings.MenuBarVisibility)) {
			const newMenuBarVisibility = this.getMenuBarVisibility();
			if (newMenuBarVisibility !== this.currentMenuBarVisibility) {
				this.currentMenuBarVisibility = newMenuBarVisibility;
				this.setMenuBarVisibility(newMenuBarVisibility);
			}
		}

		if (!e || e.affectsConfiguration('http.proxy') || e.affectsConfiguration('http.noProxy')) {
			const inspect = this.configurationService.inspect<string>('http.proxy');
			let newHttpProxy = (inspect.userLocalValue || '').trim()
				|| (process.env['https_proxy'] || process.env['HTTPS_PROXY'] || process.env['http_proxy'] || process.env['HTTP_PROXY'] || '').trim();

			if (newHttpProxy?.indexOf('@') !== -1) {
				const uri = URI.parse(newHttpProxy!);
				const i = uri.authority.indexOf('@');
				if (i !== -1) {
					newHttpProxy = uri.with({ authority: uri.authority.substring(i + 1) })
						.toString();
				}
			}
			if (newHttpProxy?.endsWith('/')) {
				newHttpProxy = newHttpProxy.substr(0, newHttpProxy.length - 1);
			}

			const newNoProxy = (this.configurationService.getValue<string[]>('http.noProxy') || []).map((item) => item.trim()).join(',')
				|| (process.env['no_proxy'] || process.env['NO_PROXY'] || '').trim();

			if ((newHttpProxy || '').indexOf('@') === -1 && (newHttpProxy !== this.currentHttpProxy || newNoProxy !== this.currentNoProxy)) {
				this.currentHttpProxy = newHttpProxy;
				this.currentNoProxy = newNoProxy;
				// Tauri proxy handling is different
			}
		}
	}

	async addTabbedWindow(window: ICodeWindow): Promise<void> {
		// Tauri doesn't have tabbed windows like Electron on macOS
	}

	load(configuration: INativeWindowConfiguration, options: ILoadOptions = Object.create(null)): void {
		this.logService.trace(`window#load: attempt to load window (id: ${this._id})`);

		if (this.isDocumentEdited()) {
			if (!options.isReload || !this.backupMainService.isHotExitEnabled()) {
				this.setDocumentEdited(false);
			}
		}

		if (!options.isReload) {
			if (this.getRepresentedFilename()) {
				this.setRepresentedFilename('');
			}

			if (this._win) {
				this._win.setTitle(this.productService.nameLong).catch(err =>
					this.logService.error('Failed to set window title:', err)
				);
			}
		}

		this.updateConfiguration(configuration, options);

		if (this.readyState === ReadyState.NONE) {
			this._config = configuration;
		} else {
			this.pendingLoadConfig = configuration;
		}

		this.readyState = ReadyState.NAVIGATING;

		const wasLoaded = this.wasLoaded;
		this.wasLoaded = true;

		if (!this.environmentMainService.isBuilt && !this.environmentMainService.extensionTestsLocationURI) {
			this._register(new RunOnceScheduler(async () => {
				if (this._win && !(await this._win.isVisible().catch(() => true)) && !(await this._win.isMinimized().catch(() => false))) {
					await this._win.show().catch(err => this.logService.error('Failed to show window:', err));
					await this.focus({ mode: FocusMode.Force });
				}
			}, 10000)).schedule();
		}

		this._onWillLoad.fire({ workspace: configuration.workspace, reason: options.isReload ? LoadReason.RELOAD : wasLoaded ? LoadReason.LOAD : LoadReason.INITIAL });
	}

	private updateConfiguration(configuration: INativeWindowConfiguration, options: ILoadOptions): void {
		const currentUserEnv = (this._config ?? this.pendingLoadConfig)?.userEnv;
		if (currentUserEnv) {
			const shouldPreserveLaunchCliEnvironment = isLaunchedFromCli(currentUserEnv) && !isLaunchedFromCli(configuration.userEnv);
			const shouldPreserveDebugEnvironmnet = this.isExtensionDevelopmentHost;
			if (shouldPreserveLaunchCliEnvironment || shouldPreserveDebugEnvironmnet) {
				configuration.userEnv = { ...currentUserEnv, ...configuration.userEnv };
			}
		}

		if (options.disableExtensions !== undefined) {
			configuration['disable-extensions'] = options.disableExtensions;
		}

		configuration.fullscreen = this.isFullScreen;
		configuration.maximized = false;
		configuration.partsSplash = this.themeMainService.getWindowSplash(configuration.workspace);
		configuration.zoomLevel = this.getZoomLevel();
		configuration.isCustomZoomLevel = typeof this.customZoomLevel === 'number';
		if (configuration.isCustomZoomLevel && configuration.partsSplash) {
			configuration.partsSplash.zoomLevel = configuration.zoomLevel;
		}

		mark('code/willOpenNewWindow');
		configuration.perfMarks = getMarks();

		this.configObjectUrl.update(configuration);
	}

	async reload(cli?: NativeParsedArgs): Promise<void> {
		const configuration = Object.assign({}, this._config);
		configuration.workspace = await this.validateWorkspaceBeforeReload(configuration);

		delete configuration.filesToOpenOrCreate;
		delete configuration.filesToDiff;
		delete configuration.filesToMerge;
		delete configuration.filesToWait;

		if (this.isExtensionDevelopmentHost && cli) {
			configuration.verbose = cli.verbose;
			configuration.debugId = cli.debugId;
			configuration.extensionEnvironment = cli.extensionEnvironment;
			configuration['inspect-extensions'] = cli['inspect-extensions'];
			configuration['inspect-brk-extensions'] = cli['inspect-brk-extensions'];
			configuration['extensions-dir'] = cli['extensions-dir'];
		}

		configuration.accessibilitySupport = false;
		configuration.isInitialStartup = false;
		configuration.policiesData = this.policyService.serialize();
		configuration.continueOn = this.environmentMainService.continueOn;
		configuration.profiles = {
			all: this.userDataProfilesService.profiles,
			profile: this.profile || this.userDataProfilesService.defaultProfile,
			home: this.userDataProfilesService.profilesHome
		};
		configuration.logLevel = this.loggerMainService.getLogLevel();
		configuration.loggers = this.loggerMainService.getGlobalLoggers();

		this.load(configuration, { isReload: true, disableExtensions: cli?.['disable-extensions'] });
	}

	private async validateWorkspaceBeforeReload(configuration: INativeWindowConfiguration): Promise<IWorkspaceIdentifier | ISingleFolderWorkspaceIdentifier | undefined> {
		if (isWorkspaceIdentifier(configuration.workspace)) {
			const configPath = configuration.workspace.configPath;
			if (configPath.scheme === Schemas.file) {
				const workspaceExists = await this.fileService.exists(configPath);
				if (!workspaceExists) {
					return undefined;
				}
			}
		} else if (isSingleFolderWorkspaceIdentifier(configuration.workspace)) {
			const uri = configuration.workspace.uri;
			if (uri.scheme === Schemas.file) {
				const folderExists = await this.fileService.exists(uri);
				if (!folderExists) {
					return undefined;
				}
			}
		}

		return configuration.workspace;
	}

	async serializeWindowState(): Promise<IWindowState> {
		if (!this._win) {
			return defaultWindowState();
		}

		const state: IWindowState = Object.create(null);
		let mode: WindowMode;

		try {
			const isMaximized = await this._win.isMaximized().catch(() => false);
			const isFullscreen = await this._win.isFullscreen().catch(() => false);

			if (isFullscreen) {
				mode = WindowMode.Fullscreen;
				const position = await this._win.outerPosition().catch(() => ({ x: 0, y: 0 }));
				const size = await this._win.outerSize().catch(() => ({ width: 1024, height: 768 }));

				return {
					mode: WindowMode.Fullscreen,
					display: undefined,
					width: this.windowState.width || size.width,
					height: this.windowState.height || size.height,
					x: this.windowState.x || position.x,
					y: this.windowState.y || position.y,
					zoomLevel: this.customZoomLevel
				};
			} else if (isMaximized) {
				mode = WindowMode.Maximized;
			} else {
				mode = WindowMode.Normal;
			}

			if (mode === WindowMode.Normal) {
				const position = await this._win.outerPosition().catch(() => ({ x: 0, y: 0 }));
				const size = await this._win.outerSize().catch(() => ({ width: 1024, height: 768 }));

				state.x = position.x;
				state.y = position.y;
				state.width = size.width;
				state.height = size.height;
			}

			state.zoomLevel = this.customZoomLevel;
			return state;
		} catch (error) {
			this.logService.error('Failed to serialize window state:', error);
			return defaultWindowState();
		}
	}

	private restoreWindowState(state?: IWindowState): [IWindowState, boolean] {
		mark('code/willRestoreCodeWindowState');

		let hasMultipleDisplays = false;
		if (state) {
			this.customZoomLevel = state.zoomLevel;
		}

		mark('code/didRestoreCodeWindowState');

		return [state || defaultWindowState(), hasMultipleDisplays];
	}

	protected override async setFullScreen(fullscreen: boolean, fromRestore: boolean): Promise<void> {
		await super.setFullScreen(fullscreen, fromRestore);

		this.sendWhenReady(fullscreen ? 'vscode:enterFullScreen' : 'vscode:leaveFullScreen', CancellationToken.None);

		if (this.currentMenuBarVisibility) {
			this.setMenuBarVisibility(this.currentMenuBarVisibility, false);
		}
	}

	private getMenuBarVisibility(): MenuBarVisibility {
		let menuBarVisibility = getMenuBarVisibility(this.configurationService);
		if (['visible', 'toggle', 'hidden'].indexOf(menuBarVisibility) < 0) {
			menuBarVisibility = 'classic';
		}

		return menuBarVisibility;
	}

	private setMenuBarVisibility(visibility: MenuBarVisibility, notify = true): void {
		if (isMacintosh) {
			return;
		}

		if (visibility === 'toggle') {
			if (notify) {
				this.send('vscode:showInfoMessage', localize('hiddenMenuBar', "You can still access the menu bar by pressing the Alt-key."));
			}
		}

		// Tauri's menu bar is handled differently
	}

	notifyZoomLevel(zoomLevel: number | undefined): void {
		this.customZoomLevel = zoomLevel;
	}

	private getZoomLevel(): number | undefined {
		if (typeof this.customZoomLevel === 'number') {
			return this.customZoomLevel;
		}

		const windowSettings = this.configurationService.getValue<{ zoomLevel?: number }>('window');
		return windowSettings?.zoomLevel;
	}

	async close(): Promise<void> {
		if (this._win) {
			await this._win.close();
		}
	}

	sendWhenReady(channel: string, token: CancellationToken, ...args: unknown[]): void {
		if (this.isReady) {
			this.send(channel, ...args);
		} else {
			this.ready().then(() => {
				if (!token.isCancellationRequested) {
					this.send(channel, ...args);
				}
			});
		}
	}

	send(channel: string, ...args: unknown[]): void {
		if (this._win) {
			try {
				this._win.emit(channel, ...args).catch(err =>
					this.logService?.warn(`Error sending IPC message to channel '${channel}' of window ${this._id}: ${toErrorMessage(err)}`)
				);
			} catch (error) {
				this.logService?.warn(`Error sending IPC message to channel '${channel}' of window ${this._id}: ${toErrorMessage(error)}`);
			}
		}
	}

	private async startCollectingJScallStacks(): Promise<void> {
		if (!this.jsCallStackCollector.isTriggered()) {
			// Tauri doesn't have direct access to JavaScript call stacks like Electron
			// This is a simplified implementation
			this.jsCallStackCollector.trigger(() => this.startCollectingJScallStacks());
		}
	}

	private stopCollectingJScallStacks(): void {
		this.jsCallStackCollectorStopScheduler.cancel();
		this.jsCallStackCollector.cancel();

		if (this.jsCallStackMap.size) {
			let logMessage = `CodeWindow unresponsive samples:\n`;
			let samples = 0;

			const sortedEntries = Array.from(this.jsCallStackMap.entries())
				.sort((a, b) => b[1] - a[1]);

			for (const [stack, count] of sortedEntries) {
				samples += count;
				if (Math.round((count * 100) / this.jsCallStackEffectiveSampleCount) > 20) {
					// Tauri equivalent error handling would be different
				}
				logMessage += `<${count}> ${stack}\n`;
			}

			logMessage += `Total Samples: ${samples}\n`;
			logMessage += 'For full overview of the unresponsive period, capture cpu profile via https://aka.ms/vscode-tracing-cpu-profile';
			this.logService.error(logMessage);
		}

		this.jsCallStackMap.clear();
	}

	matches(webContents: any): boolean {
		// Simplified matching for Tauri
		return this._win?.label === webContents?.label;
	}

	override dispose(): void {
		super.dispose();
		this.loggerMainService.deregisterLoggers(this.id);
	}
}