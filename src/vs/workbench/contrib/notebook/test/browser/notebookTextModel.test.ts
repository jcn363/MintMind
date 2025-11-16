/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { VSBuffer } from '../../../../../base/common/buffer.js';
import { DisposableStore } from '../../../../../base/common/lifecycle.js';
import { Mimes } from '../../../../../base/common/mime.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { Position } from '../../../../../editor/common/core/position.js';
import { ILanguageService } from '../../../../../editor/common/languages/language.js';
import { TestInstantiationService } from '../../../../../platform/instantiation/test/common/instantiationServiceMock.js';
import { IUndoRedoService } from '../../../../../platform/undoRedo/common/undoRedo.js';
import { NotebookTextModel } from '../../common/model/notebookTextModel.js';
import { CellEditType, CellKind, ICellEditOperation, MOVE_CURSOR_1_LINE_COMMAND, NotebookTextModelChangedEvent, NotebookTextModelWillAddRemoveEvent, SelectionStateType } from '../../common/notebookCommon.js';
import { setupInstantiationService, TestCell, valueBytesFromString, withTestNotebook } from './testNotebookEditor.js';

describe('NotebookTextModel', () => {
	let disposables: DisposableStore;
	let instantiationService: TestInstantiationService;
	let languageService: ILanguageService;

	ensureNoDisposablesAreLeakedInTestSuite();

	beforeAll(() => {
		disposables = new DisposableStore();
		instantiationService = setupInstantiationService(disposables);
		languageService = instantiationService.get(ILanguageService);
		instantiationService.spy(IUndoRedoService, 'pushElement');
	});

	afterAll(() => disposables.dispose());

	it('insert', async function () {
		await withTestNotebook(
			[
				['var a = 1;', 'javascript', CellKind.Code, [], {}],
				['var b = 2;', 'javascript', CellKind.Code, [], {}],
				['var c = 3;', 'javascript', CellKind.Code, [], {}],
				['var d = 4;', 'javascript', CellKind.Code, [], {}]
			],
			(editor, _viewModel, ds) => {
				const textModel = editor.textModel;
				textModel.applyEdits([
					{ editType: CellEditType.Replace, index: 1, count: 0, cells: [ds.add(new TestCell(textModel.viewType, 5, 'var e = 5;', 'javascript', CellKind.Code, [], languageService))] },
					{ editType: CellEditType.Replace, index: 3, count: 0, cells: [ds.add(new TestCell(textModel.viewType, 6, 'var f = 6;', 'javascript', CellKind.Code, [], languageService))] },
				], true, undefined, () => undefined, undefined, true);

				assert.strictEqual(textModel.cells.length, 6);

				assert.strictEqual(textModel.cells[1].getValue(), 'var e = 5;');
				assert.strictEqual(textModel.cells[4].getValue(), 'var f = 6;');
			}
		);
	});

	it('multiple inserts at same position', async function () {
		await withTestNotebook(
			[
				['var a = 1;', 'javascript', CellKind.Code, [], {}],
				['var b = 2;', 'javascript', CellKind.Code, [], {}],
				['var c = 3;', 'javascript', CellKind.Code, [], {}],
				['var d = 4;', 'javascript', CellKind.Code, [], {}]
			],
			(editor, _viewModel, ds) => {
				const textModel = editor.textModel;
				textModel.applyEdits([
					{ editType: CellEditType.Replace, index: 1, count: 0, cells: [ds.add(new TestCell(textModel.viewType, 5, 'var e = 5;', 'javascript', CellKind.Code, [], languageService))] },
					{ editType: CellEditType.Replace, index: 1, count: 0, cells: [ds.add(new TestCell(textModel.viewType, 6, 'var f = 6;', 'javascript', CellKind.Code, [], languageService))] },
				], true, undefined, () => undefined, undefined, true);

				assert.strictEqual(textModel.cells.length, 6);

				assert.strictEqual(textModel.cells[1].getValue(), 'var e = 5;');
				assert.strictEqual(textModel.cells[2].getValue(), 'var f = 6;');
			}
		);
	});

	it('delete', async function () {
		await withTestNotebook(
			[
				['var a = 1;', 'javascript', CellKind.Code, [], {}],
				['var b = 2;', 'javascript', CellKind.Code, [], {}],
				['var c = 3;', 'javascript', CellKind.Code, [], {}],
				['var d = 4;', 'javascript', CellKind.Code, [], {}]
			],
			(editor) => {
				const textModel = editor.textModel;
				textModel.applyEdits([
					{ editType: CellEditType.Replace, index: 1, count: 1, cells: [] },
					{ editType: CellEditType.Replace, index: 3, count: 1, cells: [] },
				], true, undefined, () => undefined, undefined, true);

				assert.strictEqual(textModel.cells[0].getValue(), 'var a = 1;');
				assert.strictEqual(textModel.cells[1].getValue(), 'var c = 3;');
			}
		);
	});

	it('delete + insert', async function () {
		await withTestNotebook(
			[
				['var a = 1;', 'javascript', CellKind.Code, [], {}],
				['var b = 2;', 'javascript', CellKind.Code, [], {}],
				['var c = 3;', 'javascript', CellKind.Code, [], {}],
				['var d = 4;', 'javascript', CellKind.Code, [], {}]
			],
			(editor, _viewModel, ds) => {
				const textModel = editor.textModel;
				textModel.applyEdits([
					{ editType: CellEditType.Replace, index: 1, count: 1, cells: [] },
					{ editType: CellEditType.Replace, index: 3, count: 0, cells: [ds.add(new TestCell(textModel.viewType, 5, 'var e = 5;', 'javascript', CellKind.Code, [], languageService))] },
				], true, undefined, () => undefined, undefined, true);
				assert.strictEqual(textModel.cells.length, 4);

				assert.strictEqual(textModel.cells[0].getValue(), 'var a = 1;');
				assert.strictEqual(textModel.cells[2].getValue(), 'var e = 5;');
			}
		);
	});

	it('delete + insert at same position', async function () {
		await withTestNotebook(
			[
				['var a = 1;', 'javascript', CellKind.Code, [], {}],
				['var b = 2;', 'javascript', CellKind.Code, [], {}],
				['var c = 3;', 'javascript', CellKind.Code, [], {}],
				['var d = 4;', 'javascript', CellKind.Code, [], {}]
			],
			(editor, _viewModel, ds) => {
				const textModel = editor.textModel;
				textModel.applyEdits([
					{ editType: CellEditType.Replace, index: 1, count: 1, cells: [] },
					{ editType: CellEditType.Replace, index: 1, count: 0, cells: [ds.add(new TestCell(textModel.viewType, 5, 'var e = 5;', 'javascript', CellKind.Code, [], languageService))] },
				], true, undefined, () => undefined, undefined, true);

				assert.strictEqual(textModel.cells.length, 4);
				assert.strictEqual(textModel.cells[0].getValue(), 'var a = 1;');
				assert.strictEqual(textModel.cells[1].getValue(), 'var e = 5;');
				assert.strictEqual(textModel.cells[2].getValue(), 'var c = 3;');
			}
		);
	});

	it('(replace) delete + insert at same position', async function () {
		await withTestNotebook(
			[
				['var a = 1;', 'javascript', CellKind.Code, [], {}],
				['var b = 2;', 'javascript', CellKind.Code, [], {}],
				['var c = 3;', 'javascript', CellKind.Code, [], {}],
				['var d = 4;', 'javascript', CellKind.Code, [], {}]
			],
			(editor, _viewModel, ds) => {
				const textModel = editor.textModel;
				textModel.applyEdits([
					{ editType: CellEditType.Replace, index: 1, count: 1, cells: [ds.add(new TestCell(textModel.viewType, 5, 'var e = 5;', 'javascript', CellKind.Code, [], languageService))] },
				], true, undefined, () => undefined, undefined, true);

				assert.strictEqual(textModel.cells.length, 4);
				assert.strictEqual(textModel.cells[0].getValue(), 'var a = 1;');
				assert.strictEqual(textModel.cells[1].getValue(), 'var e = 5;');
				assert.strictEqual(textModel.cells[2].getValue(), 'var c = 3;');
			}
		);
	});

	it('output', async function () {
		await withTestNotebook(
			[
				['var a = 1;', 'javascript', CellKind.Code, [], {}],
			],
			(editor) => {
				const textModel = editor.textModel;

				// invalid index 1
				assert.throws(() => {
					textModel.applyEdits([{
						index: Number.MAX_VALUE,
						editType: CellEditType.Output,
						outputs: []
					}], true, undefined, () => undefined, undefined, true);
				});

				// invalid index 2
				assert.throws(() => {
					textModel.applyEdits([{
						index: -1,
						editType: CellEditType.Output,
						outputs: []
					}], true, undefined, () => undefined, undefined, true);
				});

				textModel.applyEdits([{
					index: 0,
					editType: CellEditType.Output,
					outputs: [{
						outputId: 'someId',
						outputs: [{ mime: Mimes.markdown, data: valueBytesFromString('_Hello_') }]
					}]
				}], true, undefined, () => undefined, undefined, true);

				assert.strictEqual(textModel.cells.length, 1);
				assert.strictEqual(textModel.cells[0].outputs.length, 1);

				// append
				textModel.applyEdits([{
					index: 0,
					editType: CellEditType.Output,
					append: true,
					outputs: [{
						outputId: 'someId2',
						outputs: [{ mime: Mimes.markdown, data: valueBytesFromString('_Hello2_') }]
					}]
				}], true, undefined, () => undefined, undefined, true);

				assert.strictEqual(textModel.cells.length, 1);
				assert.strictEqual(textModel.cells[0].outputs.length, 2);
				let [first, second] = textModel.cells[0].outputs;
				assert.strictEqual(first.outputId, 'someId');
				assert.strictEqual(second.outputId, 'someId2');

				// replace all
				textModel.applyEdits([{
					index: 0,
					editType: CellEditType.Output,
					outputs: [{
						outputId: 'someId3',
						outputs: [{ mime: Mimes.text, data: valueBytesFromString('Last, replaced output') }]
					}]
				}], true, undefined, () => undefined, undefined, true);

				assert.strictEqual(textModel.cells.length, 1);
				assert.strictEqual(textModel.cells[0].outputs.length, 1);
				[first] = textModel.cells[0].outputs;
				assert.strictEqual(first.outputId, 'someId3');
			}
		);
	});

	it('multiple append output in one position', async function () {
		await withTestNotebook(
			[
				['var a = 1;', 'javascript', CellKind.Code, [], {}],
			],
			(editor) => {
				const textModel = editor.textModel;

				// append
				textModel.applyEdits([
					{
						index: 0,
						editType: CellEditType.Output,
						append: true,
						outputs: [{
							outputId: 'append1',
							outputs: [{ mime: Mimes.markdown, data: valueBytesFromString('append 1') }]
						}]
					},
					{
						index: 0,
						editType: CellEditType.Output,
						append: true,
						outputs: [{
							outputId: 'append2',
							outputs: [{ mime: Mimes.markdown, data: valueBytesFromString('append 2') }]
						}]
					}
				], true, undefined, () => undefined, undefined, true);

				assert.strictEqual(textModel.cells.length, 1);
				assert.strictEqual(textModel.cells[0].outputs.length, 2);
				const [first, second] = textModel.cells[0].outputs;
				assert.strictEqual(first.outputId, 'append1');
				assert.strictEqual(second.outputId, 'append2');
			}
		);
	});

	it('append to output created in same batch', async function () {
		await withTestNotebook(
			[
				['var a = 1;', 'javascript', CellKind.Code, [], {}],
			],
			(editor) => {
				const textModel = editor.textModel;

				textModel.applyEdits([
					{
						index: 0,
						editType: CellEditType.Output,
						append: true,
						outputs: [{
							outputId: 'append1',
							outputs: [{ mime: Mimes.markdown, data: valueBytesFromString('append 1') }]
						}]
					},
					{
						editType: CellEditType.OutputItems,
						append: true,
						outputId: 'append1',
						items: [{
							mime: Mimes.markdown, data: valueBytesFromString('append 2')
						}]
					}
				], true, undefined, () => undefined, undefined, true);

				assert.strictEqual(textModel.cells.length, 1);
				assert.strictEqual(textModel.cells[0].outputs.length, 1, 'has 1 output');
				const [first] = textModel.cells[0].outputs;
				assert.strictEqual(first.outputId, 'append1');
				assert.strictEqual(first.outputs.length, 2, 'has 2 items');
			}
		);
	});

	const stdOutMime = 'application/vnd.code.notebook.stdout';
	const stdErrMime = 'application/vnd.code.notebook.stderr';

	it('appending streaming outputs', async function () {
		await withTestNotebook(
			[
				['var a = 1;', 'javascript', CellKind.Code, [], {}],
			],
			(editor) => {
				const textModel = editor.textModel;

				textModel.applyEdits([
					{
						index: 0,
						editType: CellEditType.Output,
						append: true,
						outputs: [{
							outputId: 'append1',
							outputs: [{ mime: stdOutMime, data: valueBytesFromString('append 1') }]
						}]
					}], true, undefined, () => undefined, undefined, true);
				const [output] = textModel.cells[0].outputs;
				assert.strictEqual(output.versionId, 0, 'initial output version should be 0');

				textModel.applyEdits([
					{
						editType: CellEditType.OutputItems,
						append: true,
						outputId: 'append1',
						items: [
							{ mime: stdOutMime, data: valueBytesFromString('append 2') },
							{ mime: stdOutMime, data: valueBytesFromString('append 3') }
						]
					}], true, undefined, () => undefined, undefined, true);
				assert.strictEqual(output.versionId, 1, 'version should bump per append');

				textModel.applyEdits([
					{
						editType: CellEditType.OutputItems,
						append: true,
						outputId: 'append1',
						items: [
							{ mime: stdOutMime, data: valueBytesFromString('append 4') },
							{ mime: stdOutMime, data: valueBytesFromString('append 5') }
						]
					}], true, undefined, () => undefined, undefined, true);
				assert.strictEqual(output.versionId, 2, 'version should bump per append');

				assert.strictEqual(textModel.cells.length, 1);
				assert.strictEqual(textModel.cells[0].outputs.length, 1, 'has 1 output');
				assert.strictEqual(output.outputId, 'append1');
				assert.strictEqual(output.outputs.length, 1, 'outputs are compressed');
				assert.strictEqual(output.outputs[0].data.toString(), 'append 1append 2append 3append 4append 5');
				assert.strictEqual(output.appendedSinceVersion(0, stdOutMime)?.toString(), 'append 2append 3append 4append 5');
				assert.strictEqual(output.appendedSinceVersion(1, stdOutMime)?.toString(), 'append 4append 5');
				assert.strictEqual(output.appendedSinceVersion(2, stdOutMime), undefined);
				assert.strictEqual(output.appendedSinceVersion(2, stdErrMime), undefined);
			}
		);
	});

	it('replacing streaming outputs', async function () {
		await withTestNotebook(
			[
				['var a = 1;', 'javascript', CellKind.Code, [], {}],
			],
			(editor) => {
				const textModel = editor.textModel;

				textModel.applyEdits([
					{
						index: 0,
						editType: CellEditType.Output,
						append: true,
						outputs: [{
							outputId: 'append1',
							outputs: [{ mime: stdOutMime, data: valueBytesFromString('append 1') }]
						}]
					}], true, undefined, () => undefined, undefined, true);
				const [output] = textModel.cells[0].outputs;
				assert.strictEqual(output.versionId, 0, 'initial output version should be 0');

				textModel.applyEdits([
					{
						editType: CellEditType.OutputItems,
						append: true,
						outputId: 'append1',
						items: [{
							mime: stdOutMime, data: valueBytesFromString('append 2')
						}]
					}], true, undefined, () => undefined, undefined, true);
				assert.strictEqual(output.versionId, 1, 'version should bump per append');

				textModel.applyEdits([
					{
						editType: CellEditType.OutputItems,
						append: false,
						outputId: 'append1',
						items: [{
							mime: stdOutMime, data: valueBytesFromString('replace 3')
						}]
					}], true, undefined, () => undefined, undefined, true);
				assert.strictEqual(output.versionId, 2, 'version should bump per replace');

				textModel.applyEdits([
					{
						editType: CellEditType.OutputItems,
						append: true,
						outputId: 'append1',
						items: [{
							mime: stdOutMime, data: valueBytesFromString('append 4')
						}]
					}], true, undefined, () => undefined, undefined, true);
				assert.strictEqual(output.versionId, 3, 'version should bump per append');

				assert.strictEqual(output.outputs[0].data.toString(), 'replace 3append 4');
				assert.strictEqual(output.appendedSinceVersion(0, stdOutMime), undefined,
					'replacing output should clear out previous versioned output buffers');
				assert.strictEqual(output.appendedSinceVersion(1, stdOutMime), undefined,
					'replacing output should clear out previous versioned output buffers');
				assert.strictEqual(output.appendedSinceVersion(2, stdOutMime)?.toString(), 'append 4');
			}
		);
	});

	it('appending streaming outputs with move cursor compression', async function () {

		await withTestNotebook(
			[
				['var a = 1;', 'javascript', CellKind.Code, [], {}],
			],
			(editor) => {
				const textModel = editor.textModel;

				textModel.applyEdits([
					{
						index: 0,
						editType: CellEditType.Output,
						append: true,
						outputs: [{
							outputId: 'append1',
							outputs: [
								{ mime: stdOutMime, data: valueBytesFromString('append 1') },
								{ mime: stdOutMime, data: valueBytesFromString('\nappend 1') }]
						}]
					}], true, undefined, () => undefined, undefined, true);
				const [output] = textModel.cells[0].outputs;
				assert.strictEqual(output.versionId, 0, 'initial output version should be 0');

				textModel.applyEdits([
					{
						editType: CellEditType.OutputItems,
						append: true,
						outputId: 'append1',
						items: [{
							mime: stdOutMime, data: valueBytesFromString(MOVE_CURSOR_1_LINE_COMMAND + '\nappend 2')
						}]
					}], true, undefined, () => undefined, undefined, true);
				assert.strictEqual(output.versionId, 1, 'version should bump per append');

				assert.strictEqual(output.outputs[0].data.toString(), 'append 1\nappend 2');
				assert.strictEqual(output.appendedSinceVersion(0, stdOutMime), undefined,
					'compressing outputs should clear out previous versioned output buffers');
			}
		);
	});

	it('appending streaming outputs with carraige return compression', async function () {

		await withTestNotebook(
			[
				['var a = 1;', 'javascript', CellKind.Code, [], {}],
			],
			(editor) => {
				const textModel = editor.textModel;

				textModel.applyEdits([
					{
						index: 0,
						editType: CellEditType.Output,
						append: true,
						outputs: [{
							outputId: 'append1',
							outputs: [
								{ mime: stdOutMime, data: valueBytesFromString('append 1') },
								{ mime: stdOutMime, data: valueBytesFromString('\nappend 1') }]
						}]
					}], true, undefined, () => undefined, undefined, true);
				const [output] = textModel.cells[0].outputs;
				assert.strictEqual(output.versionId, 0, 'initial output version should be 0');

				textModel.applyEdits([
					{
						editType: CellEditType.OutputItems,
						append: true,
						outputId: 'append1',
						items: [{
							mime: stdOutMime, data: valueBytesFromString('\rappend 2')
						}]
					}], true, undefined, () => undefined, undefined, true);
				assert.strictEqual(output.versionId, 1, 'version should bump per append');

				assert.strictEqual(output.outputs[0].data.toString(), 'append 1\nappend 2');
				assert.strictEqual(output.appendedSinceVersion(0, stdOutMime), undefined,
					'compressing outputs should clear out previous versioned output buffers');
			}
		);
	});

	it('appending multiple different mime streaming outputs', async function () {
		await withTestNotebook(
			[
				['var a = 1;', 'javascript', CellKind.Code, [], {}],
			],
			(editor) => {
				const textModel = editor.textModel;

				textModel.applyEdits([
					{
						index: 0,
						editType: CellEditType.Output,
						append: true,
						outputs: [{
							outputId: 'append1',
							outputs: [
								{ mime: stdOutMime, data: valueBytesFromString('stdout 1') },
								{ mime: stdErrMime, data: valueBytesFromString('stderr 1') }
							]
						}]
					}], true, undefined, () => undefined, undefined, true);
				const [output] = textModel.cells[0].outputs;
				assert.strictEqual(output.versionId, 0, 'initial output version should be 0');

				textModel.applyEdits([
					{
						editType: CellEditType.OutputItems,
						append: true,
						outputId: 'append1',
						items: [
							{ mime: stdOutMime, data: valueBytesFromString('stdout 2') },
							{ mime: stdErrMime, data: valueBytesFromString('stderr 2') }
						]
					}], true, undefined, () => undefined, undefined, true);
				assert.strictEqual(output.versionId, 1, 'version should bump per replace');

				assert.strictEqual(output.appendedSinceVersion(0, stdErrMime)?.toString(), 'stderr 2');
				assert.strictEqual(output.appendedSinceVersion(0, stdOutMime)?.toString(), 'stdout 2');
			}
		);
	});

	it('metadata', async function () {
		await withTestNotebook(
			[
				['var a = 1;', 'javascript', CellKind.Code, [], {}],
			],
			(editor) => {
				const textModel = editor.textModel;

				// invalid index 1
				assert.throws(() => {
					textModel.applyEdits([{
						index: Number.MAX_VALUE,
						editType: CellEditType.Metadata,
						metadata: {}
					}], true, undefined, () => undefined, undefined, true);
				});

				// invalid index 2
				assert.throws(() => {
					textModel.applyEdits([{
						index: -1,
						editType: CellEditType.Metadata,
						metadata: {}
					}], true, undefined, () => undefined, undefined, true);
				});

				textModel.applyEdits([{
					index: 0,
					editType: CellEditType.Metadata,
					metadata: { customProperty: 15 },
				}], true, undefined, () => undefined, undefined, true);

				textModel.applyEdits([{
					index: 0,
					editType: CellEditType.Metadata,
					metadata: {},
				}], true, undefined, () => undefined, undefined, true);

				assert.strictEqual(textModel.cells.length, 1);
				assert.strictEqual(textModel.cells[0].metadata.customProperty, undefined);
			}
		);
	});

	it('partial metadata', async function () {
		await withTestNotebook(
			[
				['var a = 1;', 'javascript', CellKind.Code, [], {}],
			],
			(editor) => {
				const textModel = editor.textModel;

				textModel.applyEdits([{
					index: 0,
					editType: CellEditType.PartialMetadata,
					metadata: { customProperty: 15 },
				}], true, undefined, () => undefined, undefined, true);

				textModel.applyEdits([{
					index: 0,
					editType: CellEditType.PartialMetadata,
					metadata: {},
				}], true, undefined, () => undefined, undefined, true);

				assert.strictEqual(textModel.cells.length, 1);
				assert.strictEqual(textModel.cells[0].metadata.customProperty, 15);
			}
		);
	});

	it('multiple inserts in one edit', async function () {
		await withTestNotebook(
			[
				['var a = 1;', 'javascript', CellKind.Code, [], {}],
				['var b = 2;', 'javascript', CellKind.Code, [], {}],
				['var c = 3;', 'javascript', CellKind.Code, [], {}],
				['var d = 4;', 'javascript', CellKind.Code, [], {}]
			],
			(editor, _viewModel, ds) => {
				const textModel = editor.textModel;
				let changeEvent: NotebookTextModelChangedEvent | undefined = undefined;
				const eventListener = textModel.onDidChangeContent(e => {
					changeEvent = e;
				});
				const willChangeEvents: NotebookTextModelWillAddRemoveEvent[] = [];
				const willChangeListener = textModel.onWillAddRemoveCells(e => {
					willChangeEvents.push(e);
				});
				const version = textModel.versionId;

				textModel.applyEdits([
					{ editType: CellEditType.Replace, index: 1, count: 1, cells: [] },
					{ editType: CellEditType.Replace, index: 1, count: 0, cells: [ds.add(new TestCell(textModel.viewType, 5, 'var e = 5;', 'javascript', CellKind.Code, [], languageService))] },
				], true, undefined, () => ({ kind: SelectionStateType.Index, focus: { start: 0, end: 1 }, selections: [{ start: 0, end: 1 }] }), undefined, true);

				assert.strictEqual(textModel.cells.length, 4);
				assert.strictEqual(textModel.cells[0].getValue(), 'var a = 1;');
				assert.strictEqual(textModel.cells[1].getValue(), 'var e = 5;');
				assert.strictEqual(textModel.cells[2].getValue(), 'var c = 3;');

				assert.notStrictEqual(changeEvent, undefined);
				assert.strictEqual(changeEvent!.rawEvents.length, 2);
				assert.deepStrictEqual(changeEvent!.endSelectionState?.selections, [{ start: 0, end: 1 }]);
				assert.strictEqual(willChangeEvents.length, 2);
				assert.strictEqual(textModel.versionId, version + 1);
				eventListener.dispose();
				willChangeListener.dispose();
			}
		);
	});

	it('insert and metadata change in one edit', async function () {
		await withTestNotebook(
			[
				['var a = 1;', 'javascript', CellKind.Code, [], {}],
				['var b = 2;', 'javascript', CellKind.Code, [], {}],
				['var c = 3;', 'javascript', CellKind.Code, [], {}],
				['var d = 4;', 'javascript', CellKind.Code, [], {}]
			],
			(editor) => {
				const textModel = editor.textModel;
				let changeEvent: NotebookTextModelChangedEvent | undefined = undefined;
				const eventListener = textModel.onDidChangeContent(e => {
					changeEvent = e;
				});
				const willChangeEvents: NotebookTextModelWillAddRemoveEvent[] = [];
				const willChangeListener = textModel.onWillAddRemoveCells(e => {
					willChangeEvents.push(e);
				});

				const version = textModel.versionId;

				textModel.applyEdits([
					{ editType: CellEditType.Replace, index: 1, count: 1, cells: [] },
					{
						index: 0,
						editType: CellEditType.Metadata,
						metadata: {},
					}
				], true, undefined, () => ({ kind: SelectionStateType.Index, focus: { start: 0, end: 1 }, selections: [{ start: 0, end: 1 }] }), undefined, true);

				assert.notStrictEqual(changeEvent, undefined);
				assert.strictEqual(changeEvent!.rawEvents.length, 2);
				assert.deepStrictEqual(changeEvent!.endSelectionState?.selections, [{ start: 0, end: 1 }]);
				assert.strictEqual(willChangeEvents.length, 1);
				assert.strictEqual(textModel.versionId, version + 1);
				eventListener.dispose();
				willChangeListener.dispose();
			}
		);
	});


	it('Updating appending/updating output in Notebooks does not work as expected #117273', async function () {
		await withTestNotebook([
			['var a = 1;', 'javascript', CellKind.Code, [], {}]
		], (editor) => {
			const model = editor.textModel;

			assert.strictEqual(model.cells.length, 1);
			assert.strictEqual(model.cells[0].outputs.length, 0);

			const success1 = model.applyEdits(
				[{
					editType: CellEditType.Output, index: 0, outputs: [
						{ outputId: 'out1', outputs: [{ mime: 'application/x.notebook.stream', data: VSBuffer.wrap(new Uint8Array([1])) }] }
					],
					append: false
				}], true, undefined, () => undefined, undefined, false
			);

			assert.ok(success1);
			assert.strictEqual(model.cells[0].outputs.length, 1);

			const success2 = model.applyEdits(
				[{
					editType: CellEditType.Output, index: 0, outputs: [
						{ outputId: 'out2', outputs: [{ mime: 'application/x.notebook.stream', data: VSBuffer.wrap(new Uint8Array([1])) }] }
					],
					append: true
				}], true, undefined, () => undefined, undefined, false
			);

			assert.ok(success2);
			assert.strictEqual(model.cells[0].outputs.length, 2);
		});
	});

	it('Clearing output of an empty notebook makes it dirty #119608', async function () {
		await withTestNotebook([
			['var a = 1;', 'javascript', CellKind.Code, [], {}],
			['var b = 2;', 'javascript', CellKind.Code, [], {}]
		], (editor, _, ds) => {
			const model = editor.textModel;

			let event: NotebookTextModelChangedEvent | undefined;

			ds.add(model.onDidChangeContent(e => { event = e; }));

			{
				// 1: add ouput -> event
				const success = model.applyEdits(
					[{
						editType: CellEditType.Output, index: 0, outputs: [
							{ outputId: 'out1', outputs: [{ mime: 'application/x.notebook.stream', data: VSBuffer.wrap(new Uint8Array([1])) }] }
						],
						append: false
					}], true, undefined, () => undefined, undefined, false
				);

				assert.ok(success);
				assert.strictEqual(model.cells[0].outputs.length, 1);
				assert.ok(event);
			}

			{
				// 2: clear all output w/ output -> event
				event = undefined;
				const success = model.applyEdits(
					[{
						editType: CellEditType.Output,
						index: 0,
						outputs: [],
						append: false
					}, {
						editType: CellEditType.Output,
						index: 1,
						outputs: [],
						append: false
					}], true, undefined, () => undefined, undefined, false
				);
				assert.ok(success);
				assert.ok(event);
			}

			{
				// 2: clear all output wo/ output -> NO event
				event = undefined;
				const success = model.applyEdits(
					[{
						editType: CellEditType.Output,
						index: 0,
						outputs: [],
						append: false
					}, {
						editType: CellEditType.Output,
						index: 1,
						outputs: [],
						append: false
					}], true, undefined, () => undefined, undefined, false
				);

				assert.ok(success);
				assert.ok(event === undefined);
			}
		});
	});

	it('Cell metadata/output change should update version id and alternative id #121807', async function () {
		await withTestNotebook([
			['var a = 1;', 'javascript', CellKind.Code, [], {}],
			['var b = 2;', 'javascript', CellKind.Code, [], {}]
		], async (editor, viewModel) => {
			assert.strictEqual(editor.textModel.versionId, 0);
			const firstAltVersion = '0_0,1;1,1';
			assert.strictEqual(editor.textModel.alternativeVersionId, firstAltVersion);
			editor.textModel.applyEdits([
				{
					index: 0,
					editType: CellEditType.Metadata,
					metadata: {
						inputCollapsed: true
					}
				}
			], true, undefined, () => undefined, undefined, true);
			assert.strictEqual(editor.textModel.versionId, 1);
			assert.notStrictEqual(editor.textModel.alternativeVersionId, firstAltVersion);
			const secondAltVersion = '1_0,1;1,1';
			assert.strictEqual(editor.textModel.alternativeVersionId, secondAltVersion);

			await viewModel.undo();
			assert.strictEqual(editor.textModel.versionId, 2);
			assert.strictEqual(editor.textModel.alternativeVersionId, firstAltVersion);

			await viewModel.redo();
			assert.strictEqual(editor.textModel.versionId, 3);
			assert.notStrictEqual(editor.textModel.alternativeVersionId, firstAltVersion);
			assert.strictEqual(editor.textModel.alternativeVersionId, secondAltVersion);

			editor.textModel.applyEdits([
				{
					index: 1,
					editType: CellEditType.Metadata,
					metadata: {
						inputCollapsed: true
					}
				}
			], true, undefined, () => undefined, undefined, true);
			assert.strictEqual(editor.textModel.versionId, 4);
			assert.strictEqual(editor.textModel.alternativeVersionId, '4_0,1;1,1');

			await viewModel.undo();
			assert.strictEqual(editor.textModel.versionId, 5);
			assert.strictEqual(editor.textModel.alternativeVersionId, secondAltVersion);

		});
	});

	it('metadata changes on newly added cells should combine their undo operations', async function () {
		await withTestNotebook([
			['var a = 1;', 'javascript', CellKind.Code, [], {}]
		], async (editor, viewModel, ds) => {
			const textModel = editor.textModel;
			editor.textModel.applyEdits([
				{
					editType: CellEditType.Replace, index: 1, count: 0, cells: [
						ds.add(new TestCell(textModel.viewType, 1, 'var e = 5;', 'javascript', CellKind.Code, [], languageService)),
						ds.add(new TestCell(textModel.viewType, 2, 'var f = 6;', 'javascript', CellKind.Code, [], languageService))
					]
				},
			], true, undefined, () => undefined, undefined, true);

			assert.strictEqual(textModel.cells.length, 3);

			editor.textModel.applyEdits([
				{ editType: CellEditType.Metadata, index: 1, metadata: { id: '123' } },
			], true, undefined, () => undefined, undefined, true);

			assert.strictEqual(textModel.cells[1].metadata.id, '123');

			await viewModel.undo();

			assert.strictEqual(textModel.cells.length, 1);

			await viewModel.redo();

			assert.strictEqual(textModel.cells.length, 3);
		});
	});

	it('changes with non-metadata edit should not combine their undo operations', async function () {
		await withTestNotebook([
			['var a = 1;', 'javascript', CellKind.Code, [], {}]
		], async (editor, viewModel, ds) => {
			const textModel = editor.textModel;
			editor.textModel.applyEdits([
				{
					editType: CellEditType.Replace, index: 1, count: 0, cells: [
						ds.add(new TestCell(textModel.viewType, 1, 'var e = 5;', 'javascript', CellKind.Code, [], languageService)),
						ds.add(new TestCell(textModel.viewType, 2, 'var f = 6;', 'javascript', CellKind.Code, [], languageService))
					]
				},
			], true, undefined, () => undefined, undefined, true);

			assert.strictEqual(textModel.cells.length, 3);

			editor.textModel.applyEdits([
				{ editType: CellEditType.Metadata, index: 1, metadata: { id: '123' } },
				{
					editType: CellEditType.Output, handle: 0, append: true, outputs: [{
						outputId: 'newOutput',
						outputs: [{ mime: Mimes.text, data: valueBytesFromString('cba') }, { mime: 'application/foo', data: valueBytesFromString('cba') }]
					}]
				}
			], true, undefined, () => undefined, undefined, true);

			assert.strictEqual(textModel.cells[1].metadata.id, '123');

			await viewModel.undo();

			assert.strictEqual(textModel.cells.length, 3);

			await viewModel.undo();

			assert.strictEqual(textModel.cells.length, 1);
		});
	});

	it('Destructive sorting in _doApplyEdits #121994', async function () {
		await withTestNotebook([
			['var a = 1;', 'javascript', CellKind.Code, [{ outputId: 'i42', outputs: [{ mime: 'm/ime', data: valueBytesFromString('test') }] }], {}]
		], async (editor) => {

			const notebook = editor.textModel;

			assert.strictEqual(notebook.cells[0].outputs.length, 1);
			assert.strictEqual(notebook.cells[0].outputs[0].outputs.length, 1);
			assert.deepStrictEqual(notebook.cells[0].outputs[0].outputs[0].data, valueBytesFromString('test'));

			const edits: ICellEditOperation[] = [
				{
					editType: CellEditType.Output, handle: 0, outputs: []
				},
				{
					editType: CellEditType.Output, handle: 0, append: true, outputs: [{
						outputId: 'newOutput',
						outputs: [{ mime: Mimes.text, data: valueBytesFromString('cba') }, { mime: 'application/foo', data: valueBytesFromString('cba') }]
					}]
				}
			];

			editor.textModel.applyEdits(edits, true, undefined, () => undefined, undefined, true);

			assert.strictEqual(notebook.cells[0].outputs.length, 1);
			assert.strictEqual(notebook.cells[0].outputs[0].outputs.length, 2);
		});
	});

	it('Destructive sorting in _doApplyEdits #121994. cell splice between output changes', async function () {
		await withTestNotebook([
			['var a = 1;', 'javascript', CellKind.Code, [{ outputId: 'i42', outputs: [{ mime: 'm/ime', data: valueBytesFromString('test') }] }], {}],
			['var b = 2;', 'javascript', CellKind.Code, [{ outputId: 'i43', outputs: [{ mime: 'm/ime', data: valueBytesFromString('test') }] }], {}],
			['var c = 3;', 'javascript', CellKind.Code, [{ outputId: 'i44', outputs: [{ mime: 'm/ime', data: valueBytesFromString('test') }] }], {}]
		], async (editor) => {
			const notebook = editor.textModel;

			const edits: ICellEditOperation[] = [
				{
					editType: CellEditType.Output, index: 0, outputs: []
				},
				{
					editType: CellEditType.Replace, index: 1, count: 1, cells: []
				},
				{
					editType: CellEditType.Output, index: 2, append: true, outputs: [{
						outputId: 'newOutput',
						outputs: [{ mime: Mimes.text, data: valueBytesFromString('cba') }, { mime: 'application/foo', data: valueBytesFromString('cba') }]
					}]
				}
			];

			editor.textModel.applyEdits(edits, true, undefined, () => undefined, undefined, true);

			assert.strictEqual(notebook.cells.length, 2);
			assert.strictEqual(notebook.cells[0].outputs.length, 0);
			assert.strictEqual(notebook.cells[1].outputs.length, 2);
			assert.strictEqual(notebook.cells[1].outputs[0].outputId, 'i44');
			assert.strictEqual(notebook.cells[1].outputs[1].outputId, 'newOutput');
		});
	});

	it('Destructive sorting in _doApplyEdits #121994. cell splice between output changes 2', async function () {
		await withTestNotebook([
			['var a = 1;', 'javascript', CellKind.Code, [{ outputId: 'i42', outputs: [{ mime: 'm/ime', data: valueBytesFromString('test') }] }], {}],
			['var b = 2;', 'javascript', CellKind.Code, [{ outputId: 'i43', outputs: [{ mime: 'm/ime', data: valueBytesFromString('test') }] }], {}],
			['var c = 3;', 'javascript', CellKind.Code, [{ outputId: 'i44', outputs: [{ mime: 'm/ime', data: valueBytesFromString('test') }] }], {}]
		], async (editor) => {
			const notebook = editor.textModel;

			const edits: ICellEditOperation[] = [
				{
					editType: CellEditType.Output, index: 1, append: true, outputs: [{
						outputId: 'newOutput',
						outputs: [{ mime: Mimes.text, data: valueBytesFromString('cba') }, { mime: 'application/foo', data: valueBytesFromString('cba') }]
					}]
				},
				{
					editType: CellEditType.Replace, index: 1, count: 1, cells: []
				},
				{
					editType: CellEditType.Output, index: 1, append: true, outputs: [{
						outputId: 'newOutput2',
						outputs: [{ mime: Mimes.text, data: valueBytesFromString('cba') }, { mime: 'application/foo', data: valueBytesFromString('cba') }]
					}]
				}
			];

			editor.textModel.applyEdits(edits, true, undefined, () => undefined, undefined, true);

			assert.strictEqual(notebook.cells.length, 2);
			assert.strictEqual(notebook.cells[0].outputs.length, 1);
			assert.strictEqual(notebook.cells[1].outputs.length, 1);
			assert.strictEqual(notebook.cells[1].outputs[0].outputId, 'i44');
		});
	});

	it('Output edits splice', async function () {
		await withTestNotebook([
			['var a = 1;', 'javascript', CellKind.Code, [], {}]
		], (editor) => {
			const model = editor.textModel;

			assert.strictEqual(model.cells.length, 1);
			assert.strictEqual(model.cells[0].outputs.length, 0);

			const success1 = model.applyEdits(
				[{
					editType: CellEditType.Output, index: 0, outputs: [
						{ outputId: 'out1', outputs: [{ mime: 'application/x.notebook.stream', data: valueBytesFromString('1') }] },
						{ outputId: 'out2', outputs: [{ mime: 'application/x.notebook.stream', data: valueBytesFromString('2') }] },
						{ outputId: 'out3', outputs: [{ mime: 'application/x.notebook.stream', data: valueBytesFromString('3') }] },
						{ outputId: 'out4', outputs: [{ mime: 'application/x.notebook.stream', data: valueBytesFromString('4') }] }
					],
					append: false
				}], true, undefined, () => undefined, undefined, false
			);

			assert.ok(success1);
			assert.strictEqual(model.cells[0].outputs.length, 4);

			const success2 = model.applyEdits(
				[{
					editType: CellEditType.Output, index: 0, outputs: [
						{ outputId: 'out1', outputs: [{ mime: 'application/x.notebook.stream', data: valueBytesFromString('1') }] },
						{ outputId: 'out5', outputs: [{ mime: 'application/x.notebook.stream', data: valueBytesFromString('5') }] },
						{ outputId: 'out3', outputs: [{ mime: 'application/x.notebook.stream', data: valueBytesFromString('3') }] },
						{ outputId: 'out6', outputs: [{ mime: 'application/x.notebook.stream', data: valueBytesFromString('6') }] }
					],
					append: false
				}], true, undefined, () => undefined, undefined, false
			);

			assert.ok(success2);
			assert.strictEqual(model.cells[0].outputs.length, 4);
			assert.strictEqual(model.cells[0].outputs[0].outputId, 'out1');
			assert.strictEqual(model.cells[0].outputs[1].outputId, 'out5');
			assert.strictEqual(model.cells[0].outputs[2].outputId, 'out3');
			assert.strictEqual(model.cells[0].outputs[3].outputId, 'out6');
		});
	});

	it('computeEdits no insert', async function () {
		await withTestNotebook([
			['var a = 1;', 'javascript', CellKind.Code, [], {}]
		], (editor) => {
			const model = editor.textModel;
			const edits = NotebookTextModel.computeEdits(model, [
				{ source: 'var a = 1;', language: 'javascript', cellKind: CellKind.Code, mime: undefined, outputs: [], metadata: undefined }
			]);

			assert.deepStrictEqual(edits, [
				{ editType: CellEditType.Metadata, index: 0, metadata: {} }
			]);
		});
	});

	it('computeEdits cell content changed', async function () {
		await withTestNotebook([
			['var a = 1;', 'javascript', CellKind.Code, [], {}]
		], (editor) => {
			const model = editor.textModel;
			const cells = [
				{ source: 'var a = 2;', language: 'javascript', cellKind: CellKind.Code, mime: undefined, outputs: [], metadata: undefined }
			];
			const edits = NotebookTextModel.computeEdits(model, cells);

			assert.deepStrictEqual(edits, [
				{ editType: CellEditType.Replace, index: 0, count: 1, cells },
			]);
		});
	});

	it('computeEdits last cell content changed', async function () {
		await withTestNotebook([
			['var a = 1;', 'javascript', CellKind.Code, [], {}],
			['var b = 1;', 'javascript', CellKind.Code, [], {}]
		], (editor) => {
			const model = editor.textModel;
			const cells = [
				{ source: 'var a = 1;', language: 'javascript', cellKind: CellKind.Code, mime: undefined, outputs: [], metadata: undefined },
				{ source: 'var b = 2;', language: 'javascript', cellKind: CellKind.Code, mime: undefined, outputs: [], metadata: undefined }
			];
			const edits = NotebookTextModel.computeEdits(model, cells);

			assert.deepStrictEqual(edits, [
				{ editType: CellEditType.Metadata, index: 0, metadata: {} },
				{ editType: CellEditType.Replace, index: 1, count: 1, cells: cells.slice(1) },
			]);
		});
	});
	it('computeEdits first cell content changed', async function () {
		await withTestNotebook([
			['var a = 1;', 'javascript', CellKind.Code, [], {}],
			['var b = 1;', 'javascript', CellKind.Code, [], {}]
		], (editor) => {
			const model = editor.textModel;
			const cells = [
				{ source: 'var a = 2;', language: 'javascript', cellKind: CellKind.Code, mime: undefined, outputs: [], metadata: undefined },
				{ source: 'var b = 1;', language: 'javascript', cellKind: CellKind.Code, mime: undefined, outputs: [], metadata: undefined }
			];
			const edits = NotebookTextModel.computeEdits(model, cells);

			assert.deepStrictEqual(edits, [
				{ editType: CellEditType.Replace, index: 0, count: 1, cells: cells.slice(0, 1) },
				{ editType: CellEditType.Metadata, index: 1, metadata: {} },
			]);
		});
	});

	it('computeEdits middle cell content changed', async function () {
		await withTestNotebook([
			['var a = 1;', 'javascript', CellKind.Code, [], {}],
			['var b = 1;', 'javascript', CellKind.Code, [], {}],
			['var c = 1;', 'javascript', CellKind.Code, [], {}],
		], (editor) => {
			const model = editor.textModel;
			const cells = [
				{ source: 'var a = 1;', language: 'javascript', cellKind: CellKind.Code, mime: undefined, outputs: [], metadata: undefined },
				{ source: 'var b = 2;', language: 'javascript', cellKind: CellKind.Code, mime: undefined, outputs: [], metadata: undefined },
				{ source: 'var c = 1;', language: 'javascript', cellKind: CellKind.Code, mime: undefined, outputs: [], metadata: undefined }
			];
			const edits = NotebookTextModel.computeEdits(model, cells);

			assert.deepStrictEqual(edits, [
				{ editType: CellEditType.Metadata, index: 0, metadata: {} },
				{ editType: CellEditType.Replace, index: 1, count: 1, cells: cells.slice(1, 2) },
				{ editType: CellEditType.Metadata, index: 2, metadata: {} },
			]);
		});
	});

	it('computeEdits cell metadata changed', async function () {
		await withTestNotebook([
			['var a = 1;', 'javascript', CellKind.Code, [], {}],
			['var b = 1;', 'javascript', CellKind.Code, [], {}]
		], (editor) => {
			const model = editor.textModel;
			const cells = [
				{ source: 'var a = 1;', language: 'javascript', cellKind: CellKind.Code, mime: undefined, outputs: [], metadata: { name: 'foo' } },
				{ source: 'var b = 1;', language: 'javascript', cellKind: CellKind.Code, mime: undefined, outputs: [], metadata: undefined }
			];
			const edits = NotebookTextModel.computeEdits(model, cells);

			assert.deepStrictEqual(edits, [
				{ editType: CellEditType.Metadata, index: 0, metadata: { name: 'foo' } },
				{ editType: CellEditType.Metadata, index: 1, metadata: {} },
			]);
		});
	});

	it('computeEdits cell language changed', async function () {
		await withTestNotebook([
			['var a = 1;', 'javascript', CellKind.Code, [], {}],
			['var b = 1;', 'javascript', CellKind.Code, [], {}]
		], (editor) => {
			const model = editor.textModel;
			const cells = [
				{ source: 'var a = 1;', language: 'typescript', cellKind: CellKind.Code, mime: undefined, outputs: [], metadata: undefined },
				{ source: 'var b = 1;', language: 'javascript', cellKind: CellKind.Code, mime: undefined, outputs: [], metadata: undefined }
			];
			const edits = NotebookTextModel.computeEdits(model, cells);

			assert.deepStrictEqual(edits, [
				{ editType: CellEditType.Replace, index: 0, count: 1, cells: cells.slice(0, 1) },
				{ editType: CellEditType.Metadata, index: 1, metadata: {} },
			]);
		});
	});

	it('computeEdits cell kind changed', async function () {
		await withTestNotebook([
			['var a = 1;', 'javascript', CellKind.Code, [], {}],
			['var b = 1;', 'javascript', CellKind.Code, [], {}]
		], (editor) => {
			const model = editor.textModel;
			const cells = [
				{ source: 'var a = 1;', language: 'javascript', cellKind: CellKind.Code, mime: undefined, outputs: [], metadata: undefined },
				{ source: 'var b = 1;', language: 'javascript', cellKind: CellKind.Markup, mime: undefined, outputs: [], metadata: undefined }
			];
			const edits = NotebookTextModel.computeEdits(model, cells);

			assert.deepStrictEqual(edits, [
				{ editType: CellEditType.Metadata, index: 0, metadata: {} },
				{ editType: CellEditType.Replace, index: 1, count: 1, cells: cells.slice(1) },
			]);
		});
	});

	it('computeEdits cell metadata & content changed', async function () {
		await withTestNotebook([
			['var a = 1;', 'javascript', CellKind.Code, [], {}],
			['var b = 1;', 'javascript', CellKind.Code, [], {}]
		], (editor) => {
			const model = editor.textModel;
			const cells = [
				{ source: 'var a = 1;', language: 'javascript', cellKind: CellKind.Code, mime: undefined, outputs: [], metadata: { name: 'foo' } },
				{ source: 'var b = 2;', language: 'javascript', cellKind: CellKind.Code, mime: undefined, outputs: [], metadata: { name: 'bar' } }
			];
			const edits = NotebookTextModel.computeEdits(model, cells);

			assert.deepStrictEqual(edits, [
				{ editType: CellEditType.Metadata, index: 0, metadata: { name: 'foo' } },
				{ editType: CellEditType.Replace, index: 1, count: 1, cells: cells.slice(1) }
			]);
		});
	});

	it('computeEdits cell content changed while executing', async function () {
		await withTestNotebook([
			['var a = 1;', 'javascript', CellKind.Code, [], {}],
			['var b = 1;', 'javascript', CellKind.Code, [], {}]
		], (editor) => {
			const model = editor.textModel;
			const cells = [
				{ source: 'var a = 1;', language: 'javascript', cellKind: CellKind.Code, mime: undefined, outputs: [], metadata: {} },
				{ source: 'var b = 2;', language: 'javascript', cellKind: CellKind.Code, mime: undefined, outputs: [], metadata: {} }
			];
			const edits = NotebookTextModel.computeEdits(model, cells, [model.cells[1].handle]);

			assert.deepStrictEqual(edits, [
				{ editType: CellEditType.Metadata, index: 0, metadata: {} },
				{ editType: CellEditType.Replace, index: 1, count: 1, cells: cells.slice(1) }
			]);
		});
	});

	it('computeEdits cell internal metadata changed', async function () {
		await withTestNotebook([
			['var a = 1;', 'javascript', CellKind.Code, [], {}],
			['var b = 1;', 'javascript', CellKind.Code, [], {}]
		], (editor) => {
			const model = editor.textModel;
			const cells = [
				{ source: 'var a = 1;', language: 'javascript', cellKind: CellKind.Code, mime: undefined, outputs: [], metadata: undefined, internalMetadata: { executionOrder: 1 } },
				{ source: 'var b = 1;', language: 'javascript', cellKind: CellKind.Code, mime: undefined, outputs: [], metadata: undefined }
			];
			const edits = NotebookTextModel.computeEdits(model, cells);

			assert.deepStrictEqual(edits, [
				{ editType: CellEditType.Replace, index: 0, count: 1, cells: cells.slice(0, 1) },
				{ editType: CellEditType.Metadata, index: 1, metadata: {} },
			]);
		});
	});

	it('computeEdits cell internal metadata changed while executing', async function () {
		await withTestNotebook([
			['var a = 1;', 'javascript', CellKind.Code, [], {}],
			['var b = 1;', 'javascript', CellKind.Code, [], {}]
		], (editor) => {
			const model = editor.textModel;
			const cells = [
				{ source: 'var a = 1;', language: 'javascript', cellKind: CellKind.Code, mime: undefined, outputs: [], metadata: {} },
				{ source: 'var b = 1;', language: 'javascript', cellKind: CellKind.Code, mime: undefined, outputs: [], metadata: {}, internalMetadata: { executionOrder: 1 } }
			];
			const edits = NotebookTextModel.computeEdits(model, cells, [model.cells[1].handle]);

			assert.deepStrictEqual(edits, [
				{ editType: CellEditType.Metadata, index: 0, metadata: {} },
				{ editType: CellEditType.Metadata, index: 1, metadata: {} },
			]);
		});
	});

	it('computeEdits cell insertion', async function () {
		await withTestNotebook([
			['var a = 1;', 'javascript', CellKind.Code, [], {}],
			['var b = 1;', 'javascript', CellKind.Code, [], {}]
		], (editor) => {
			const model = editor.textModel;
			const cells = [
				{ source: 'var a = 1;', language: 'javascript', cellKind: CellKind.Code, mime: undefined, outputs: [], metadata: undefined, },
				{ source: 'var c = 1;', language: 'javascript', cellKind: CellKind.Code, mime: undefined, outputs: [], metadata: undefined, },
				{ source: 'var b = 1;', language: 'javascript', cellKind: CellKind.Code, mime: undefined, outputs: [], metadata: { foo: 'bar' } }
			];
			const edits = NotebookTextModel.computeEdits(model, cells);

			assert.deepStrictEqual(edits, [
				{ editType: CellEditType.Metadata, index: 0, metadata: {} },
				{ editType: CellEditType.Replace, index: 1, count: 0, cells: cells.slice(1, 2) },
				{ editType: CellEditType.Metadata, index: 1, metadata: { foo: 'bar' } },
			]);

			model.applyEdits(edits, true, undefined, () => undefined, undefined, true);
			assert.equal(model.cells.length, 3);
			assert.equal(model.cells[1].getValue(), 'var c = 1;');
			assert.equal(model.cells[2].getValue(), 'var b = 1;');
			assert.deepStrictEqual(model.cells[2].metadata, { foo: 'bar' });
		});
	});

	it('computeEdits output changed', async function () {
		await withTestNotebook([
			['var a = 1;', 'javascript', CellKind.Code, [], {}],
			['var b = 1;', 'javascript', CellKind.Code, [], {}]
		], (editor) => {
			const model = editor.textModel;
			const cells = [
				{
					source: 'var a = 1;', language: 'javascript', cellKind: CellKind.Code, mime: undefined, outputs: [{
						outputId: 'someId',
						outputs: [{ mime: Mimes.markdown, data: valueBytesFromString('_World_') }]
					}], metadata: undefined,
				},
				{ source: 'var b = 1;', language: 'javascript', cellKind: CellKind.Code, mime: undefined, outputs: [], metadata: { foo: 'bar' } }
			];
			const edits = NotebookTextModel.computeEdits(model, cells);

			assert.deepStrictEqual(edits, [
				{ editType: CellEditType.Metadata, index: 0, metadata: {} },
				{
					editType: CellEditType.Output, index: 0, outputs: [{
						outputId: 'someId',
						outputs: [{ mime: Mimes.markdown, data: valueBytesFromString('_World_') }]
					}], append: false
				},
				{ editType: CellEditType.Metadata, index: 1, metadata: { foo: 'bar' } },
			]);

			model.applyEdits(edits, true, undefined, () => undefined, undefined, true);
			assert.equal(model.cells.length, 2);
			assert.strictEqual(model.cells[0].outputs.length, 1);
			assert.equal(model.cells[0].outputs[0].outputId, 'someId');
			assert.equal(model.cells[0].outputs[0].outputs[0].data.toString(), '_World_');
		});
	});

	it('computeEdits output items changed', async function () {
		await withTestNotebook([
			['var a = 1;', 'javascript', CellKind.Code, [{
				outputId: 'someId',
				outputs: [{ mime: Mimes.markdown, data: valueBytesFromString('_Hello_') }]
			}], {}],
			['var b = 1;', 'javascript', CellKind.Code, [], {}]
		], (editor) => {
			const model = editor.textModel;
			const cells = [
				{
					source: 'var a = 1;', language: 'javascript', cellKind: CellKind.Code, mime: undefined, outputs: [{
						outputId: 'someId',
						outputs: [{ mime: Mimes.markdown, data: valueBytesFromString('_World_') }]
					}], metadata: undefined,
				},
				{ source: 'var b = 1;', language: 'javascript', cellKind: CellKind.Code, mime: undefined, outputs: [], metadata: { foo: 'bar' } }
			];
			const edits = NotebookTextModel.computeEdits(model, cells);

			assert.deepStrictEqual(edits, [
				{ editType: CellEditType.Metadata, index: 0, metadata: {} },
				{ editType: CellEditType.OutputItems, outputId: 'someId', items: [{ mime: Mimes.markdown, data: valueBytesFromString('_World_') }], append: false },
				{ editType: CellEditType.Metadata, index: 1, metadata: { foo: 'bar' } },
			]);

			model.applyEdits(edits, true, undefined, () => undefined, undefined, true);
			assert.equal(model.cells.length, 2);
			assert.strictEqual(model.cells[0].outputs.length, 1);
			assert.equal(model.cells[0].outputs[0].outputId, 'someId');
			assert.equal(model.cells[0].outputs[0].outputs[0].data.toString(), '_World_');
		});
	});
	it('Append multiple text/plain output items', async function () {
		await withTestNotebook([
			['var a = 1;', 'javascript', CellKind.Code, [{
				outputId: '1',
				outputs: [{ mime: 'text/plain', data: valueBytesFromString('foo') }]
			}], {}]
		], (editor) => {
			const model = editor.textModel;
			const edits: ICellEditOperation[] = [
				{
					editType: CellEditType.OutputItems,
					outputId: '1',
					append: true,
					items: [{ mime: 'text/plain', data: VSBuffer.fromString('bar') }, { mime: 'text/plain', data: VSBuffer.fromString('baz') }]
				}
			];
			model.applyEdits(edits, true, undefined, () => undefined, undefined, true);
			assert.equal(model.cells.length, 1);
			assert.equal(model.cells[0].outputs.length, 1);
			assert.equal(model.cells[0].outputs[0].outputs.length, 3);
			assert.equal(model.cells[0].outputs[0].outputs[0].mime, 'text/plain');
			assert.equal(model.cells[0].outputs[0].outputs[0].data.toString(), 'foo');
			assert.equal(model.cells[0].outputs[0].outputs[1].mime, 'text/plain');
			assert.equal(model.cells[0].outputs[0].outputs[1].data.toString(), 'bar');
			assert.equal(model.cells[0].outputs[0].outputs[2].mime, 'text/plain');
			assert.equal(model.cells[0].outputs[0].outputs[2].data.toString(), 'baz');
		});
	});
	it('Append multiple stdout stream output items to an output with another mime', async function () {
		await withTestNotebook([
			['var a = 1;', 'javascript', CellKind.Code, [{
				outputId: '1',
				outputs: [{ mime: 'text/plain', data: valueBytesFromString('foo') }]
			}], {}]
		], (editor) => {
			const model = editor.textModel;
			const edits: ICellEditOperation[] = [
				{
					editType: CellEditType.OutputItems,
					outputId: '1',
					append: true,
					items: [{ mime: 'application/vnd.code.notebook.stdout', data: VSBuffer.fromString('bar') }, { mime: 'application/vnd.code.notebook.stdout', data: VSBuffer.fromString('baz') }]
				}
			];
			model.applyEdits(edits, true, undefined, () => undefined, undefined, true);
			assert.equal(model.cells.length, 1);
			assert.equal(model.cells[0].outputs.length, 1);
			assert.equal(model.cells[0].outputs[0].outputs.length, 3);
			assert.equal(model.cells[0].outputs[0].outputs[0].mime, 'text/plain');
			assert.equal(model.cells[0].outputs[0].outputs[0].data.toString(), 'foo');
			assert.equal(model.cells[0].outputs[0].outputs[1].mime, 'application/vnd.code.notebook.stdout');
			assert.equal(model.cells[0].outputs[0].outputs[1].data.toString(), 'bar');
			assert.equal(model.cells[0].outputs[0].outputs[2].mime, 'application/vnd.code.notebook.stdout');
			assert.equal(model.cells[0].outputs[0].outputs[2].data.toString(), 'baz');
		});
	});
	it('Compress multiple stdout stream output items', async function () {
		await withTestNotebook([
			['var a = 1;', 'javascript', CellKind.Code, [{
				outputId: '1',
				outputs: [{ mime: 'application/vnd.code.notebook.stdout', data: valueBytesFromString('foo') }]
			}], {}]
		], (editor) => {
			const model = editor.textModel;
			const edits: ICellEditOperation[] = [
				{
					editType: CellEditType.OutputItems,
					outputId: '1',
					append: true,
					items: [{ mime: 'application/vnd.code.notebook.stdout', data: VSBuffer.fromString('bar') }, { mime: 'application/vnd.code.notebook.stdout', data: VSBuffer.fromString('baz') }]
				}
			];
			model.applyEdits(edits, true, undefined, () => undefined, undefined, true);
			assert.equal(model.cells.length, 1);
			assert.equal(model.cells[0].outputs.length, 1);
			assert.equal(model.cells[0].outputs[0].outputs.length, 1);
			assert.equal(model.cells[0].outputs[0].outputs[0].mime, 'application/vnd.code.notebook.stdout');
			assert.equal(model.cells[0].outputs[0].outputs[0].data.toString(), 'foobarbaz');
		});

	});
	it('Compress multiple stderr stream output items', async function () {
		await withTestNotebook([
			['var a = 1;', 'javascript', CellKind.Code, [{
				outputId: '1',
				outputs: [{ mime: 'application/vnd.code.notebook.stderr', data: valueBytesFromString('foo') }]
			}], {}]
		], (editor) => {
			const model = editor.textModel;
			const edits: ICellEditOperation[] = [
				{
					editType: CellEditType.OutputItems,
					outputId: '1',
					append: true,
					items: [{ mime: 'application/vnd.code.notebook.stderr', data: VSBuffer.fromString('bar') }, { mime: 'application/vnd.code.notebook.stderr', data: VSBuffer.fromString('baz') }]
				}
			];
			model.applyEdits(edits, true, undefined, () => undefined, undefined, true);
			assert.equal(model.cells.length, 1);
			assert.equal(model.cells[0].outputs.length, 1);
			assert.equal(model.cells[0].outputs[0].outputs.length, 1);
			assert.equal(model.cells[0].outputs[0].outputs[0].mime, 'application/vnd.code.notebook.stderr');
			assert.equal(model.cells[0].outputs[0].outputs[0].data.toString(), 'foobarbaz');
		});

	});

	it('findNextMatch', async function () {
		await withTestNotebook(
			[
				['var a = 1;', 'javascript', CellKind.Code, [], {}],
				['var b = 2;', 'javascript', CellKind.Code, [], {}],
				['var c = 3;', 'javascript', CellKind.Code, [], {}],
				['var d = 4;', 'javascript', CellKind.Code, [], {}]
			],
			(editor, viewModel) => {
				const notebookModel = viewModel.notebookDocument;

				// Test case 1: Find 'var' starting from the first cell
				let findMatch = notebookModel.findNextMatch('var', { cellIndex: 0, position: new Position(1, 1) }, false, false, null);
				assert.ok(findMatch);
				assert.strictEqual(findMatch!.match.range.startLineNumber, 1);
				assert.strictEqual(findMatch!.match.range.startColumn, 1);

				// Test case 2: Find 'b' starting from the second cell
				findMatch = notebookModel.findNextMatch('b', { cellIndex: 1, position: new Position(1, 1) }, false, false, null);
				assert.ok(findMatch);
				assert.strictEqual(findMatch!.match.range.startLineNumber, 1);
				assert.strictEqual(findMatch!.match.range.startColumn, 5);

				// Test case 3: Find 'c' starting from the third cell
				findMatch = notebookModel.findNextMatch('c', { cellIndex: 2, position: new Position(1, 1) }, false, false, null);
				assert.ok(findMatch);
				assert.strictEqual(findMatch!.match.range.startLineNumber, 1);
				assert.strictEqual(findMatch!.match.range.startColumn, 5);

				// Test case 4: Find 'd' starting from the fourth cell
				findMatch = notebookModel.findNextMatch('d', { cellIndex: 3, position: new Position(1, 1) }, false, false, null);
				assert.ok(findMatch);
				assert.strictEqual(findMatch!.match.range.startLineNumber, 1);
				assert.strictEqual(findMatch!.match.range.startColumn, 5);

				// Test case 5: No match found
				findMatch = notebookModel.findNextMatch('e', { cellIndex: 0, position: new Position(1, 1) }, false, false, null);
				assert.strictEqual(findMatch, null);
			}
		);
	});

	it('findNextMatch 2', async function () {
		await withTestNotebook(
			[
				['var a = 1; var a = 2;', 'javascript', CellKind.Code, [], {}],
				['var b = 2;', 'javascript', CellKind.Code, [], {}],
				['var c = 3;', 'javascript', CellKind.Code, [], {}],
				['var d = 4;', 'javascript', CellKind.Code, [], {}]
			],
			(editor, viewModel) => {
				const notebookModel = viewModel.notebookDocument;

				// Test case 1: Find 'var' starting from the first cell
				let findMatch = notebookModel.findNextMatch('var', { cellIndex: 0, position: new Position(1, 1) }, false, false, null);
				assert.ok(findMatch);
				assert.strictEqual(findMatch!.match.range.startLineNumber, 1);
				assert.strictEqual(findMatch!.match.range.startColumn, 1);

				// Test case 2: Find 'b' starting from the second cell
				findMatch = notebookModel.findNextMatch('b', { cellIndex: 1, position: new Position(1, 1) }, false, false, null);
				assert.ok(findMatch);
				assert.strictEqual(findMatch!.match.range.startLineNumber, 1);
				assert.strictEqual(findMatch!.match.range.startColumn, 5);

				// Test case 3: Find 'c' starting from the third cell
				findMatch = notebookModel.findNextMatch('c', { cellIndex: 2, position: new Position(1, 1) }, false, false, null);
				assert.ok(findMatch);
				assert.strictEqual(findMatch!.match.range.startLineNumber, 1);
				assert.strictEqual(findMatch!.match.range.startColumn, 5);

				// Test case 4: Find 'd' starting from the fourth cell
				findMatch = notebookModel.findNextMatch('d', { cellIndex: 3, position: new Position(1, 1) }, false, false, null);
				assert.ok(findMatch);
				assert.strictEqual(findMatch!.match.range.startLineNumber, 1);
				assert.strictEqual(findMatch!.match.range.startColumn, 5);

				// Test case 5: No match found
				findMatch = notebookModel.findNextMatch('e', { cellIndex: 0, position: new Position(1, 1) }, false, false, null);
				assert.strictEqual(findMatch, null);

				// Test case 6: Same keywords in the same cell
				findMatch = notebookModel.findNextMatch('var', { cellIndex: 0, position: new Position(1, 1) }, false, false, null);
				assert.ok(findMatch);
				assert.strictEqual(findMatch!.match.range.startLineNumber, 1);
				assert.strictEqual(findMatch!.match.range.startColumn, 1);

				findMatch = notebookModel.findNextMatch('var', { cellIndex: 0, position: new Position(1, 5) }, false, false, null);
				assert.ok(findMatch);
				assert.strictEqual(findMatch!.match.range.startLineNumber, 1);
				assert.strictEqual(findMatch!.match.range.startColumn, 12);

				// Test case 7: Search from the middle of a cell with keyword before and after
				findMatch = notebookModel.findNextMatch('a', { cellIndex: 0, position: new Position(1, 10) }, false, false, null);
				assert.ok(findMatch);
				assert.strictEqual(findMatch!.match.range.startLineNumber, 1);
				assert.strictEqual(findMatch!.match.range.startColumn, 13);

				// Test case 8: Search from a cell and next match is in another cell below
				findMatch = notebookModel.findNextMatch('var', { cellIndex: 0, position: new Position(1, 20) }, false, false, null);
				assert.ok(findMatch);
				assert.strictEqual(findMatch!.match.range.startLineNumber, 1);
				assert.strictEqual(findMatch!.match.range.startColumn, 1);
				// assert.strictEqual(match!.cellIndex, 1);
			}
		);
	});
});
