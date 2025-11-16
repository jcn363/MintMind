/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { StandardTokenType } from '../../../common/encodedTokenAttributes.js';
import { StandardAutoClosingPairConditional } from '../../../common/languages/languageConfiguration.js';
import { TestLanguageConfigurationService } from './testLanguageConfigurationService.js';

describe('StandardAutoClosingPairConditional', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	it('Missing notIn', () => {
		const v = new StandardAutoClosingPairConditional({ open: '{', close: '}' });
		assert.strictEqual(v.isOK(StandardTokenType.Other), true);
		assert.strictEqual(v.isOK(StandardTokenType.Comment), true);
		assert.strictEqual(v.isOK(StandardTokenType.String), true);
		assert.strictEqual(v.isOK(StandardTokenType.RegEx), true);
	});

	it('Empty notIn', () => {
		const v = new StandardAutoClosingPairConditional({ open: '{', close: '}', notIn: [] });
		assert.strictEqual(v.isOK(StandardTokenType.Other), true);
		assert.strictEqual(v.isOK(StandardTokenType.Comment), true);
		assert.strictEqual(v.isOK(StandardTokenType.String), true);
		assert.strictEqual(v.isOK(StandardTokenType.RegEx), true);
	});

	it('Invalid notIn', () => {
		const v = new StandardAutoClosingPairConditional({ open: '{', close: '}', notIn: ['bla'] });
		assert.strictEqual(v.isOK(StandardTokenType.Other), true);
		assert.strictEqual(v.isOK(StandardTokenType.Comment), true);
		assert.strictEqual(v.isOK(StandardTokenType.String), true);
		assert.strictEqual(v.isOK(StandardTokenType.RegEx), true);
	});

	it('notIn in strings', () => {
		const v = new StandardAutoClosingPairConditional({ open: '{', close: '}', notIn: ['string'] });
		assert.strictEqual(v.isOK(StandardTokenType.Other), true);
		assert.strictEqual(v.isOK(StandardTokenType.Comment), true);
		assert.strictEqual(v.isOK(StandardTokenType.String), false);
		assert.strictEqual(v.isOK(StandardTokenType.RegEx), true);
	});

	it('notIn in comments', () => {
		const v = new StandardAutoClosingPairConditional({ open: '{', close: '}', notIn: ['comment'] });
		assert.strictEqual(v.isOK(StandardTokenType.Other), true);
		assert.strictEqual(v.isOK(StandardTokenType.Comment), false);
		assert.strictEqual(v.isOK(StandardTokenType.String), true);
		assert.strictEqual(v.isOK(StandardTokenType.RegEx), true);
	});

	it('notIn in regex', () => {
		const v = new StandardAutoClosingPairConditional({ open: '{', close: '}', notIn: ['regex'] });
		assert.strictEqual(v.isOK(StandardTokenType.Other), true);
		assert.strictEqual(v.isOK(StandardTokenType.Comment), true);
		assert.strictEqual(v.isOK(StandardTokenType.String), true);
		assert.strictEqual(v.isOK(StandardTokenType.RegEx), false);
	});

	it('notIn in strings nor comments', () => {
		const v = new StandardAutoClosingPairConditional({ open: '{', close: '}', notIn: ['string', 'comment'] });
		assert.strictEqual(v.isOK(StandardTokenType.Other), true);
		assert.strictEqual(v.isOK(StandardTokenType.Comment), false);
		assert.strictEqual(v.isOK(StandardTokenType.String), false);
		assert.strictEqual(v.isOK(StandardTokenType.RegEx), true);
	});

	it('notIn in strings nor regex', () => {
		const v = new StandardAutoClosingPairConditional({ open: '{', close: '}', notIn: ['string', 'regex'] });
		assert.strictEqual(v.isOK(StandardTokenType.Other), true);
		assert.strictEqual(v.isOK(StandardTokenType.Comment), true);
		assert.strictEqual(v.isOK(StandardTokenType.String), false);
		assert.strictEqual(v.isOK(StandardTokenType.RegEx), false);
	});

	it('notIn in comments nor regex', () => {
		const v = new StandardAutoClosingPairConditional({ open: '{', close: '}', notIn: ['comment', 'regex'] });
		assert.strictEqual(v.isOK(StandardTokenType.Other), true);
		assert.strictEqual(v.isOK(StandardTokenType.Comment), false);
		assert.strictEqual(v.isOK(StandardTokenType.String), true);
		assert.strictEqual(v.isOK(StandardTokenType.RegEx), false);
	});

	it('notIn in strings, comments nor regex', () => {
		const v = new StandardAutoClosingPairConditional({ open: '{', close: '}', notIn: ['string', 'comment', 'regex'] });
		assert.strictEqual(v.isOK(StandardTokenType.Other), true);
		assert.strictEqual(v.isOK(StandardTokenType.Comment), false);
		assert.strictEqual(v.isOK(StandardTokenType.String), false);
		assert.strictEqual(v.isOK(StandardTokenType.RegEx), false);
	});

	it('language configurations priorities', () => {
		const languageConfigurationService = new TestLanguageConfigurationService();
		const id = 'testLang1';
		const d1 = languageConfigurationService.register(id, { comments: { lineComment: '1' } }, 100);
		const d2 = languageConfigurationService.register(id, { comments: { lineComment: '2' } }, 10);
		assert.strictEqual(languageConfigurationService.getLanguageConfiguration(id).comments?.lineCommentToken, '1');
		d1.dispose();
		d2.dispose();
		languageConfigurationService.dispose();
	});
});
