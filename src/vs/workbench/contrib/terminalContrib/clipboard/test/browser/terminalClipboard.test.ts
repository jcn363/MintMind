/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { strictEqual } from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../../base/test/common/utils.js';
import { IConfigurationService } from '../../../../../../platform/configuration/common/configuration.js';
import { TestConfigurationService } from '../../../../../../platform/configuration/test/common/testConfigurationService.js';
import { IDialogService } from '../../../../../../platform/dialogs/common/dialogs.js';
import { TestDialogService } from '../../../../../../platform/dialogs/test/common/testDialogService.js';
import { TestInstantiationService } from '../../../../../../platform/instantiation/test/common/instantiationServiceMock.js';
import { TerminalSettingId } from '../../../../../../platform/terminal/common/terminal.js';
import { shouldPasteTerminalText } from '../../browser/terminalClipboard.js';

describe('TerminalClipboard', function () {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	describe('shouldPasteTerminalText', () => {
		let instantiationService: TestInstantiationService;
		let configurationService: TestConfigurationService;

		beforeEach(async () => {
			instantiationService = store.add(new TestInstantiationService());
			configurationService = new TestConfigurationService({
				[TerminalSettingId.EnableMultiLinePasteWarning]: 'auto'
			});
			instantiationService.stub(IConfigurationService, configurationService);
			instantiationService.stub(IDialogService, new TestDialogService(undefined, { result: { confirmed: false } }));
		});

		function setConfigValue(value: unknown) {
			configurationService = new TestConfigurationService({
				[TerminalSettingId.EnableMultiLinePasteWarning]: value
			});
			instantiationService.stub(IConfigurationService, configurationService);
		}

		it('Single line string', async () => {
			strictEqual(await instantiationService.invokeFunction(shouldPasteTerminalText, 'foo', undefined), true);

			setConfigValue('always');
			strictEqual(await instantiationService.invokeFunction(shouldPasteTerminalText, 'foo', undefined), true);

			setConfigValue('never');
			strictEqual(await instantiationService.invokeFunction(shouldPasteTerminalText, 'foo', undefined), true);
		});
		it('Single line string with trailing new line', async () => {
			strictEqual(await instantiationService.invokeFunction(shouldPasteTerminalText, 'foo\n', undefined), true);

			setConfigValue('always');
			strictEqual(await instantiationService.invokeFunction(shouldPasteTerminalText, 'foo\n', undefined), false);

			setConfigValue('never');
			strictEqual(await instantiationService.invokeFunction(shouldPasteTerminalText, 'foo\n', undefined), true);
		});
		it('Multi-line string', async () => {
			strictEqual(await instantiationService.invokeFunction(shouldPasteTerminalText, 'foo\nbar', undefined), false);

			setConfigValue('always');
			strictEqual(await instantiationService.invokeFunction(shouldPasteTerminalText, 'foo\nbar', undefined), false);

			setConfigValue('never');
			strictEqual(await instantiationService.invokeFunction(shouldPasteTerminalText, 'foo\nbar', undefined), true);
		});
		it('Bracketed paste mode', async () => {
			strictEqual(await instantiationService.invokeFunction(shouldPasteTerminalText, 'foo\nbar', true), true);

			setConfigValue('always');
			strictEqual(await instantiationService.invokeFunction(shouldPasteTerminalText, 'foo\nbar', true), false);

			setConfigValue('never');
			strictEqual(await instantiationService.invokeFunction(shouldPasteTerminalText, 'foo\nbar', true), true);
		});
		it('Legacy config', async () => {
			setConfigValue(true); // 'auto'
			strictEqual(await instantiationService.invokeFunction(shouldPasteTerminalText, 'foo\nbar', undefined), false);
			strictEqual(await instantiationService.invokeFunction(shouldPasteTerminalText, 'foo\nbar', true), true);

			setConfigValue(false); // 'never'
			strictEqual(await instantiationService.invokeFunction(shouldPasteTerminalText, 'foo\nbar', true), true);
		});
		it('Invalid config', async () => {
			setConfigValue(123);
			strictEqual(await instantiationService.invokeFunction(shouldPasteTerminalText, 'foo\nbar', undefined), false);
			strictEqual(await instantiationService.invokeFunction(shouldPasteTerminalText, 'foo\nbar', true), true);
		});
	});
});
