/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as sinon from 'sinon';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { TestInstantiationService } from '../../../../../platform/instantiation/test/common/instantiationServiceMock.js';
import { DomActivityTracker } from '../../browser/domActivityTracker.js';
import { UserActivityService } from '../../common/userActivityService.js';

describe('DomActivityTracker', () => {
	let uas: UserActivityService;
	let insta: TestInstantiationService;
	let clock: sinon.SinonFakeTimers;
	const maxTimeToBecomeIdle = 3 * 30_000; // (MIN_INTERVALS_WITHOUT_ACTIVITY + 1) * CHECK_INTERVAL;
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	beforeEach(() => {
		clock = sinon.useFakeTimers();
		insta = store.add(new TestInstantiationService());
		uas = store.add(new UserActivityService(insta));
		store.add(new DomActivityTracker(uas));
	});

	afterEach(() => {
		clock.restore();
	});


	it('marks inactive on no input', () => {
		assert.equal(uas.isActive, true);
		clock.tick(maxTimeToBecomeIdle);
		assert.equal(uas.isActive, false);
	});

	it('preserves activity state when active', () => {
		assert.equal(uas.isActive, true);

		const div = 10;
		for (let i = 0; i < div; i++) {
			document.dispatchEvent(new MouseEvent('keydown'));
			clock.tick(maxTimeToBecomeIdle / div);
		}

		assert.equal(uas.isActive, true);
	});

	it('restores active state', () => {
		assert.equal(uas.isActive, true);
		clock.tick(maxTimeToBecomeIdle);
		assert.equal(uas.isActive, false);

		document.dispatchEvent(new MouseEvent('keydown'));
		assert.equal(uas.isActive, true);

		clock.tick(maxTimeToBecomeIdle);
		assert.equal(uas.isActive, false);
	});
});
