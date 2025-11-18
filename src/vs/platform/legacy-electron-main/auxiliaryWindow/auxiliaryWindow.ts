/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { WebContents } from 'electron';
import { isLinux, isWindows } from '../../../base/common/platform.js';
import { IConfigurationService } from '../../configuration/common/configuration.js';
import { IEnvironmentMainService } from '../../environment/electron-main/environmentMainService.js';
import { ILifecycleMainService } from '../../lifecycle/electron-main/lifecycleMainService.js';
import { ILogService } from '../../log/common/log.js';
import { IStateService } from '../../state/node/state.js';
import { hasNativeTitlebar, TitlebarStyle } from '../../window/common/window.js';
import { IBaseWindow, WindowMode } from '../../window/electron-main/window.js';
import { BaseWindow } from '../../windows/electron-main/windowImpl.js';

// Conditional imports for Tauri APIs
let WebviewWindow: any = undefined;
let isTauriMode: () => boolean = () => false;
try {
	isTauriMode = require('../../../code/electron-main/app.js').isTauriMode;
	if (isTauriMode()) {
		WebviewWindow = (await import('@tauri-apps/api/window')).WebviewWindow;
	}
} catch (error) {
	// Tauri not available, continue with Electron
}

export interface IAuxiliaryWindow extends IBaseWindow {
	readonly parentId: number;
}

export class AuxiliaryWindow extends BaseWindow implements IAuxiliaryWindow {

	readonly id: number;
	parentId = -1;
	private _tauriLabel: string | undefined;

	override get win() {
		if (!super.win && !this._tauriWin) {
			this.tryClaimWindow();
		}

		if (isTauriMode()) {
			return this._tauriWin ? { ...this._tauriWin, isDestroyed: () => false } : null;
		}

		return super.win;
	}

	private stateApplied = false;
	private _tauriWin: any = null;

	constructor(
		private readonly webContents: WebContents,
		@IEnvironmentMainService environmentMainService: IEnvironmentMainService,
		@ILogService logService: ILogService,
		@IConfigurationService configurationService: IConfigurationService,
		@IStateService stateService: IStateService,
		@ILifecycleMainService private readonly lifecycleMainService: ILifecycleMainService
	) {
		super(configurationService, stateService, environmentMainService, logService);

		if (isTauriMode()) {
			this.id = webContents.id; // Use webContents.id for consistency, but we'll use deterministic labels
		} else {
			this.id = this.webContents.id;
		}

		// Try to claim window
		this.tryClaimWindow();
	}

	tryClaimWindow(options?: any): void {
		if (this._store.isDisposed || (this.webContents && this.webContents.isDestroyed())) {
			return; // already disposed
		}

		this.doTryClaimWindow(options);

		if (options && !this.stateApplied) {
			this.stateApplied = true;

			this.applyState({
				x: options.x,
				y: options.y,
				width: options.width,
				height: options.height,
				// We currently do not support restoring fullscreen state for auxiliary
				// windows because we do not get hold of the original `features` string
				// that contains that info in `window-fullscreen`. However, we can
				// probe the `options.show` value for whether the window should be maximized
				// or not because we never show maximized windows initially to reduce flicker.
				mode: options.show === false ? WindowMode.Maximized : WindowMode.Normal
			});
		}
	}

	private doTryClaimWindow(options?: any): void {
		if (this._win || this._tauriWin) {
			return; // already claimed
		}

		if (isTauriMode()) {
			this.doTryClaimTauriWindow(options);
		} else {
			this.doTryClaimElectronWindow(options);
		}
	}

	private doTryClaimElectronWindow(options?: any): void {
		const window = (globalThis as any).BrowserWindow?.fromWebContents(this.webContents);
		if (window) {
			this.logService.trace('[aux window] Claimed browser window instance');

			// Remember
			this.setWin(window as any, options);

			// Disable Menu
			window.setMenu(null);
			if ((isWindows || isLinux) && hasNativeTitlebar(this.configurationService, options?.titleBarStyle === 'hidden' ? TitlebarStyle.CUSTOM : undefined /* unknown */)) {
				window.setAutoHideMenuBar(true); // Fix for https://github.com/microsoft/vscode/issues/200615
			}

			// Lifecycle
			this.lifecycleMainService.registerAuxWindow(this);
		}
	}

	private async doTryClaimTauriWindow(options?: any): Promise<void> {
		try {
			if (!WebviewWindow) {
				this.logService.warn('[aux window] Tauri WebviewWindow not available');
				return;
			}

			// Use the deterministic label to get the specific Tauri window
			if (this._tauriLabel) {
				const tauriWindow = WebviewWindow.getByLabel(this._tauriLabel);
				if (tauriWindow) {
					this.logService.trace('[aux window] Claimed Tauri webview window instance with label:', this._tauriLabel);

					// Remember Tauri window
					this._tauriWin = tauriWindow;
					this.setWin(null, options); // Pass null for Electron window

					// For Tauri, we don't need to disable menus as it's handled differently
					// Lifecycle
					this.lifecycleMainService.registerAuxWindow(this);
				} else {
					this.logService.warn('[aux window] Tauri window with label not found:', this._tauriLabel);
				}
			} else {
				this.logService.warn('[aux window] No Tauri label available for claiming window');
			}
		} catch (error) {
			this.logService.error('[aux window] Error claiming Tauri window:', error);
		}
	}

	matches(webContents: WebContents): boolean {
		if (isTauriMode()) {
			// For Tauri, match based on the known Tauri label
			return this._tauriLabel !== undefined;
		}
		return this.webContents.id === webContents.id;
	}

	setTauriLabel(label: string): void {
		this._tauriLabel = label;
	}
}
