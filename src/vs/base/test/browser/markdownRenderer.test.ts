/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/* eslint-disable no-restricted-syntax */

import assert from 'assert';
import { fillInIncompleteTokens, renderMarkdown, renderAsPlaintext } from '../../browser/markdownRenderer.js';
import { IMarkdownString, MarkdownString } from '../../common/htmlContent.js';
import * as marked from '../../common/marked/marked.js';
import { parse } from '../../common/marshalling.js';
import { isWeb } from '../../common/platform.js';
import { URI } from '../../common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../common/utils.js';

function strToNode(str: string): HTMLElement {
	return new DOMParser().parseFromString(str, 'text/html').body.firstChild as HTMLElement;
}

function assertNodeEquals(actualNode: HTMLElement, expectedHtml: string) {
	const expectedNode = strToNode(expectedHtml);
	assert.ok(
		actualNode.isEqualNode(expectedNode),
		`Expected: ${expectedNode.outerHTML}\nActual: ${actualNode.outerHTML}`);
}

describe('MarkdownRenderer', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	describe('Sanitization', () => {
		it('Should not render images with unknown schemes', () => {
			const markdown = { value: `![image](no-such://example.com/cat.gif)` };
			const result: HTMLElement = store.add(renderMarkdown(markdown)).element;
			assert.strictEqual(result.innerHTML, '<p><img alt="image"></p>');
		});
	});

	describe('Images', () => {
		it('image rendering conforms to default', () => {
			const markdown = { value: `![image](http://example.com/cat.gif 'caption')` };
			const result: HTMLElement = store.add(renderMarkdown(markdown)).element;
			assertNodeEquals(result, '<div><p><img title="caption" alt="image" src="http://example.com/cat.gif"></p></div>');
		});

		it('image rendering conforms to default without title', () => {
			const markdown = { value: `![image](http://example.com/cat.gif)` };
			const result: HTMLElement = store.add(renderMarkdown(markdown)).element;
			assertNodeEquals(result, '<div><p><img alt="image" src="http://example.com/cat.gif"></p></div>');
		});

		it('image width from title params', () => {
			const result: HTMLElement = store.add(renderMarkdown({ value: `![image](http://example.com/cat.gif|width=100px 'caption')` })).element;
			assertNodeEquals(result, `<div><p><img width="100" title="caption" alt="image" src="http://example.com/cat.gif"></p></div>`);
		});

		it('image height from title params', () => {
			const result: HTMLElement = store.add(renderMarkdown({ value: `![image](http://example.com/cat.gif|height=100 'caption')` })).element;
			assertNodeEquals(result, `<div><p><img height="100" title="caption" alt="image" src="http://example.com/cat.gif"></p></div>`);
		});

		it('image width and height from title params', () => {
			const result: HTMLElement = store.add(renderMarkdown({ value: `![image](http://example.com/cat.gif|height=200,width=100 'caption')` })).element;
			assertNodeEquals(result, `<div><p><img height="200" width="100" title="caption" alt="image" src="http://example.com/cat.gif"></p></div>`);
		});

		it('image with file uri should render as same origin uri', () => {
			if (isWeb) {
				return;
			}
			const result: HTMLElement = store.add(renderMarkdown({ value: `![image](file:///images/cat.gif)` })).element;
			assertNodeEquals(result, '<div><p><img src="vscode-file://vscode-app/images/cat.gif" alt="image"></p></div>');
		});
	});

	describe('Code block renderer', () => {
		const simpleCodeBlockRenderer = (lang: string, code: string): Promise<HTMLElement> => {
			const element = document.createElement('code');
			element.textContent = code;
			return Promise.resolve(element);
		};

		it('asyncRenderCallback should be invoked for code blocks', () => {
			const markdown = { value: '```js\n1 + 1;\n```' };
			return new Promise<void>(resolve => {
				store.add(renderMarkdown(markdown, {
					asyncRenderCallback: resolve,
					codeBlockRenderer: simpleCodeBlockRenderer
				}));
			});
		});

		it('asyncRenderCallback should not be invoked if result is immediately disposed', () => {
			const markdown = { value: '```js\n1 + 1;\n```' };
			return new Promise<void>((resolve, reject) => {
				const result = renderMarkdown(markdown, {
					asyncRenderCallback: reject,
					codeBlockRenderer: simpleCodeBlockRenderer
				});
				result.dispose();
				setTimeout(resolve, 10);
			});
		});

		it('asyncRenderCallback should not be invoked if dispose is called before code block is rendered', () => {
			const markdown = { value: '```js\n1 + 1;\n```' };
			return new Promise<void>((resolve, reject) => {
				let resolveCodeBlockRendering: (x: HTMLElement) => void;
				const result = renderMarkdown(markdown, {
					asyncRenderCallback: reject,
					codeBlockRenderer: () => {
						return new Promise(resolve => {
							resolveCodeBlockRendering = resolve;
						});
					}
				});
				setTimeout(() => {
					result.dispose();
					resolveCodeBlockRendering(document.createElement('code'));
					setTimeout(resolve, 10);
				}, 10);
			});
		});

		it('Code blocks should use leading language id (#157793)', async () => {
			const markdown = { value: '```js some other stuff\n1 + 1;\n```' };
			const lang = await new Promise<string>(resolve => {
				store.add(renderMarkdown(markdown, {
					codeBlockRenderer: async (lang, value) => {
						resolve(lang);
						return simpleCodeBlockRenderer(lang, value);
					}
				}));
			});
			assert.strictEqual(lang, 'js');
		});
	});

	describe('ThemeIcons Support On', () => {

		it('render appendText', () => {
			const mds = new MarkdownString(undefined, { supportThemeIcons: true });
			mds.appendText('$(zap) $(not a theme icon) $(add)');

			const result: HTMLElement = store.add(renderMarkdown(mds)).element;
			assert.strictEqual(result.innerHTML, `<p>$(zap)&nbsp;$(not&nbsp;a&nbsp;theme&nbsp;icon)&nbsp;$(add)</p>`);
		});

		it('render appendMarkdown', () => {
			const mds = new MarkdownString(undefined, { supportThemeIcons: true });
			mds.appendMarkdown('$(zap) $(not a theme icon) $(add)');

			const result: HTMLElement = store.add(renderMarkdown(mds)).element;
			assert.strictEqual(result.innerHTML, `<p><span class="codicon codicon-zap"></span> $(not a theme icon) <span class="codicon codicon-add"></span></p>`);
		});

		it('render appendMarkdown with escaped icon', () => {
			const mds = new MarkdownString(undefined, { supportThemeIcons: true });
			mds.appendMarkdown('\\$(zap) $(not a theme icon) $(add)');

			const result: HTMLElement = store.add(renderMarkdown(mds)).element;
			assert.strictEqual(result.innerHTML, `<p>$(zap) $(not a theme icon) <span class="codicon codicon-add"></span></p>`);
		});

		it('render icon in link', () => {
			const mds = new MarkdownString(undefined, { supportThemeIcons: true });
			mds.appendMarkdown(`[$(zap)-link](#link)`);

			const result: HTMLElement = store.add(renderMarkdown(mds)).element;
			assert.strictEqual(result.innerHTML, `<p><a href="" title="#link" draggable="false" data-href="#link"><span class="codicon codicon-zap"></span>-link</a></p>`);
		});

		it('render icon in table', () => {
			const mds = new MarkdownString(undefined, { supportThemeIcons: true });
			mds.appendMarkdown(`
| text   | text                 |
|--------|----------------------|
| $(zap) | [$(zap)-link](#link) |`);

			const result: HTMLElement = store.add(renderMarkdown(mds)).element;
			assert.strictEqual(result.innerHTML, `<table>
<thead>
<tr>
<th>text</th>
<th>text</th>
</tr>
</thead>
<tbody><tr>
<td><span class="codicon codicon-zap"></span></td>
<td><a href="" title="#link" draggable="false" data-href="#link"><span class="codicon codicon-zap"></span>-link</a></td>
</tr>
</tbody></table>
`);
		});

		it('render icon in <a> without href (#152170)', () => {
			const mds = new MarkdownString(undefined, { supportThemeIcons: true, supportHtml: true });
			mds.appendMarkdown(`<a>$(sync)</a>`);

			const result: HTMLElement = store.add(renderMarkdown(mds)).element;
			assert.strictEqual(result.innerHTML, `<p><span class="codicon codicon-sync"></span></p>`);
		});
	});

	describe('ThemeIcons Support Off', () => {

		it('render appendText', () => {
			const mds = new MarkdownString(undefined, { supportThemeIcons: false });
			mds.appendText('$(zap) $(not a theme icon) $(add)');

			const result: HTMLElement = store.add(renderMarkdown(mds)).element;
			assert.strictEqual(result.innerHTML, `<p>$(zap)&nbsp;$(not&nbsp;a&nbsp;theme&nbsp;icon)&nbsp;$(add)</p>`);
		});

		it('render appendMarkdown with escaped icon', () => {
			const mds = new MarkdownString(undefined, { supportThemeIcons: false });
			mds.appendMarkdown('\\$(zap) $(not a theme icon) $(add)');

			const result: HTMLElement = store.add(renderMarkdown(mds)).element;
			assert.strictEqual(result.innerHTML, `<p>$(zap) $(not a theme icon) $(add)</p>`);
		});
	});

	describe('Alerts', () => {
		it('Should render alert with data-severity attribute and icon', () => {
			const markdown = new MarkdownString('> [!NOTE]\n> This is a note alert', { supportAlertSyntax: true });
			const result = store.add(renderMarkdown(markdown)).element;

			const blockquote = result.querySelector('blockquote[data-severity="note"]');
			assert.ok(blockquote, 'Should have blockquote with data-severity="note"');
			assert.ok(result.innerHTML.includes('This is a note alert'), 'Should contain alert text');
			assert.ok(result.innerHTML.includes('codicon-info'), 'Should contain info icon');
		});

		it('Should render regular blockquote when supportAlertSyntax is disabled', () => {
			const markdown = new MarkdownString('> [!NOTE]\n> This should be a regular blockquote');
			const result = store.add(renderMarkdown(markdown)).element;

			const blockquote = result.querySelector('blockquote');
			assert.ok(blockquote, 'Should have blockquote');
			assert.strictEqual(blockquote?.getAttribute('data-severity'), null, 'Should not have data-severity attribute');
			assert.ok(result.innerHTML.includes('[!NOTE]'), 'Should contain literal [!NOTE] text');
		});

		it('Should not transform blockquotes without alert syntax', () => {
			const markdown = new MarkdownString('> This is a regular blockquote', { supportAlertSyntax: true });
			const result = store.add(renderMarkdown(markdown)).element;

			const blockquote = result.querySelector('blockquote');
			assert.strictEqual(blockquote?.getAttribute('data-severity'), null, 'Should not have data-severity attribute');
		});
	});

	it('npm Hover Run Script not working #90855', function () {

		const md: IMarkdownString = JSON.parse('{"value":"[Run Script](command:npm.runScriptFromHover?%7B%22documentUri%22%3A%7B%22%24mid%22%3A1%2C%22fsPath%22%3A%22c%3A%5C%5CUsers%5C%5Cjrieken%5C%5CCode%5C%5C_sample%5C%5Cfoo%5C%5Cpackage.json%22%2C%22_sep%22%3A1%2C%22external%22%3A%22file%3A%2F%2F%2Fc%253A%2FUsers%2Fjrieken%2FCode%2F_sample%2Ffoo%2Fpackage.json%22%2C%22path%22%3A%22%2Fc%3A%2FUsers%2Fjrieken%2FCode%2F_sample%2Ffoo%2Fpackage.json%22%2C%22scheme%22%3A%22file%22%7D%2C%22script%22%3A%22echo%22%7D \\"Run the script as a task\\")","supportThemeIcons":false,"isTrusted":true,"uris":{"__uri_e49443":{"$mid":1,"fsPath":"c:\\\\Users\\\\jrieken\\\\Code\\\\_sample\\\\foo\\\\package.json","_sep":1,"external":"file:///c%3A/Users/jrieken/Code/_sample/foo/package.json","path":"/c:/Users/jrieken/Code/_sample/foo/package.json","scheme":"file"},"command:npm.runScriptFromHover?%7B%22documentUri%22%3A%7B%22%24mid%22%3A1%2C%22fsPath%22%3A%22c%3A%5C%5CUsers%5C%5Cjrieken%5C%5CCode%5C%5C_sample%5C%5Cfoo%5C%5Cpackage.json%22%2C%22_sep%22%3A1%2C%22external%22%3A%22file%3A%2F%2F%2Fc%253A%2FUsers%2Fjrieken%2FCode%2F_sample%2Ffoo%2Fpackage.json%22%2C%22path%22%3A%22%2Fc%3A%2FUsers%2Fjrieken%2FCode%2F_sample%2Ffoo%2Fpackage.json%22%2C%22scheme%22%3A%22file%22%7D%2C%22script%22%3A%22echo%22%7D":{"$mid":1,"path":"npm.runScriptFromHover","scheme":"command","query":"{\\"documentUri\\":\\"__uri_e49443\\",\\"script\\":\\"echo\\"}"}}}');
		const element = store.add(renderMarkdown(md)).element;

		const anchor = element.querySelector('a')!;
		assert.ok(anchor);
		assert.ok(anchor.dataset['href']);

		const uri = URI.parse(anchor.dataset['href']!);

		const data = <{ script: string; documentUri: URI }>parse(decodeURIComponent(uri.query));
		assert.ok(data);
		assert.strictEqual(data.script, 'echo');
		assert.ok(data.documentUri.toString().startsWith('file:///c%3A/'));
	});

	it('Should not render command links by default', () => {
		const md = new MarkdownString(`[command1](command:doFoo) <a href="command:doFoo">command2</a>`, {
			supportHtml: true
		});

		const result: HTMLElement = store.add(renderMarkdown(md)).element;
		assert.strictEqual(result.innerHTML, `<p>command1 command2</p>`);
	});

	it('Should render command links in trusted strings', () => {
		const md = new MarkdownString(`[command1](command:doFoo) <a href="command:doFoo">command2</a>`, {
			isTrusted: true,
			supportHtml: true,
		});

		const result: HTMLElement = store.add(renderMarkdown(md)).element;
		assert.strictEqual(result.innerHTML, `<p><a href="" title="command:doFoo" draggable="false" data-href="command:doFoo">command1</a> <a href="" data-href="command:doFoo">command2</a></p>`);
	});

	it('Should remove relative links if there is no base url', () => {
		const md = new MarkdownString(`[text](./foo) <a href="./bar">bar</a>`, {
			isTrusted: true,
			supportHtml: true,
		});

		const result = store.add(renderMarkdown(md)).element;
		assert.strictEqual(result.innerHTML, `<p>text bar</p>`);
	});

	it('Should support relative links if baseurl is set', () => {
		const md = new MarkdownString(`[text](./foo) <a href="./bar">bar</a> <img src="cat.gif">`, {
			isTrusted: true,
			supportHtml: true,
		});
		md.baseUri = URI.parse('https://example.com/path/');

		const result = store.add(renderMarkdown(md)).element;
		assert.strictEqual(result.innerHTML, `<p><a href="" title="./foo" draggable="false" data-href="https://example.com/path/foo">text</a> <a href="" data-href="https://example.com/path/bar">bar</a> <img src="https://example.com/path/cat.gif"></p>`);
	});

	describe('PlaintextMarkdownRender', () => {

		it('test code, blockquote, heading, list, listitem, paragraph, table, tablerow, tablecell, strong, em, br, del, text are rendered plaintext', () => {
			const markdown = { value: '`code`\n>quote\n# heading\n- list\n\ntable | table2\n--- | --- \none | two\n\n\nbo**ld**\n_italic_\n~~del~~\nsome text' };
			const expected = 'code\nquote\nheading\nlist\n\ntable table2\none two\nbold\nitalic\ndel\nsome text';
			const result: string = renderAsPlaintext(markdown);
			assert.strictEqual(result, expected);
		});

		it('test html, hr, image, link are rendered plaintext', () => {
			const markdown = { value: '<div>html</div>\n\n---\n![image](imageLink)\n[text](textLink)' };
			const expected = 'text';
			const result: string = renderAsPlaintext(markdown);
			assert.strictEqual(result, expected);
		});

		it(`Should not remove html inside of code blocks`, () => {
			const markdown = {
				value: [
					'```html',
					'<form>html</form>',
					'```',
				].join('\n')
			};
			const expected = [
				'```',
				'<form>html</form>',
				'```',
			].join('\n');
			const result: string = renderAsPlaintext(markdown, { includeCodeBlocksFences: true });
			assert.strictEqual(result, expected);
		});
	});

	describe('supportHtml', () => {
		it('supportHtml is disabled by default', () => {
			const mds = new MarkdownString(undefined, {});
			mds.appendMarkdown('a<b>b</b>c');

			const result = store.add(renderMarkdown(mds)).element;
			assert.strictEqual(result.innerHTML, `<p>abc</p>`);
		});

		it('Renders html when supportHtml=true', () => {
			const mds = new MarkdownString(undefined, { supportHtml: true });
			mds.appendMarkdown('a<b>b</b>c');

			const result = store.add(renderMarkdown(mds)).element;
			assert.strictEqual(result.innerHTML, `<p>a<b>b</b>c</p>`);
		});

		it('Should not include scripts even when supportHtml=true', () => {
			const mds = new MarkdownString(undefined, { supportHtml: true });
			mds.appendMarkdown('a<b onclick="alert(1)">b</b><script>alert(2)</script>c');

			const result = store.add(renderMarkdown(mds)).element;
			assert.strictEqual(result.innerHTML, `<p>a<b>b</b>c</p>`);
		});

		it('Should not render html appended as text', () => {
			const mds = new MarkdownString(undefined, { supportHtml: true });
			mds.appendText('a<b>b</b>c');

			const result = store.add(renderMarkdown(mds)).element;
			assert.strictEqual(result.innerHTML, `<p>a&lt;b&gt;b&lt;/b&gt;c</p>`);
		});

		it('Should render html images', () => {
			if (isWeb) {
				return;
			}

			const mds = new MarkdownString(undefined, { supportHtml: true });
			mds.appendMarkdown(`<img src="http://example.com/cat.gif">`);

			const result = store.add(renderMarkdown(mds)).element;
			assert.strictEqual(result.innerHTML, `<img src="http://example.com/cat.gif">`);
		});

		it('Should render html images with file uri as same origin uri', () => {
			if (isWeb) {
				return;
			}

			const mds = new MarkdownString(undefined, { supportHtml: true });
			mds.appendMarkdown(`<img src="file:///images/cat.gif">`);

			const result = store.add(renderMarkdown(mds)).element;
			assert.strictEqual(result.innerHTML, `<img src="vscode-file://vscode-app/images/cat.gif">`);
		});

		it('Should only allow checkbox inputs', () => {
			const mds = new MarkdownString(
				'text: <input type="text">\ncheckbox:<input type="checkbox">',
				{ supportHtml: true });

			const result = store.add(renderMarkdown(mds)).element;

			// Inputs should always be disabled too
			assert.strictEqual(result.innerHTML, `<p>text: \ncheckbox:<input type="checkbox" disabled=""></p>`);
		});
	});

	describe('fillInIncompleteTokens', () => {
		function ignoreRaw(...tokenLists: marked.Token[][]): void {
			tokenLists.forEach(tokens => {
				tokens.forEach(t => t.raw = '');
			});
		}

		const completeTable = '| a | b |\n| --- | --- |';

		describe('table', () => {
			it('complete table', () => {
				const tokens = marked.marked.lexer(completeTable);
				const newTokens = fillInIncompleteTokens(tokens);
				assert.equal(newTokens, tokens);
			});

			it('full header only', () => {
				const incompleteTable = '| a | b |';
				const tokens = marked.marked.lexer(incompleteTable);
				const completeTableTokens = marked.marked.lexer(completeTable);

				const newTokens = fillInIncompleteTokens(tokens);
				assert.deepStrictEqual(newTokens, completeTableTokens);
			});

			it('full header only with trailing space', () => {
				const incompleteTable = '| a | b | ';
				const tokens = marked.marked.lexer(incompleteTable);
				const completeTableTokens = marked.marked.lexer(completeTable);

				const newTokens = fillInIncompleteTokens(tokens);
				if (newTokens) {
					ignoreRaw(newTokens, completeTableTokens);
				}
				assert.deepStrictEqual(newTokens, completeTableTokens);
			});

			it('incomplete header', () => {
				const incompleteTable = '| a | b';
				const tokens = marked.marked.lexer(incompleteTable);
				const completeTableTokens = marked.marked.lexer(completeTable);

				const newTokens = fillInIncompleteTokens(tokens);

				if (newTokens) {
					ignoreRaw(newTokens, completeTableTokens);
				}
				assert.deepStrictEqual(newTokens, completeTableTokens);
			});

			it('incomplete header one column', () => {
				const incompleteTable = '| a ';
				const tokens = marked.marked.lexer(incompleteTable);
				const completeTableTokens = marked.marked.lexer(incompleteTable + '|\n| --- |');

				const newTokens = fillInIncompleteTokens(tokens);

				if (newTokens) {
					ignoreRaw(newTokens, completeTableTokens);
				}
				assert.deepStrictEqual(newTokens, completeTableTokens);
			});

			it('full header with extras', () => {
				const incompleteTable = '| a **bold** | b _italics_ |';
				const tokens = marked.marked.lexer(incompleteTable);
				const completeTableTokens = marked.marked.lexer(incompleteTable + '\n| --- | --- |');

				const newTokens = fillInIncompleteTokens(tokens);
				assert.deepStrictEqual(newTokens, completeTableTokens);
			});

			it('full header with leading text', () => {
				// Parsing this gives one token and one 'text' subtoken
				const incompleteTable = 'here is a table\n| a | b |';
				const tokens = marked.marked.lexer(incompleteTable);
				const completeTableTokens = marked.marked.lexer(incompleteTable + '\n| --- | --- |');

				const newTokens = fillInIncompleteTokens(tokens);
				assert.deepStrictEqual(newTokens, completeTableTokens);
			});

			it('full header with leading other stuff', () => {
				// Parsing this gives one token and one 'text' subtoken
				const incompleteTable = '```js\nconst xyz = 123;\n```\n| a | b |';
				const tokens = marked.marked.lexer(incompleteTable);
				const completeTableTokens = marked.marked.lexer(incompleteTable + '\n| --- | --- |');

				const newTokens = fillInIncompleteTokens(tokens);
				assert.deepStrictEqual(newTokens, completeTableTokens);
			});

			it('full header with incomplete separator', () => {
				const incompleteTable = '| a | b |\n| ---';
				const tokens = marked.marked.lexer(incompleteTable);
				const completeTableTokens = marked.marked.lexer(completeTable);

				const newTokens = fillInIncompleteTokens(tokens);
				assert.deepStrictEqual(newTokens, completeTableTokens);
			});

			it('full header with incomplete separator 2', () => {
				const incompleteTable = '| a | b |\n| --- |';
				const tokens = marked.marked.lexer(incompleteTable);
				const completeTableTokens = marked.marked.lexer(completeTable);

				const newTokens = fillInIncompleteTokens(tokens);
				assert.deepStrictEqual(newTokens, completeTableTokens);
			});

			it('full header with incomplete separator 3', () => {
				const incompleteTable = '| a | b |\n|';
				const tokens = marked.marked.lexer(incompleteTable);
				const completeTableTokens = marked.marked.lexer(completeTable);

				const newTokens = fillInIncompleteTokens(tokens);
				assert.deepStrictEqual(newTokens, completeTableTokens);
			});

			it('not a table', () => {
				const incompleteTable = '| a | b |\nsome text';
				const tokens = marked.marked.lexer(incompleteTable);

				const newTokens = fillInIncompleteTokens(tokens);
				assert.deepStrictEqual(newTokens, tokens);
			});

			it('not a table 2', () => {
				const incompleteTable = '| a | b |\n| --- |\nsome text';
				const tokens = marked.marked.lexer(incompleteTable);

				const newTokens = fillInIncompleteTokens(tokens);
				assert.deepStrictEqual(newTokens, tokens);
			});
		});

		function simpleMarkdownTestSuite(name: string, delimiter: string): void {
			it(`incomplete ${name}`, () => {
				const incomplete = `${delimiter}code`;
				const tokens = marked.marked.lexer(incomplete);
				const newTokens = fillInIncompleteTokens(tokens);

				const completeTokens = marked.marked.lexer(incomplete + delimiter);
				assert.deepStrictEqual(newTokens, completeTokens);
			});

			it(`complete ${name}`, () => {
				const text = `leading text ${delimiter}code${delimiter} trailing text`;
				const tokens = marked.marked.lexer(text);
				const newTokens = fillInIncompleteTokens(tokens);

				assert.deepStrictEqual(newTokens, tokens);
			});

			it(`${name} with leading text`, () => {
				const incomplete = `some text and ${delimiter}some code`;
				const tokens = marked.marked.lexer(incomplete);
				const newTokens = fillInIncompleteTokens(tokens);

				const completeTokens = marked.marked.lexer(incomplete + delimiter);
				assert.deepStrictEqual(newTokens, completeTokens);
			});

			it(`${name} with trailing space`, () => {
				const incomplete = `some text and ${delimiter}some code `;
				const tokens = marked.marked.lexer(incomplete);
				const newTokens = fillInIncompleteTokens(tokens);

				const completeTokens = marked.marked.lexer(incomplete.trimEnd() + delimiter);
				assert.deepStrictEqual(newTokens, completeTokens);
			});

			it(`single loose "${delimiter}"`, () => {
				const text = `some text and ${delimiter}by itself\nmore text here`;
				const tokens = marked.marked.lexer(text);
				const newTokens = fillInIncompleteTokens(tokens);

				assert.deepStrictEqual(newTokens, tokens);
			});

			it(`incomplete ${name} after newline`, () => {
				const text = `some text\nmore text here and ${delimiter}text`;
				const tokens = marked.marked.lexer(text);
				const newTokens = fillInIncompleteTokens(tokens);

				const completeTokens = marked.marked.lexer(text + delimiter);
				assert.deepStrictEqual(newTokens, completeTokens);
			});

			it(`incomplete after complete ${name}`, () => {
				const text = `leading text ${delimiter}code${delimiter} trailing text and ${delimiter}another`;
				const tokens = marked.marked.lexer(text);
				const newTokens = fillInIncompleteTokens(tokens);

				const completeTokens = marked.marked.lexer(text + delimiter);
				assert.deepStrictEqual(newTokens, completeTokens);
			});

			it(`incomplete ${name} in list`, () => {
				const text = `- list item one\n- list item two and ${delimiter}text`;
				const tokens = marked.marked.lexer(text);
				const newTokens = fillInIncompleteTokens(tokens);

				const completeTokens = marked.marked.lexer(text + delimiter);
				assert.deepStrictEqual(newTokens, completeTokens);
			});

			it(`incomplete ${name} in asterisk list`, () => {
				const text = `* list item one\n* list item two and ${delimiter}text`;
				const tokens = marked.marked.lexer(text);
				const newTokens = fillInIncompleteTokens(tokens);

				const completeTokens = marked.marked.lexer(text + delimiter);
				assert.deepStrictEqual(newTokens, completeTokens);
			});

			it(`incomplete ${name} in numbered list`, () => {
				const text = `1. list item one\n2. list item two and ${delimiter}text`;
				const tokens = marked.marked.lexer(text);
				const newTokens = fillInIncompleteTokens(tokens);

				const completeTokens = marked.marked.lexer(text + delimiter);
				assert.deepStrictEqual(newTokens, completeTokens);
			});
		}

		describe('list', () => {
			it('list with complete codeblock', () => {
				const list = `-
	\`\`\`js
	let x = 1;
	\`\`\`
- list item two
`;
				const tokens = marked.marked.lexer(list);
				const newTokens = fillInIncompleteTokens(tokens);

				assert.deepStrictEqual(newTokens, tokens);
			});

			it.skip('list with incomplete codeblock', () => {
				const incomplete = `- list item one

	\`\`\`js
	let x = 1;`;
				const tokens = marked.marked.lexer(incomplete);
				const newTokens = fillInIncompleteTokens(tokens);

				const completeTokens = marked.marked.lexer(incomplete + '\n	```');
				assert.deepStrictEqual(newTokens, completeTokens);
			});

			it('list with subitems', () => {
				const list = `- hello
	- sub item
- text
	newline for some reason
`;
				const tokens = marked.marked.lexer(list);
				const newTokens = fillInIncompleteTokens(tokens);

				assert.deepStrictEqual(newTokens, tokens);
			});

			it('ordered list with subitems', () => {
				const list = `1. hello
	- sub item
2. text
	newline for some reason
`;
				const tokens = marked.marked.lexer(list);
				const newTokens = fillInIncompleteTokens(tokens);

				assert.deepStrictEqual(newTokens, tokens);
			});

			it('list with stuff', () => {
				const list = `- list item one \`codespan\` **bold** [link](http://microsoft.com) more text`;
				const tokens = marked.marked.lexer(list);
				const newTokens = fillInIncompleteTokens(tokens);

				assert.deepStrictEqual(newTokens, tokens);
			});

			it('list with incomplete link text', () => {
				const incomplete = `- list item one
- item two [link`;
				const tokens = marked.marked.lexer(incomplete);
				const newTokens = fillInIncompleteTokens(tokens);

				const completeTokens = marked.marked.lexer(incomplete + '](https://microsoft.com)');
				assert.deepStrictEqual(newTokens, completeTokens);
			});

			it('list with incomplete link target', () => {
				const incomplete = `- list item one
- item two [link](`;
				const tokens = marked.marked.lexer(incomplete);
				const newTokens = fillInIncompleteTokens(tokens);

				const completeTokens = marked.marked.lexer(incomplete + ')');
				assert.deepStrictEqual(newTokens, completeTokens);
			});

			it('ordered list with incomplete link target', () => {
				const incomplete = `1. list item one
2. item two [link](`;
				const tokens = marked.marked.lexer(incomplete);
				const newTokens = fillInIncompleteTokens(tokens);

				const completeTokens = marked.marked.lexer(incomplete + ')');
				assert.deepStrictEqual(newTokens, completeTokens);
			});

			it('ordered list with extra whitespace', () => {
				const incomplete = `1. list item one
2. item two [link](`;
				const tokens = marked.marked.lexer(incomplete);
				const newTokens = fillInIncompleteTokens(tokens);

				const completeTokens = marked.marked.lexer(incomplete + ')');
				assert.deepStrictEqual(newTokens, completeTokens);
			});

			it('list with extra whitespace', () => {
				const incomplete = `- list item one
- item two [link](`;
				const tokens = marked.marked.lexer(incomplete);
				const newTokens = fillInIncompleteTokens(tokens);

				const completeTokens = marked.marked.lexer(incomplete + ')');
				assert.deepStrictEqual(newTokens, completeTokens);
			});

			it('list with incomplete link with other stuff', () => {
				const incomplete = `- list item one
- item two [\`link`;
				const tokens = marked.marked.lexer(incomplete);
				const newTokens = fillInIncompleteTokens(tokens);

				const completeTokens = marked.marked.lexer(incomplete + '\`](https://microsoft.com)');
				assert.deepStrictEqual(newTokens, completeTokens);
			});

			it('ordered list with incomplete link with other stuff', () => {
				const incomplete = `1. list item one
1. item two [\`link`;
				const tokens = marked.marked.lexer(incomplete);
				const newTokens = fillInIncompleteTokens(tokens);

				const completeTokens = marked.marked.lexer(incomplete + '\`](https://microsoft.com)');
				assert.deepStrictEqual(newTokens, completeTokens);
			});

			it('list with incomplete subitem', () => {
				const incomplete = `1. list item one
	- `;
				const tokens = marked.marked.lexer(incomplete);
				const newTokens = fillInIncompleteTokens(tokens);

				const completeTokens = marked.marked.lexer(incomplete + '&nbsp;');
				assert.deepStrictEqual(newTokens, completeTokens);
			});

			it('list with incomplete nested subitem', () => {
				const incomplete = `1. list item one
	- item 2
		- `;
				const tokens = marked.marked.lexer(incomplete);
				const newTokens = fillInIncompleteTokens(tokens);

				const completeTokens = marked.marked.lexer(incomplete + '&nbsp;');
				assert.deepStrictEqual(newTokens, completeTokens);
			});

			it('text with start of list is not a heading', () => {
				const incomplete = `hello\n- `;
				const tokens = marked.marked.lexer(incomplete);
				const newTokens = fillInIncompleteTokens(tokens);

				const completeTokens = marked.marked.lexer(incomplete + ' &nbsp;');
				assert.deepStrictEqual(newTokens, completeTokens);
			});

			it('even more text with start of list is not a heading', () => {
				const incomplete = `# hello\n\ntext\n-`;
				const tokens = marked.marked.lexer(incomplete);
				const newTokens = fillInIncompleteTokens(tokens);

				const completeTokens = marked.marked.lexer(incomplete + ' &nbsp;');
				assert.deepStrictEqual(newTokens, completeTokens);
			});
		});

		describe('codespan', () => {
			simpleMarkdownTestSuite('codespan', '`');

			it(`backtick between letters`, () => {
				const text = 'a`b';
				const tokens = marked.marked.lexer(text);
				const newTokens = fillInIncompleteTokens(tokens);

				const completeCodespanTokens = marked.marked.lexer(text + '`');
				assert.deepStrictEqual(newTokens, completeCodespanTokens);
			});

			it(`nested pattern`, () => {
				const text = 'sldkfjsd `abc __def__ ghi';
				const tokens = marked.marked.lexer(text);
				const newTokens = fillInIncompleteTokens(tokens);

				const completeTokens = marked.marked.lexer(text + '`');
				assert.deepStrictEqual(newTokens, completeTokens);
			});
		});

		describe('star', () => {
			simpleMarkdownTestSuite('star', '*');

			it(`star between letters`, () => {
				const text = 'sldkfjsd a*b';
				const tokens = marked.marked.lexer(text);
				const newTokens = fillInIncompleteTokens(tokens);

				const completeTokens = marked.marked.lexer(text + '*');
				assert.deepStrictEqual(newTokens, completeTokens);
			});

			it(`nested pattern`, () => {
				const text = 'sldkfjsd *abc __def__ ghi';
				const tokens = marked.marked.lexer(text);
				const newTokens = fillInIncompleteTokens(tokens);

				const completeTokens = marked.marked.lexer(text + '*');
				assert.deepStrictEqual(newTokens, completeTokens);
			});
		});

		describe('double star', () => {
			simpleMarkdownTestSuite('double star', '**');

			it(`double star between letters`, () => {
				const text = 'a**b';
				const tokens = marked.marked.lexer(text);
				const newTokens = fillInIncompleteTokens(tokens);

				const completeTokens = marked.marked.lexer(text + '**');
				assert.deepStrictEqual(newTokens, completeTokens);
			});

			// TODO trim these patterns from end
			it.skip(`ending in doublestar`, () => {
				const incomplete = `some text and **`;
				const tokens = marked.marked.lexer(incomplete);
				const newTokens = fillInIncompleteTokens(tokens);

				const completeTokens = marked.marked.lexer(incomplete.trimEnd() + '**');
				assert.deepStrictEqual(newTokens, completeTokens);
			});
		});

		describe('underscore', () => {
			simpleMarkdownTestSuite('underscore', '_');

			it(`underscore between letters`, () => {
				const text = `this_not_italics`;
				const tokens = marked.marked.lexer(text);
				const newTokens = fillInIncompleteTokens(tokens);

				assert.deepStrictEqual(newTokens, tokens);
			});
		});

		describe('double underscore', () => {
			simpleMarkdownTestSuite('double underscore', '__');

			it(`double underscore between letters`, () => {
				const text = `this__not__bold`;
				const tokens = marked.marked.lexer(text);
				const newTokens = fillInIncompleteTokens(tokens);

				assert.deepStrictEqual(newTokens, tokens);
			});
		});

		describe('link', () => {
			it('incomplete link text', () => {
				const incomplete = 'abc [text';
				const tokens = marked.marked.lexer(incomplete);
				const newTokens = fillInIncompleteTokens(tokens);

				const completeTokens = marked.marked.lexer(incomplete + '](https://microsoft.com)');
				assert.deepStrictEqual(newTokens, completeTokens);
			});

			it('incomplete link target', () => {
				const incomplete = 'foo [text](http://microsoft';
				const tokens = marked.marked.lexer(incomplete);
				const newTokens = fillInIncompleteTokens(tokens);

				const completeTokens = marked.marked.lexer(incomplete + ')');
				assert.deepStrictEqual(newTokens, completeTokens);
			});

			it('incomplete link target 2', () => {
				const incomplete = 'foo [text](http://microsoft.com';
				const tokens = marked.marked.lexer(incomplete);
				const newTokens = fillInIncompleteTokens(tokens);

				const completeTokens = marked.marked.lexer(incomplete + ')');
				assert.deepStrictEqual(newTokens, completeTokens);
			});

			it('incomplete link target with extra stuff', () => {
				const incomplete = '[before `text` after](http://microsoft.com';
				const tokens = marked.marked.lexer(incomplete);
				const newTokens = fillInIncompleteTokens(tokens);

				const completeTokens = marked.marked.lexer(incomplete + ')');
				assert.deepStrictEqual(newTokens, completeTokens);
			});

			it('incomplete link target with extra stuff and incomplete arg', () => {
				const incomplete = '[before `text` after](http://microsoft.com "more text ';
				const tokens = marked.marked.lexer(incomplete);
				const newTokens = fillInIncompleteTokens(tokens);

				const completeTokens = marked.marked.lexer(incomplete + '")');
				assert.deepStrictEqual(newTokens, completeTokens);
			});

			it('incomplete link target with incomplete arg', () => {
				const incomplete = 'foo [text](http://microsoft.com "more text here ';
				const tokens = marked.marked.lexer(incomplete);
				const newTokens = fillInIncompleteTokens(tokens);

				const completeTokens = marked.marked.lexer(incomplete + '")');
				assert.deepStrictEqual(newTokens, completeTokens);
			});

			it('incomplete link target with incomplete arg 2', () => {
				const incomplete = '[text](command:vscode.openRelativePath "arg';
				const tokens = marked.marked.lexer(incomplete);
				const newTokens = fillInIncompleteTokens(tokens);

				const completeTokens = marked.marked.lexer(incomplete + '")');
				assert.deepStrictEqual(newTokens, completeTokens);
			});

			it('incomplete link target with complete arg', () => {
				const incomplete = 'foo [text](http://microsoft.com "more text here"';
				const tokens = marked.marked.lexer(incomplete);
				const newTokens = fillInIncompleteTokens(tokens);

				const completeTokens = marked.marked.lexer(incomplete + ')');
				assert.deepStrictEqual(newTokens, completeTokens);
			});

			it('link text with incomplete codespan', () => {
				const incomplete = `text [\`codespan`;
				const tokens = marked.marked.lexer(incomplete);
				const newTokens = fillInIncompleteTokens(tokens);

				const completeTokens = marked.marked.lexer(incomplete + '`](https://microsoft.com)');
				assert.deepStrictEqual(newTokens, completeTokens);
			});

			it('link text with incomplete stuff', () => {
				const incomplete = `text [more text \`codespan\` text **bold`;
				const tokens = marked.marked.lexer(incomplete);
				const newTokens = fillInIncompleteTokens(tokens);

				const completeTokens = marked.marked.lexer(incomplete + '**](https://microsoft.com)');
				assert.deepStrictEqual(newTokens, completeTokens);
			});

			it('Looks like incomplete link target but isn\'t', () => {
				const complete = '**bold** `codespan` text](';
				const tokens = marked.marked.lexer(complete);
				const newTokens = fillInIncompleteTokens(tokens);

				const completeTokens = marked.marked.lexer(complete);
				assert.deepStrictEqual(newTokens, completeTokens);
			});

			it.skip('incomplete link in list', () => {
				const incomplete = '- [text';
				const tokens = marked.marked.lexer(incomplete);
				const newTokens = fillInIncompleteTokens(tokens);

				const completeTokens = marked.marked.lexer(incomplete + '](https://microsoft.com)');
				assert.deepStrictEqual(newTokens, completeTokens);
			});

			it('square brace between letters', () => {
				const incomplete = 'a[b';
				const tokens = marked.marked.lexer(incomplete);
				const newTokens = fillInIncompleteTokens(tokens);

				assert.deepStrictEqual(newTokens, tokens);
			});

			it('square brace on previous line', () => {
				const incomplete = 'text[\nmore text';
				const tokens = marked.marked.lexer(incomplete);
				const newTokens = fillInIncompleteTokens(tokens);

				assert.deepStrictEqual(newTokens, tokens);
			});

			it('square braces in text', () => {
				const incomplete = 'hello [what] is going on';
				const tokens = marked.marked.lexer(incomplete);
				const newTokens = fillInIncompleteTokens(tokens);

				assert.deepStrictEqual(newTokens, tokens);
			});

			it('complete link', () => {
				const incomplete = 'text [link](http://microsoft.com)';
				const tokens = marked.marked.lexer(incomplete);
				const newTokens = fillInIncompleteTokens(tokens);

				assert.deepStrictEqual(newTokens, tokens);
			});
		});
	});
});
