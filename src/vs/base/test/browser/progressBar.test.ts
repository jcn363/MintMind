/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ProgressBar } from '../../browser/ui/progressbar/progressbar.js';
import { mainWindow } from '../../browser/window.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../common/utils.js';

describe('ProgressBar', () => {
	let fixture: HTMLElement;

	beforeEach(() => {
		fixture = document.createElement('div');
		mainWindow.document.body.appendChild(fixture);
	});

	afterEach(() => {
		fixture.remove();
	});

	it('Progress Bar', function () {
		const bar = new ProgressBar(fixture);
		assert(bar.infinite());
		assert(bar.total(100));
		assert(bar.worked(50));
		assert(bar.setWorked(70));
		assert(bar.worked(30));
		assert(bar.done());

		bar.dispose();
	});

	ensureNoDisposablesAreLeakedInTestSuite();
});
