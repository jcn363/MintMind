/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { WebviewWindow } from '@tauri-apps/api/window';
import { invoke } from '@tauri-apps/api/core';

interface HandlerDetails {
	features: string;
	frameName?: string;
	additionalArguments?: {
		parentId?: number;
	};
}

interface WebContents {
	id: number;
}

interface TauriWindowOptions {
	label: string;
	width: number;
	height: number;
	x?: number;
	y?: number;
	resizable: boolean;
	alwaysOnTop: boolean;
	fullscreen: boolean;
	decorations: boolean;
}

interface BrowserWindowOptionsOverrides {
	disableFullscreen?: boolean;
	forceNativeTitlebar?: boolean;
	alwaysOnTop?: boolean;
}
import { Emitter, Event } from '../../../base/common/event.js';
import { Disposable, DisposableStore, toDisposable } from '../../../base/common/lifecycle.js';
import { AuxiliaryWindow, IAuxiliaryWindow } from './auxiliaryWindow.js';
import { IAuxiliaryWindowsMainService } from './auxiliaryWindows.js';
import { IInstantiationService } from '../../instantiation/common/instantiation.js';
import { ILogService } from '../../log/common/log.js';
import { IWindowState, WindowMode, defaultAuxWindowState } from '../../window/electron-main/window.js';

export class AuxiliaryWindowsMainService extends Disposable implements IAuxiliaryWindowsMainService {

	declare readonly _serviceBrand: undefined;

	private readonly _onDidMaximizeWindow = this._register(new Emitter<IAuxiliaryWindow>());
	readonly onDidMaximizeWindow = this._onDidMaximizeWindow.event;

	private readonly _onDidUnmaximizeWindow = this._register(new Emitter<IAuxiliaryWindow>());
	readonly onDidUnmaximizeWindow = this._onDidUnmaximizeWindow.event;

	private readonly _onDidChangeFullScreen = this._register(new Emitter<{ window: IAuxiliaryWindow; fullscreen: boolean }>());
	readonly onDidChangeFullScreen = this._onDidChangeFullScreen.event;

	private readonly _onDidChangeAlwaysOnTop = this._register(new Emitter<{ window: IAuxiliaryWindow; alwaysOnTop: boolean }>());
	readonly onDidChangeAlwaysOnTop = this._onDidChangeAlwaysOnTop.event;

	private readonly _onDidTriggerSystemContextMenu = this._register(new Emitter<{ window: IAuxiliaryWindow; x: number; y: number }>());
	readonly onDidTriggerSystemContextMenu = this._onDidTriggerSystemContextMenu.event;

	private readonly windows = new Map<number /* webContents ID */, AuxiliaryWindow>();

	constructor(
		@IInstantiationService private readonly instantiationService: IInstantiationService,
		@ILogService private readonly logService: ILogService
	) {
		super();

		this.registerListeners();
	}

	private registerListeners(): void {
		// For Tauri, auxiliary window management is handled via Tauri's command system
		// No additional listeners needed as window creation is explicit via invoke
	}

	async createWindow(details: HandlerDetails): Promise<TauriWindowOptions> {
		// For Tauri, use explicit handshake instead of heuristic creation
		const { state, overrides } = this.computeWindowStateAndOverrides(details);

		// Extract identifiers from details
		const frameName = this.extractFrameName(details);
		const parentWindowId = this.extractParentWindowId(details);

		try {
			// Call the Rust command to register/create the auxiliary window
			const auxiliaryLabel = await invoke('register_auxiliary_window', {
				parentLabel: `main-${parentWindowId}`, // Assume main window labels follow this pattern
				frameName,
				token: details.frameName || undefined
			});

			this.logService.trace('[aux window] Registered auxiliary window with label:', auxiliaryLabel);

			return {
				label: auxiliaryLabel,
				width: state.width || 800,
				height: state.height || 600,
				x: state.x,
				y: state.y,
				resizable: !overrides.disableFullscreen,
				alwaysOnTop: overrides.alwaysOnTop,
				fullscreen: state.mode === WindowMode.Fullscreen,
				decorations: !overrides.forceNativeTitlebar,
			};
		} catch (error) {
			this.logService.error('[aux window] Failed to register auxiliary window:', error);
			throw error;
		}
	}

	private computeWindowStateAndOverrides(details: HandlerDetails): { readonly state: IWindowState; readonly overrides: BrowserWindowOptionsOverrides } {
		const windowState: IWindowState = {};
		const overrides: BrowserWindowOptionsOverrides = {};

		const features = details.features.split(','); // for example: popup=yes,left=270,top=14.5,width=1024,height=768
		for (const feature of features) {
			const [key, value] = feature.split('=');
			switch (key) {
				case 'width':
					windowState.width = parseInt(value, 10);
					break;
				case 'height':
					windowState.height = parseInt(value, 10);
					break;
				case 'left':
					windowState.x = parseInt(value, 10);
					break;
				case 'top':
					windowState.y = parseInt(value, 10);
					break;
				case 'window-maximized':
					windowState.mode = WindowMode.Maximized;
					break;
				case 'window-fullscreen':
					windowState.mode = WindowMode.Fullscreen;
					break;
				case 'window-disable-fullscreen':
					overrides.disableFullscreen = true;
					break;
				case 'window-native-titlebar':
					overrides.forceNativeTitlebar = true;
					break;
				case 'window-always-on-top':
					overrides.alwaysOnTop = true;
					break;
			}
		}

		const state = WindowStateValidator.validateWindowState(this.logService, windowState) ?? defaultAuxWindowState();

		this.logService.trace('[aux window] using window state', state);

		return { state, overrides };
	}

	private extractFrameName(details: HandlerDetails): string | undefined {
		// Extract frame name from details if available
		return details.frameName;
	}

	private extractParentWindowId(details: HandlerDetails): number {
		// Extract parent window ID from details
		// This might need to be passed from the frontend or inferred from context
		// For now, return a default or extract from details if available
		return details.additionalArguments?.parentId || 1; // Default to main window
	}

	registerWindow(webContents: WebContents, tauriLabel?: string): void {
		const disposables = new DisposableStore();

		const auxiliaryWindow = this.instantiationService.createInstance(AuxiliaryWindow, webContents);

		// Set the Tauri label if provided for deterministic matching
		if (tauriLabel) {
			auxiliaryWindow.setTauriLabel(tauriLabel);
		}

		this.windows.set(auxiliaryWindow.id, auxiliaryWindow);
		disposables.add(toDisposable(() => this.windows.delete(auxiliaryWindow.id)));

		disposables.add(auxiliaryWindow.onDidMaximize(() => this._onDidMaximizeWindow.fire(auxiliaryWindow)));
		disposables.add(auxiliaryWindow.onDidUnmaximize(() => this._onDidUnmaximizeWindow.fire(auxiliaryWindow)));
		disposables.add(auxiliaryWindow.onDidEnterFullScreen(() => this._onDidChangeFullScreen.fire({ window: auxiliaryWindow, fullscreen: true })));
		disposables.add(auxiliaryWindow.onDidLeaveFullScreen(() => this._onDidChangeFullScreen.fire({ window: auxiliaryWindow, fullscreen: false })));
		disposables.add(auxiliaryWindow.onDidChangeAlwaysOnTop(alwaysOnTop => this._onDidChangeAlwaysOnTop.fire({ window: auxiliaryWindow, alwaysOnTop })));
		disposables.add(auxiliaryWindow.onDidTriggerSystemContextMenu(({ x, y }) => this._onDidTriggerSystemContextMenu.fire({ window: auxiliaryWindow, x, y })));

		Event.once(auxiliaryWindow.onDidClose)(() => disposables.dispose());
	}

	getWindowByWebContents(webContents: WebContents): AuxiliaryWindow | undefined {
		// For Tauri, match by window label stored in webContents.id or by checking all windows
		const window = this.windows.get(webContents.id);
		if (window?.matches(webContents)) {
			return window;
		}

		// Fallback: search through all windows to find a match
		for (const auxWindow of this.windows.values()) {
			if (auxWindow.matches(webContents)) {
				return auxWindow;
			}
		}
		return undefined;
	}

	getFocusedWindow(): IAuxiliaryWindow | undefined {
		// For Tauri, get focused window using Tauri's API
		try {
			const allWindows = WebviewWindow.getAll();
			const focusedWindow = allWindows.find((win: any) => win.isFocused && win.isFocused());
			if (focusedWindow) {
				// Find our auxiliary window by matching the label
				for (const auxWindow of this.windows.values()) {
					if (auxWindow.id.toString() === focusedWindow.label) {
						return auxWindow;
					}
				}
			}
		} catch (error) {
			this.logService.warn('[aux window] Error getting focused Tauri window:', error);
		}
		return undefined;
	}

	getLastActiveWindow(): IAuxiliaryWindow | undefined {
		let lastFocusedWindow: IAuxiliaryWindow | undefined = undefined;
		let maxLastFocusTime = Number.MIN_VALUE;

		for (const window of this.windows.values()) {
			if (window.lastFocusTime > maxLastFocusTime) {
				maxLastFocusTime = window.lastFocusTime;
				lastFocusedWindow = window;
			}
		}

		return lastFocusedWindow;
	}

	getWindows(): readonly IAuxiliaryWindow[] {
		return Array.from(this.windows.values());
	}
}
