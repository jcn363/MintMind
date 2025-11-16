/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { strictEqual } from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { BufferDirtyTracker } from '../../../browser/gpu/bufferDirtyTracker.js';

describe('BufferDirtyTracker', () => {
	ensureNoDisposablesAreLeakedInTestSuite();

	let bdt: BufferDirtyTracker;

	function assertState(dataOffset: number | undefined, dirtySize: number | undefined) {
		strictEqual(bdt.dataOffset, dataOffset);
		strictEqual(bdt.dirtySize, dirtySize);
		strictEqual(bdt.isDirty, dataOffset !== undefined);
	}

	beforeEach(() => {
		bdt = new BufferDirtyTracker();
	});

	it('flag(index)', () => {
		strictEqual(bdt.flag(0), 0);
		assertState(0, 1);
		strictEqual(bdt.flag(31), 31);
		assertState(0, 32);
		bdt.clear();
		assertState(undefined, undefined);
		strictEqual(bdt.flag(10), 10);
		assertState(10, 1);
		strictEqual(bdt.flag(15), 15);
		assertState(10, 6);
	});

	it('flag(index, length)', () => {
		bdt.flag(0, 32);
		assertState(0, 32);
		bdt.clear();
		assertState(undefined, undefined);
		bdt.flag(10, 6);
		assertState(10, 6);
	});
});
