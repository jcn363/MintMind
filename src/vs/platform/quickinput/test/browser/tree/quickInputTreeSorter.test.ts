/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { QuickInputTreeSorter } from '../../../browser/tree/quickInputTreeSorter.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { IQuickTreeItem } from '../../../common/quickInput.js';

describe('QuickInputTreeSorter', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	it('sortByLabel property defaults to true', () => {
		const sorter = store.add(new QuickInputTreeSorter());
		assert.strictEqual(sorter.sortByLabel, true);
	});

	it('sortByLabel property can be set to false', () => {
		const sorter = store.add(new QuickInputTreeSorter());
		sorter.sortByLabel = false;
		assert.strictEqual(sorter.sortByLabel, false);
	});

	it('compare returns 0 when sortByLabel is false', () => {
		const sorter = store.add(new QuickInputTreeSorter());
		sorter.sortByLabel = false;

		const item1: IQuickTreeItem = { label: 'a' };
		const item2: IQuickTreeItem = { label: 'b' };

		assert.strictEqual(sorter.compare(item1, item2), 0);
		assert.strictEqual(sorter.compare(item2, item1), 0);
		assert.strictEqual(sorter.compare(item1, item1), 0);
	});

	it('compare sorts by label alphabetically', () => {
		const sorter = store.add(new QuickInputTreeSorter());

		const item1: IQuickTreeItem = { label: 'a' };
		const item2: IQuickTreeItem = { label: 'b' };
		const item3: IQuickTreeItem = { label: 'c' };

		assert.strictEqual(sorter.compare(item1, item2), -1);
		assert.strictEqual(sorter.compare(item2, item1), 1);
		assert.strictEqual(sorter.compare(item1, item1), 0);
		assert.strictEqual(sorter.compare(item2, item3), -1);
		assert.strictEqual(sorter.compare(item3, item2), 1);
	});

	it('compare sorts by description when labels are equal', () => {
		const sorter = store.add(new QuickInputTreeSorter());

		const item1: IQuickTreeItem = { label: 'a', description: 'x' };
		const item2: IQuickTreeItem = { label: 'a', description: 'y' };
		const item3: IQuickTreeItem = { label: 'a', description: 'z' };
		const item4: IQuickTreeItem = { label: 'a' };

		assert.strictEqual(sorter.compare(item1, item2), -1);
		assert.strictEqual(sorter.compare(item2, item1), 1);
		assert.strictEqual(sorter.compare(item2, item3), -1);
		assert.strictEqual(sorter.compare(item3, item2), 1);
		assert.strictEqual(sorter.compare(item1, item4), -1);
		assert.strictEqual(sorter.compare(item4, item1), 1);
		assert.strictEqual(sorter.compare(item4, item4), 0);
	});

	it('compare handles items with no description', () => {
		const sorter = store.add(new QuickInputTreeSorter());

		const item1: IQuickTreeItem = { label: 'a', description: 'desc' };
		const item2: IQuickTreeItem = { label: 'b' };

		assert.strictEqual(sorter.compare(item1, item2), -1);
		assert.strictEqual(sorter.compare(item2, item1), 1);
	});

	it('compare handles empty labels', () => {
		const sorter = store.add(new QuickInputTreeSorter());

		const item1: IQuickTreeItem = { label: '' };
		const item2: IQuickTreeItem = { label: 'a' };
		const item3: IQuickTreeItem = { label: '' };

		assert.strictEqual(sorter.compare(item1, item2), -1);
		assert.strictEqual(sorter.compare(item2, item1), 1);
		assert.strictEqual(sorter.compare(item1, item3), 0);
	});
});
