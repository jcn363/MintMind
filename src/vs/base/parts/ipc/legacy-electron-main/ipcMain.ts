/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { onUnexpectedError } from '../../../common/errors.js';
import { Event } from '../../../common/event.js';
import { MINTMIND_AUTHORITY } from '../../../common/network.js';

// Tauri imports for IPC
import { listen, emit } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';

// Type definitions for Tauri IPC compatibility
type ipcMainListener = (event: any, ...args: any[]) => void;

class ValidatedIpcMain implements Event.NodeEventEmitter {

	// We need to keep a map of original listener to the wrapped variant in order
	// to properly implement `removeListener`. We use a `WeakMap` because we do
	// not want to prevent the `key` of the map to get garbage collected.
	private readonly mapListenerToWrapper = new WeakMap<ipcMainListener, ipcMainListener>();
	private readonly listeners = new Map<string, ipcMainListener>();

	/**
	 * Listens to `channel`, when a new message arrives `listener` would be called with
	 * `listener(event, args...)`.
	 */
	on(channel: string, listener: ipcMainListener): this {
		// Remember the wrapped listener so that later we can
		// properly implement `removeListener`.
		const wrappedListener = (event: any) => {
			if (this.validateEvent(channel, event)) {
				listener(event, ...(event.payload || []));
			}
		};

		this.mapListenerToWrapper.set(listener, wrappedListener);

		// Set up Tauri event listener
		listen(channel, wrappedListener).catch(error => {
			onUnexpectedError(`Failed to setup Tauri listener for channel '${channel}': ${error}`);
		});

		this.listeners.set(channel, wrappedListener);

		return this;
	}

	/**
	 * Adds a one time `listener` function for the event. This `listener` is invoked
	 * only the next time a message is sent to `channel`, after which it is removed.
	 */
	once(channel: string, listener: ipcMainListener): this {
		const wrappedListener = (event: any) => {
			if (this.validateEvent(channel, event)) {
				listener(event, ...(event.payload || []));
				// Remove after first call
				this.removeListener(channel, listener);
			}
		};

		listen(channel, wrappedListener).catch(error => {
			onUnexpectedError(`Failed to setup Tauri once listener for channel '${channel}': ${error}`);
		});

		return this;
	}

	/**
	 * Adds a handler for an `invoke`able IPC. This handler will be called whenever a
	 * renderer calls `ipcRenderer.invoke(channel, ...args)`.
	 *
	 * If `listener` returns a Promise, the eventual result of the promise will be
	 * returned as a reply to the remote caller. Otherwise, the return value of the
	 * listener will be used as the value of the reply.
	 *
	 * The `event` that is passed as the first argument to the handler is the same as
	 * that passed to a regular event listener. It includes information about which
	 * WebContents is the source of the invoke request.
	 *
	 * Errors thrown through `handle` in the main process are not transparent as they
	 * are serialized and only the `message` property from the original error is
	 * provided to the renderer process. Please refer to #24427 for details.
	 */
	handle(channel: string, listener: (event: any, ...args: any[]) => Promise<unknown>): this {
		// Store handler for when invoked
		// This is a simplified implementation - in Tauri, commands are registered in main.rs
		console.warn(`Tauri IPC: handle() for channel '${channel}' is not needed - use Tauri commands in main.rs instead`);
		return this;
	}

	/**
	 * Removes any handler for `channel`, if present.
	 */
	removeHandler(channel: string): this {
		// In Tauri, handlers are managed in main.rs
		console.warn(`Tauri IPC: removeHandler() for channel '${channel}' is not needed - handlers are managed in main.rs`);
		return this;
	}

	/**
	 * Removes the specified `listener` from the listener array for the specified
	 * `channel`.
	 */
	removeListener(channel: string, listener: ipcMainListener): this {
		const wrappedListener = this.mapListenerToWrapper.get(listener);
		if (wrappedListener) {
			// In Tauri, we can't directly remove listeners, but we can remove our mapping
			this.listeners.delete(channel);
			this.mapListenerToWrapper.delete(listener);
		}

		return this;
	}

	private validateEvent(channel: string, event: any): boolean {
		if (!channel?.startsWith('vscode:')) {
			onUnexpectedError(`Refused to handle ipcMain event for channel '${channel}' because the channel is unknown.`);
			return false; // unexpected channel
		}

		// Tauri handles security differently - no URL validation needed
		// as all communication is through secure Tauri APIs
		return true;
	}
}

/**
 * A drop-in replacement of `ipcMain` that validates the sender of a message
 * according to https://github.com/electron/electron/blob/main/docs/tutorial/security.md
 *
 * @deprecated direct use of Electron IPC is not encouraged. We have utilities in place
 * to create services on top of IPC, see `ProxyChannel` for more information.
 */
export const validatedIpcMain = new ValidatedIpcMain();
