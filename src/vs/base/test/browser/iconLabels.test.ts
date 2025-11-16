/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { isHTMLElement } from '../../browser/dom.js';
import { renderLabelWithIcons } from '../../browser/ui/iconLabel/iconLabels.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../common/utils.js';

describe('renderLabelWithIcons', () => {

	it('no icons', () => {
		const result = renderLabelWithIcons(' hello World .');

		assert.strictEqual(elementsToString(result), ' hello World .');
	});

	it('icons only', () => {
		const result = renderLabelWithIcons('$(alert)');

		assert.strictEqual(elementsToString(result), '<span class="codicon codicon-alert"></span>');
	});

	it('icon and non-icon strings', () => {
		const result = renderLabelWithIcons(` $(alert) Unresponsive`);

		assert.strictEqual(elementsToString(result), ' <span class="codicon codicon-alert"></span> Unresponsive');
	});

	it('multiple icons', () => {
		const result = renderLabelWithIcons('$(check)$(error)');

		assert.strictEqual(elementsToString(result), '<span class="codicon codicon-check"></span><span class="codicon codicon-error"></span>');
	});

	it('escaped icons', () => {
		const result = renderLabelWithIcons('\\$(escaped)');

		assert.strictEqual(elementsToString(result), '$(escaped)');
	});

	it('icon with animation', () => {
		const result = renderLabelWithIcons('$(zip~anim)');

		assert.strictEqual(elementsToString(result), '<span class="codicon codicon-zip codicon-modifier-anim"></span>');
	});

	const elementsToString = (elements: Array<HTMLElement | string>): string => {
		return elements
			.map(elem => isHTMLElement(elem) ? elem.outerHTML : elem)
			.reduce((a, b) => a + b, '');
	};

	ensureNoDisposablesAreLeakedInTestSuite();
});
