/* ---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import product from '../../../product/common/product.js';
import { OPTIONS, parseArgs } from '../../node/argv.js';
import { getUserDataPath } from '../../node/userDataPath.js';

describe('User data path', () => {

	it('getUserDataPath - default', () => {
		const path = getUserDataPath(parseArgs(process.argv, OPTIONS), product.nameShort);
		assert.ok(path.length > 0);
	});

	it('getUserDataPath - portable mode', () => {
		const origPortable = process.env['MINTMIND_PORTABLE'];
		try {
			const portableDir = 'portable-dir';
			process.env['MINTMIND_PORTABLE'] = portableDir;

			const path = getUserDataPath(parseArgs(process.argv, OPTIONS), product.nameShort);
			assert.ok(path.includes(portableDir));
		} finally {
			if (typeof origPortable === 'string') {
				process.env['MINTMIND_PORTABLE'] = origPortable;
			} else {
				delete process.env['MINTMIND_PORTABLE'];
			}
		}
	});

	it('getUserDataPath - --user-data-dir', () => {
		const cliUserDataDir = 'cli-data-dir';
		const args = parseArgs(process.argv, OPTIONS);
		args['user-data-dir'] = cliUserDataDir;

		const path = getUserDataPath(args, product.nameShort);
		assert.ok(path.includes(cliUserDataDir));
	});

	it('getUserDataPath - MINTMIND_APPDATA', () => {
		const origAppData = process.env['MINTMIND_APPDATA'];
		try {
			const appDataDir = 'appdata-dir';
			process.env['MINTMIND_APPDATA'] = appDataDir;

			const path = getUserDataPath(parseArgs(process.argv, OPTIONS), product.nameShort);
			assert.ok(path.includes(appDataDir));
		} finally {
			if (typeof origAppData === 'string') {
				process.env['MINTMIND_APPDATA'] = origAppData;
			} else {
				delete process.env['MINTMIND_APPDATA'];
			}
		}
	});

	ensureNoDisposablesAreLeakedInTestSuite();
});
