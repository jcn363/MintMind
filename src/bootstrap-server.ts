/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Prevent runtime-specific environment variables from affecting server bootstrap. Server mode uses Node.js directly without Tauri or legacy Electron runtime.
// Prevent Tauri-specific environment variables from affecting server mode
delete process.env['TAURI_RUN_AS_NODE'];
delete process.env['TAURI_RUN_AS_NODE']; // Legacy cleanup
