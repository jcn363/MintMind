/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as processes from '../../common/processes.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from './utils.js';

describe('Processes', () => {
	ensureNoDisposablesAreLeakedInTestSuite();

	it('sanitizeProcessEnvironment', () => {
		const env = {
			FOO: 'bar',
			TAURI_ENABLE_STACK_DUMPING: 'x',
			TAURI_ENABLE_LOGGING: 'x',
			TAURI_NO_ASAR: 'x',
			TAURI_NO_ATTACH_CONSOLE: 'x',
			TAURI_RUN_AS_NODE: 'x',
			MINTMIND_CLI: 'x',
			MINTMIND_DEV: 'x',
			MINTMIND_IPC_HOOK: 'x',
			MINTMIND_NLS_CONFIG: 'x',
			MINTMIND_PORTABLE: '3',
			MINTMIND_PID: 'x',
			MINTMIND_SHELL_LOGIN: '1',
			MINTMIND_CODE_CACHE_PATH: 'x',
			MINTMIND_NEW_VAR: 'x',
			GDK_PIXBUF_MODULE_FILE: 'x',
			GDK_PIXBUF_MODULEDIR: 'x',
			MINTMIND_PYTHON_BASH_ACTIVATE: 'source /path/to/venv/bin/activate',
			MINTMIND_PYTHON_ZSH_ACTIVATE: 'source /path/to/venv/bin/activate',
			MINTMIND_PYTHON_PWSH_ACTIVATE: '. /path/to/venv/Scripts/Activate.ps1',
			MINTMIND_PYTHON_FISH_ACTIVATE: 'source /path/to/venv/bin/activate.fish',
			MINTMIND_PYTHON_AUTOACTIVATE_GUARD: '1'
		};
		processes.sanitizeProcessEnvironment(env);
		assert.strictEqual(env['FOO'], 'bar');
		assert.strictEqual(env['MINTMIND_SHELL_LOGIN'], '1');
		assert.strictEqual(env['MINTMIND_PORTABLE'], '3');
		assert.strictEqual(env['MINTMIND_PYTHON_BASH_ACTIVATE'], undefined);
		assert.strictEqual(env['MINTMIND_PYTHON_ZSH_ACTIVATE'], undefined);
		assert.strictEqual(env['MINTMIND_PYTHON_PWSH_ACTIVATE'], undefined);
		assert.strictEqual(env['MINTMIND_PYTHON_FISH_ACTIVATE'], undefined);
		assert.strictEqual(env['MINTMIND_PYTHON_AUTOACTIVATE_GUARD'], undefined);
		assert.strictEqual(Object.keys(env).length, 3);
	});
});
