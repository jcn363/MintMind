/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import assert from 'assert';
import { HierarchicalKind } from '../../../../../base/common/hierarchicalKind.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { DocumentDropEdit } from '../../../../common/languages.js';
import { sortEditsByYieldTo } from '../../browser/edit.js';


function createTestEdit(kind: string, args?: Partial<DocumentDropEdit>): DocumentDropEdit {
	return {
		title: '',
		insertText: '',
		kind: new HierarchicalKind(kind),
		...args,
	};
}

describe('sortEditsByYieldTo', () => {

	it('Should noop for empty edits', () => {
		const edits: DocumentDropEdit[] = [];

		assert.deepStrictEqual(sortEditsByYieldTo(edits), []);
	});

	it('Yielded to edit should get sorted after target', () => {
		const edits: DocumentDropEdit[] = [
			createTestEdit('a', { yieldTo: [{ kind: new HierarchicalKind('b') }] }),
			createTestEdit('b'),
		];
		assert.deepStrictEqual(sortEditsByYieldTo(edits).map(x => x.kind?.value), ['b', 'a']);
	});

	it('Should handle chain of yield to', () => {
		{
			const edits: DocumentDropEdit[] = [
				createTestEdit('c', { yieldTo: [{ kind: new HierarchicalKind('a') }] }),
				createTestEdit('a', { yieldTo: [{ kind: new HierarchicalKind('b') }] }),
				createTestEdit('b'),
			];

			assert.deepStrictEqual(sortEditsByYieldTo(edits).map(x => x.kind?.value), ['b', 'a', 'c']);
		}
		{
			const edits: DocumentDropEdit[] = [
				createTestEdit('a', { yieldTo: [{ kind: new HierarchicalKind('b') }] }),
				createTestEdit('c', { yieldTo: [{ kind: new HierarchicalKind('a') }] }),
				createTestEdit('b'),
			];

			assert.deepStrictEqual(sortEditsByYieldTo(edits).map(x => x.kind?.value), ['b', 'a', 'c']);
		}
	});

	it(`Should not reorder when yield to isn't used`, () => {
		const edits: DocumentDropEdit[] = [
			createTestEdit('c', { yieldTo: [{ kind: new HierarchicalKind('x') }] }),
			createTestEdit('a', { yieldTo: [{ kind: new HierarchicalKind('y') }] }),
			createTestEdit('b'),
		];

		assert.deepStrictEqual(sortEditsByYieldTo(edits).map(x => x.kind?.value), ['c', 'a', 'b']);
	});

	ensureNoDisposablesAreLeakedInTestSuite();
});
