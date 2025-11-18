/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type * as nativeKeymap from 'native-keymap';
import * as platform from '../../../base/common/platform.js';
import { Emitter } from '../../../base/common/event.js';
import { Disposable } from '../../../base/common/lifecycle.js';
import { createDecorator } from '../../instantiation/common/instantiation.js';
import { IKeyboardLayoutData, INativeKeyboardLayoutService } from '../common/keyboardLayoutService.js';
import { ILifecycleMainService, LifecycleMainPhase } from '../../lifecycle/electron-main/lifecycleMainService.js';
import { isTauriMode } from '../../../code/electron-main/app.js';

export const IKeyboardLayoutMainService = createDecorator<IKeyboardLayoutMainService>('keyboardLayoutMainService');

export interface IKeyboardLayoutMainService extends INativeKeyboardLayoutService { }

export class KeyboardLayoutMainService extends Disposable implements INativeKeyboardLayoutService {

	declare readonly _serviceBrand: undefined;

	private readonly _onDidChangeKeyboardLayout = this._register(new Emitter<IKeyboardLayoutData>());
	readonly onDidChangeKeyboardLayout = this._onDidChangeKeyboardLayout.event;

	private _initPromise: Promise<void> | null;
	private _keyboardLayoutData: IKeyboardLayoutData | null;

	private _unlistenFn: (() => void) | undefined;

	constructor(
		@ILifecycleMainService lifecycleMainService: ILifecycleMainService
	) {
		super();
		this._initPromise = null;
		this._keyboardLayoutData = null;

		// perf: automatically trigger initialize after windows
		// have opened so that we can do this work in parallel
		// to the window load.
		lifecycleMainService.when(LifecycleMainPhase.AfterWindowOpen).then(() => this._initialize());
	}

	private _initialize(): Promise<void> {
		if (!this._initPromise) {
			this._initPromise = this._doInitialize();
		}
		return this._initPromise;
	}

	private async _doInitialize(): Promise<void> {
		if (isTauriMode()) {
			await this._doInitializeTauri();
		} else {
			await this._doInitializeElectron();
		}
	}

	private async _doInitializeElectron(): Promise<void> {
		const nativeKeymapMod = await import('native-keymap');

		this._keyboardLayoutData = readKeyboardLayoutData(nativeKeymapMod);
		if (!platform.isCI) {
			// See https://github.com/microsoft/vscode/issues/152840
			// Do not register the keyboard layout change listener in CI because it doesn't work
			// on the build machines and it just adds noise to the build logs.
			nativeKeymapMod.onDidChangeKeyboardLayout(() => {
				this._keyboardLayoutData = readKeyboardLayoutData(nativeKeymapMod);
				this._onDidChangeKeyboardLayout.fire(this._keyboardLayoutData);
			});
		}
	}

	private async _doInitializeTauri(): Promise<void> {
		try {
			// Import Tauri APIs conditionally
			const { invoke } = await import('@tauri-apps/api/core');
			const { listen, UnlistenFn } = await import('@tauri-apps/api/event');

			// Get initial layout data
			const layoutData = await invoke('get_keyboard_layout_data') as IKeyboardLayoutData;
			this._keyboardLayoutData = layoutData;

			// Start listener
			await invoke('start_keyboard_layout_listener');

			// Listen for layout changes
			this._unlistenFn = await listen('keyboard:layout-changed', (event: any) => {
				this._keyboardLayoutData = event.payload as IKeyboardLayoutData;
				this._onDidChangeKeyboardLayout.fire(this._keyboardLayoutData);
			});

			// Register cleanup
			this._register({
				dispose: () => {
					if (this._unlistenFn) {
						this._unlistenFn();
					}
				}
			});
		} catch (error) {
			console.warn('Failed to initialize Tauri keyboard layout service:', error);
			// Fallback to empty layout data
			this._keyboardLayoutData = {
				keyboardMapping: {},
				keyboardLayoutInfo: {
					id: 'us',
					lang: 'en',
					localizedName: 'English (US)',
					displayName: 'English (US)',
					text: 'English (US) keyboard layout'
				}
			};
		}
	}

	public async getKeyboardLayoutData(): Promise<IKeyboardLayoutData> {
		await this._initialize();
		return this._keyboardLayoutData!;
	}
}

function readKeyboardLayoutData(nativeKeymapMod: typeof nativeKeymap): IKeyboardLayoutData {
	const keyboardMapping = nativeKeymapMod.getKeyMap();
	const keyboardLayoutInfo = nativeKeymapMod.getCurrentKeyboardLayout();
	return { keyboardMapping, keyboardLayoutInfo };
}
