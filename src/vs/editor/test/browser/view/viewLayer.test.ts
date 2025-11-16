/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { ILine, RenderedLinesCollection } from '../../../browser/view/viewLayer.js';

class TestLine implements ILine {

	_pinged = false;
	constructor(public id: string) {
	}

	onContentChanged(): void {
		this._pinged = true;
	}
	onTokensChanged(): void {
		this._pinged = true;
	}
}

interface ILinesCollectionState {
	startLineNumber: number;
	lines: string[];
	pinged: boolean[];
}

function assertState(col: RenderedLinesCollection<TestLine>, state: ILinesCollectionState): void {
	const actualState: ILinesCollectionState = {
		startLineNumber: col.getStartLineNumber(),
		lines: [],
		pinged: []
	};
	for (let lineNumber = col.getStartLineNumber(); lineNumber <= col.getEndLineNumber(); lineNumber++) {
		actualState.lines.push(col.getLine(lineNumber).id);
		actualState.pinged.push(col.getLine(lineNumber)._pinged);
	}
	assert.deepStrictEqual(actualState, state);
}

describe('RenderedLinesCollection onLinesDeleted', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	function testOnModelLinesDeleted(deleteFromLineNumber: number, deleteToLineNumber: number, expectedDeleted: string[], expectedState: ILinesCollectionState): void {
		const col = new RenderedLinesCollection<TestLine>({ createLine: () => new TestLine('new') });
		col._set(6, [
			new TestLine('old6'),
			new TestLine('old7'),
			new TestLine('old8'),
			new TestLine('old9')
		]);
		const actualDeleted1 = col.onLinesDeleted(deleteFromLineNumber, deleteToLineNumber);
		let actualDeleted: string[] = [];
		if (actualDeleted1) {
			actualDeleted = actualDeleted1.map(line => line.id);
		}
		assert.deepStrictEqual(actualDeleted, expectedDeleted);
		assertState(col, expectedState);
	}

	it('A1', () => {
		testOnModelLinesDeleted(3, 3, [], {
			startLineNumber: 5,
			lines: ['old6', 'old7', 'old8', 'old9'],
			pinged: [false, false, false, false]
		});
	});

	it('A2', () => {
		testOnModelLinesDeleted(3, 4, [], {
			startLineNumber: 4,
			lines: ['old6', 'old7', 'old8', 'old9'],
			pinged: [false, false, false, false]
		});
	});

	it('A3', () => {
		testOnModelLinesDeleted(3, 5, [], {
			startLineNumber: 3,
			lines: ['old6', 'old7', 'old8', 'old9'],
			pinged: [false, false, false, false]
		});
	});

	it('A4', () => {
		testOnModelLinesDeleted(3, 6, ['old6'], {
			startLineNumber: 3,
			lines: ['old7', 'old8', 'old9'],
			pinged: [false, false, false]
		});
	});

	it('A5', () => {
		testOnModelLinesDeleted(3, 7, ['old6', 'old7'], {
			startLineNumber: 3,
			lines: ['old8', 'old9'],
			pinged: [false, false]
		});
	});

	it('A6', () => {
		testOnModelLinesDeleted(3, 8, ['old6', 'old7', 'old8'], {
			startLineNumber: 3,
			lines: ['old9'],
			pinged: [false]
		});
	});

	it('A7', () => {
		testOnModelLinesDeleted(3, 9, ['old6', 'old7', 'old8', 'old9'], {
			startLineNumber: 3,
			lines: [],
			pinged: []
		});
	});

	it('A8', () => {
		testOnModelLinesDeleted(3, 10, ['old6', 'old7', 'old8', 'old9'], {
			startLineNumber: 3,
			lines: [],
			pinged: []
		});
	});


	it('B1', () => {
		testOnModelLinesDeleted(5, 5, [], {
			startLineNumber: 5,
			lines: ['old6', 'old7', 'old8', 'old9'],
			pinged: [false, false, false, false]
		});
	});

	it('B2', () => {
		testOnModelLinesDeleted(5, 6, ['old6'], {
			startLineNumber: 5,
			lines: ['old7', 'old8', 'old9'],
			pinged: [false, false, false]
		});
	});

	it('B3', () => {
		testOnModelLinesDeleted(5, 7, ['old6', 'old7'], {
			startLineNumber: 5,
			lines: ['old8', 'old9'],
			pinged: [false, false]
		});
	});

	it('B4', () => {
		testOnModelLinesDeleted(5, 8, ['old6', 'old7', 'old8'], {
			startLineNumber: 5,
			lines: ['old9'],
			pinged: [false]
		});
	});

	it('B5', () => {
		testOnModelLinesDeleted(5, 9, ['old6', 'old7', 'old8', 'old9'], {
			startLineNumber: 5,
			lines: [],
			pinged: []
		});
	});

	it('B6', () => {
		testOnModelLinesDeleted(5, 10, ['old6', 'old7', 'old8', 'old9'], {
			startLineNumber: 5,
			lines: [],
			pinged: []
		});
	});


	it('C1', () => {
		testOnModelLinesDeleted(6, 6, ['old6'], {
			startLineNumber: 6,
			lines: ['old7', 'old8', 'old9'],
			pinged: [false, false, false]
		});
	});

	it('C2', () => {
		testOnModelLinesDeleted(6, 7, ['old6', 'old7'], {
			startLineNumber: 6,
			lines: ['old8', 'old9'],
			pinged: [false, false]
		});
	});

	it('C3', () => {
		testOnModelLinesDeleted(6, 8, ['old6', 'old7', 'old8'], {
			startLineNumber: 6,
			lines: ['old9'],
			pinged: [false]
		});
	});

	it('C4', () => {
		testOnModelLinesDeleted(6, 9, ['old6', 'old7', 'old8', 'old9'], {
			startLineNumber: 6,
			lines: [],
			pinged: []
		});
	});

	it('C5', () => {
		testOnModelLinesDeleted(6, 10, ['old6', 'old7', 'old8', 'old9'], {
			startLineNumber: 6,
			lines: [],
			pinged: []
		});
	});


	it('D1', () => {
		testOnModelLinesDeleted(7, 7, ['old7'], {
			startLineNumber: 6,
			lines: ['old6', 'old8', 'old9'],
			pinged: [false, false, false]
		});
	});

	it('D2', () => {
		testOnModelLinesDeleted(7, 8, ['old7', 'old8'], {
			startLineNumber: 6,
			lines: ['old6', 'old9'],
			pinged: [false, false]
		});
	});

	it('D3', () => {
		testOnModelLinesDeleted(7, 9, ['old7', 'old8', 'old9'], {
			startLineNumber: 6,
			lines: ['old6'],
			pinged: [false]
		});
	});

	it('D4', () => {
		testOnModelLinesDeleted(7, 10, ['old7', 'old8', 'old9'], {
			startLineNumber: 6,
			lines: ['old6'],
			pinged: [false]
		});
	});


	it('E1', () => {
		testOnModelLinesDeleted(8, 8, ['old8'], {
			startLineNumber: 6,
			lines: ['old6', 'old7', 'old9'],
			pinged: [false, false, false]
		});
	});

	it('E2', () => {
		testOnModelLinesDeleted(8, 9, ['old8', 'old9'], {
			startLineNumber: 6,
			lines: ['old6', 'old7'],
			pinged: [false, false]
		});
	});

	it('E3', () => {
		testOnModelLinesDeleted(8, 10, ['old8', 'old9'], {
			startLineNumber: 6,
			lines: ['old6', 'old7'],
			pinged: [false, false]
		});
	});


	it('F1', () => {
		testOnModelLinesDeleted(9, 9, ['old9'], {
			startLineNumber: 6,
			lines: ['old6', 'old7', 'old8'],
			pinged: [false, false, false]
		});
	});

	it('F2', () => {
		testOnModelLinesDeleted(9, 10, ['old9'], {
			startLineNumber: 6,
			lines: ['old6', 'old7', 'old8'],
			pinged: [false, false, false]
		});
	});


	it('G1', () => {
		testOnModelLinesDeleted(10, 10, [], {
			startLineNumber: 6,
			lines: ['old6', 'old7', 'old8', 'old9'],
			pinged: [false, false, false, false]
		});
	});

	it('G2', () => {
		testOnModelLinesDeleted(10, 11, [], {
			startLineNumber: 6,
			lines: ['old6', 'old7', 'old8', 'old9'],
			pinged: [false, false, false, false]
		});
	});


	it('H1', () => {
		testOnModelLinesDeleted(11, 13, [], {
			startLineNumber: 6,
			lines: ['old6', 'old7', 'old8', 'old9'],
			pinged: [false, false, false, false]
		});
	});
});

describe('RenderedLinesCollection onLineChanged', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	function testOnModelLineChanged(changedLineNumber: number, expectedPinged: boolean, expectedState: ILinesCollectionState): void {
		const col = new RenderedLinesCollection<TestLine>({ createLine: () => new TestLine('new') });
		col._set(6, [
			new TestLine('old6'),
			new TestLine('old7'),
			new TestLine('old8'),
			new TestLine('old9')
		]);
		const actualPinged = col.onLinesChanged(changedLineNumber, 1);
		assert.deepStrictEqual(actualPinged, expectedPinged);
		assertState(col, expectedState);
	}

	it('3', () => {
		testOnModelLineChanged(3, false, {
			startLineNumber: 6,
			lines: ['old6', 'old7', 'old8', 'old9'],
			pinged: [false, false, false, false]
		});
	});
	it('4', () => {
		testOnModelLineChanged(4, false, {
			startLineNumber: 6,
			lines: ['old6', 'old7', 'old8', 'old9'],
			pinged: [false, false, false, false]
		});
	});
	it('5', () => {
		testOnModelLineChanged(5, false, {
			startLineNumber: 6,
			lines: ['old6', 'old7', 'old8', 'old9'],
			pinged: [false, false, false, false]
		});
	});
	it('6', () => {
		testOnModelLineChanged(6, true, {
			startLineNumber: 6,
			lines: ['old6', 'old7', 'old8', 'old9'],
			pinged: [true, false, false, false]
		});
	});
	it('7', () => {
		testOnModelLineChanged(7, true, {
			startLineNumber: 6,
			lines: ['old6', 'old7', 'old8', 'old9'],
			pinged: [false, true, false, false]
		});
	});
	it('8', () => {
		testOnModelLineChanged(8, true, {
			startLineNumber: 6,
			lines: ['old6', 'old7', 'old8', 'old9'],
			pinged: [false, false, true, false]
		});
	});
	it('9', () => {
		testOnModelLineChanged(9, true, {
			startLineNumber: 6,
			lines: ['old6', 'old7', 'old8', 'old9'],
			pinged: [false, false, false, true]
		});
	});
	it('10', () => {
		testOnModelLineChanged(10, false, {
			startLineNumber: 6,
			lines: ['old6', 'old7', 'old8', 'old9'],
			pinged: [false, false, false, false]
		});
	});
	it('11', () => {
		testOnModelLineChanged(11, false, {
			startLineNumber: 6,
			lines: ['old6', 'old7', 'old8', 'old9'],
			pinged: [false, false, false, false]
		});
	});

});

describe('RenderedLinesCollection onLinesInserted', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	function testOnModelLinesInserted(insertFromLineNumber: number, insertToLineNumber: number, expectedDeleted: string[], expectedState: ILinesCollectionState): void {
		const col = new RenderedLinesCollection<TestLine>({ createLine: () => new TestLine('new') });
		col._set(6, [
			new TestLine('old6'),
			new TestLine('old7'),
			new TestLine('old8'),
			new TestLine('old9')
		]);
		const actualDeleted1 = col.onLinesInserted(insertFromLineNumber, insertToLineNumber);
		let actualDeleted: string[] = [];
		if (actualDeleted1) {
			actualDeleted = actualDeleted1.map(line => line.id);
		}
		assert.deepStrictEqual(actualDeleted, expectedDeleted);
		assertState(col, expectedState);
	}

	it('A1', () => {
		testOnModelLinesInserted(3, 3, [], {
			startLineNumber: 7,
			lines: ['old6', 'old7', 'old8', 'old9'],
			pinged: [false, false, false, false]
		});
	});

	it('A2', () => {
		testOnModelLinesInserted(3, 4, [], {
			startLineNumber: 8,
			lines: ['old6', 'old7', 'old8', 'old9'],
			pinged: [false, false, false, false]
		});
	});

	it('A3', () => {
		testOnModelLinesInserted(3, 5, [], {
			startLineNumber: 9,
			lines: ['old6', 'old7', 'old8', 'old9'],
			pinged: [false, false, false, false]
		});
	});

	it('A4', () => {
		testOnModelLinesInserted(3, 6, [], {
			startLineNumber: 10,
			lines: ['old6', 'old7', 'old8', 'old9'],
			pinged: [false, false, false, false]
		});
	});

	it('A5', () => {
		testOnModelLinesInserted(3, 7, [], {
			startLineNumber: 11,
			lines: ['old6', 'old7', 'old8', 'old9'],
			pinged: [false, false, false, false]
		});
	});

	it('A6', () => {
		testOnModelLinesInserted(3, 8, [], {
			startLineNumber: 12,
			lines: ['old6', 'old7', 'old8', 'old9'],
			pinged: [false, false, false, false]
		});
	});

	it('A7', () => {
		testOnModelLinesInserted(3, 9, [], {
			startLineNumber: 13,
			lines: ['old6', 'old7', 'old8', 'old9'],
			pinged: [false, false, false, false]
		});
	});

	it('A8', () => {
		testOnModelLinesInserted(3, 10, [], {
			startLineNumber: 14,
			lines: ['old6', 'old7', 'old8', 'old9'],
			pinged: [false, false, false, false]
		});
	});


	it('B1', () => {
		testOnModelLinesInserted(5, 5, [], {
			startLineNumber: 7,
			lines: ['old6', 'old7', 'old8', 'old9'],
			pinged: [false, false, false, false]
		});
	});

	it('B2', () => {
		testOnModelLinesInserted(5, 6, [], {
			startLineNumber: 8,
			lines: ['old6', 'old7', 'old8', 'old9'],
			pinged: [false, false, false, false]
		});
	});

	it('B3', () => {
		testOnModelLinesInserted(5, 7, [], {
			startLineNumber: 9,
			lines: ['old6', 'old7', 'old8', 'old9'],
			pinged: [false, false, false, false]
		});
	});

	it('B4', () => {
		testOnModelLinesInserted(5, 8, [], {
			startLineNumber: 10,
			lines: ['old6', 'old7', 'old8', 'old9'],
			pinged: [false, false, false, false]
		});
	});

	it('B5', () => {
		testOnModelLinesInserted(5, 9, [], {
			startLineNumber: 11,
			lines: ['old6', 'old7', 'old8', 'old9'],
			pinged: [false, false, false, false]
		});
	});

	it('B6', () => {
		testOnModelLinesInserted(5, 10, [], {
			startLineNumber: 12,
			lines: ['old6', 'old7', 'old8', 'old9'],
			pinged: [false, false, false, false]
		});
	});


	it('C1', () => {
		testOnModelLinesInserted(6, 6, [], {
			startLineNumber: 7,
			lines: ['old6', 'old7', 'old8', 'old9'],
			pinged: [false, false, false, false]
		});
	});

	it('C2', () => {
		testOnModelLinesInserted(6, 7, [], {
			startLineNumber: 8,
			lines: ['old6', 'old7', 'old8', 'old9'],
			pinged: [false, false, false, false]
		});
	});

	it('C3', () => {
		testOnModelLinesInserted(6, 8, [], {
			startLineNumber: 9,
			lines: ['old6', 'old7', 'old8', 'old9'],
			pinged: [false, false, false, false]
		});
	});

	it('C4', () => {
		testOnModelLinesInserted(6, 9, [], {
			startLineNumber: 10,
			lines: ['old6', 'old7', 'old8', 'old9'],
			pinged: [false, false, false, false]
		});
	});

	it('C5', () => {
		testOnModelLinesInserted(6, 10, [], {
			startLineNumber: 11,
			lines: ['old6', 'old7', 'old8', 'old9'],
			pinged: [false, false, false, false]
		});
	});


	it('D1', () => {
		testOnModelLinesInserted(7, 7, ['old9'], {
			startLineNumber: 6,
			lines: ['old6', 'new', 'old7', 'old8'],
			pinged: [false, false, false, false]
		});
	});

	it('D2', () => {
		testOnModelLinesInserted(7, 8, ['old8', 'old9'], {
			startLineNumber: 6,
			lines: ['old6', 'new', 'new', 'old7'],
			pinged: [false, false, false, false]
		});
	});

	it('D3', () => {
		testOnModelLinesInserted(7, 9, ['old7', 'old8', 'old9'], {
			startLineNumber: 6,
			lines: ['old6'],
			pinged: [false]
		});
	});

	it('D4', () => {
		testOnModelLinesInserted(7, 10, ['old7', 'old8', 'old9'], {
			startLineNumber: 6,
			lines: ['old6'],
			pinged: [false]
		});
	});


	it('E1', () => {
		testOnModelLinesInserted(8, 8, ['old9'], {
			startLineNumber: 6,
			lines: ['old6', 'old7', 'new', 'old8'],
			pinged: [false, false, false, false]
		});
	});

	it('E2', () => {
		testOnModelLinesInserted(8, 9, ['old8', 'old9'], {
			startLineNumber: 6,
			lines: ['old6', 'old7'],
			pinged: [false, false]
		});
	});

	it('E3', () => {
		testOnModelLinesInserted(8, 10, ['old8', 'old9'], {
			startLineNumber: 6,
			lines: ['old6', 'old7'],
			pinged: [false, false]
		});
	});


	it('F1', () => {
		testOnModelLinesInserted(9, 9, ['old9'], {
			startLineNumber: 6,
			lines: ['old6', 'old7', 'old8'],
			pinged: [false, false, false]
		});
	});

	it('F2', () => {
		testOnModelLinesInserted(9, 10, ['old9'], {
			startLineNumber: 6,
			lines: ['old6', 'old7', 'old8'],
			pinged: [false, false, false]
		});
	});


	it('G1', () => {
		testOnModelLinesInserted(10, 10, [], {
			startLineNumber: 6,
			lines: ['old6', 'old7', 'old8', 'old9'],
			pinged: [false, false, false, false]
		});
	});

	it('G2', () => {
		testOnModelLinesInserted(10, 11, [], {
			startLineNumber: 6,
			lines: ['old6', 'old7', 'old8', 'old9'],
			pinged: [false, false, false, false]
		});
	});


	it('H1', () => {
		testOnModelLinesInserted(11, 13, [], {
			startLineNumber: 6,
			lines: ['old6', 'old7', 'old8', 'old9'],
			pinged: [false, false, false, false]
		});
	});
});


describe('RenderedLinesCollection onTokensChanged', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	function testOnModelTokensChanged(changedFromLineNumber: number, changedToLineNumber: number, expectedPinged: boolean, expectedState: ILinesCollectionState): void {
		const col = new RenderedLinesCollection<TestLine>({ createLine: () => new TestLine('new') });
		col._set(6, [
			new TestLine('old6'),
			new TestLine('old7'),
			new TestLine('old8'),
			new TestLine('old9')
		]);
		const actualPinged = col.onTokensChanged([{ fromLineNumber: changedFromLineNumber, toLineNumber: changedToLineNumber }]);
		assert.deepStrictEqual(actualPinged, expectedPinged);
		assertState(col, expectedState);
	}

	it('A', () => {
		testOnModelTokensChanged(3, 3, false, {
			startLineNumber: 6,
			lines: ['old6', 'old7', 'old8', 'old9'],
			pinged: [false, false, false, false]
		});
	});
	it('B', () => {
		testOnModelTokensChanged(3, 5, false, {
			startLineNumber: 6,
			lines: ['old6', 'old7', 'old8', 'old9'],
			pinged: [false, false, false, false]
		});
	});
	it('C', () => {
		testOnModelTokensChanged(3, 6, true, {
			startLineNumber: 6,
			lines: ['old6', 'old7', 'old8', 'old9'],
			pinged: [true, false, false, false]
		});
	});
	it('D', () => {
		testOnModelTokensChanged(6, 6, true, {
			startLineNumber: 6,
			lines: ['old6', 'old7', 'old8', 'old9'],
			pinged: [true, false, false, false]
		});
	});
	it('E', () => {
		testOnModelTokensChanged(5, 10, true, {
			startLineNumber: 6,
			lines: ['old6', 'old7', 'old8', 'old9'],
			pinged: [true, true, true, true]
		});
	});
	it('F', () => {
		testOnModelTokensChanged(8, 9, true, {
			startLineNumber: 6,
			lines: ['old6', 'old7', 'old8', 'old9'],
			pinged: [false, false, true, true]
		});
	});
	it('G', () => {
		testOnModelTokensChanged(8, 11, true, {
			startLineNumber: 6,
			lines: ['old6', 'old7', 'old8', 'old9'],
			pinged: [false, false, true, true]
		});
	});
	it('H', () => {
		testOnModelTokensChanged(10, 10, false, {
			startLineNumber: 6,
			lines: ['old6', 'old7', 'old8', 'old9'],
			pinged: [false, false, false, false]
		});
	});
	it('I', () => {
		testOnModelTokensChanged(10, 11, false, {
			startLineNumber: 6,
			lines: ['old6', 'old7', 'old8', 'old9'],
			pinged: [false, false, false, false]
		});
	});
});
