/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { URI, UriComponents } from '../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { IconPathDto } from '../../common/extHost.protocol.js';
import { IconPath } from '../../common/extHostTypeConverters.js';
import { ThemeColor, ThemeIcon } from '../../common/extHostTypes.js';

describe('extHostTypeConverters', function () {
	ensureNoDisposablesAreLeakedInTestSuite();

	describe('IconPath', function () {
		describe('from', function () {
			it('undefined', function () {
				assert.strictEqual(IconPath.from(undefined), undefined);
			});

			it('ThemeIcon', function () {
				const themeIcon = new ThemeIcon('account', new ThemeColor('testing.iconForeground'));
				assert.strictEqual(IconPath.from(themeIcon), themeIcon);
			});

			it('URI', function () {
				const uri = URI.parse('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==');
				assert.strictEqual(IconPath.from(uri), uri);
			});

			it('string', function () {
				const str = '/path/to/icon.png';
				// eslint-disable-next-line local/code-no-any-casts
				const r1 = IconPath.from(str as any) as any as URI;
				assert.ok(URI.isUri(r1));
				assert.strictEqual(r1.scheme, 'file');
				assert.strictEqual(r1.path, str);
			});

			it('dark only', function () {
				const input = { dark: URI.file('/path/to/dark.png') };
				// eslint-disable-next-line local/code-no-any-casts
				const result = IconPath.from(input as any) as unknown as { dark: URI; light: URI };
				assert.strictEqual(typeof result, 'object');
				assert.ok('light' in result && 'dark' in result);
				assert.ok(URI.isUri(result.light));
				assert.ok(URI.isUri(result.dark));
				assert.strictEqual(result.dark.toString(), input.dark.toString());
				assert.strictEqual(result.light.toString(), input.dark.toString());
			});

			it('dark/light', function () {
				const input = { light: URI.file('/path/to/light.png'), dark: URI.file('/path/to/dark.png') };
				const result = IconPath.from(input);
				assert.strictEqual(typeof result, 'object');
				assert.ok('light' in result && 'dark' in result);
				assert.ok(URI.isUri(result.light));
				assert.ok(URI.isUri(result.dark));
				assert.strictEqual(result.dark.toString(), input.dark.toString());
				assert.strictEqual(result.light.toString(), input.light.toString());
			});

			it('dark/light strings', function () {
				const input = { light: '/path/to/light.png', dark: '/path/to/dark.png' };
				// eslint-disable-next-line local/code-no-any-casts
				const result = IconPath.from(input as any) as unknown as IconPathDto;
				assert.strictEqual(typeof result, 'object');
				assert.ok('light' in result && 'dark' in result);
				assert.ok(URI.isUri(result.light));
				assert.ok(URI.isUri(result.dark));
				assert.strictEqual(result.dark.path, input.dark);
				assert.strictEqual(result.light.path, input.light);
			});

			it('invalid object', function () {
				const invalidObject = { foo: 'bar' };
				// eslint-disable-next-line local/code-no-any-casts
				const result = IconPath.from(invalidObject as any);
				assert.strictEqual(result, undefined);
			});

			it('light only', function () {
				const input = { light: URI.file('/path/to/light.png') };
				// eslint-disable-next-line local/code-no-any-casts
				const result = IconPath.from(input as any);
				assert.strictEqual(result, undefined);
			});
		});

		describe('to', function () {
			it('undefined', function () {
				assert.strictEqual(IconPath.to(undefined), undefined);
			});

			it('ThemeIcon', function () {
				const themeIcon = new ThemeIcon('account');
				assert.strictEqual(IconPath.to(themeIcon), themeIcon);
			});

			it('URI', function () {
				const uri: UriComponents = { scheme: 'data', path: 'image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==' };
				const result = IconPath.to(uri);
				assert.ok(URI.isUri(result));
				assert.strictEqual(result.toString(), URI.revive(uri).toString());
			});

			it('dark/light', function () {
				const input: { light: UriComponents; dark: UriComponents } = {
					light: { scheme: 'file', path: '/path/to/light.png' },
					dark: { scheme: 'file', path: '/path/to/dark.png' }
				};
				const result = IconPath.to(input);
				assert.strictEqual(typeof result, 'object');
				assert.ok('light' in result && 'dark' in result);
				assert.ok(URI.isUri(result.light));
				assert.ok(URI.isUri(result.dark));
				assert.strictEqual(result.dark.toString(), URI.revive(input.dark).toString());
				assert.strictEqual(result.light.toString(), URI.revive(input.light).toString());
			});
		});
	});
});
