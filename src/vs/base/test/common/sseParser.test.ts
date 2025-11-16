/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { ISSEEvent, SSEParser } from '../../common/sseParser.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from './utils.js';

// Helper function to convert string to Uint8Array for testing
function toUint8Array(str: string): Uint8Array {
	return new TextEncoder().encode(str);
}

describe('SSEParser', () => {
	let receivedEvents: ISSEEvent[];
	let parser: SSEParser;

	ensureNoDisposablesAreLeakedInTestSuite();

	beforeEach(() => {
		receivedEvents = [];
		parser = new SSEParser((event) => receivedEvents.push(event));
	});
	it('handles basic events', () => {
		parser.feed(toUint8Array('data: hello world\n\n'));

		assert.strictEqual(receivedEvents.length, 1);
		assert.strictEqual(receivedEvents[0].type, 'message');
		assert.strictEqual(receivedEvents[0].data, 'hello world');
	});
	it('handles events with multiple data fields', () => {
		parser.feed(toUint8Array('data: first line\ndata: second line\n\n'));

		assert.strictEqual(receivedEvents.length, 1);
		assert.strictEqual(receivedEvents[0].data, 'first line\nsecond line');
	});
	it('handles events with explicit event type', () => {
		parser.feed(toUint8Array('event: custom\ndata: hello world\n\n'));

		assert.strictEqual(receivedEvents.length, 1);
		assert.strictEqual(receivedEvents[0].type, 'custom');
		assert.strictEqual(receivedEvents[0].data, 'hello world');
	});
	it('handles events with explicit event type (CRLF)', () => {
		parser.feed(toUint8Array('event: custom\r\ndata: hello world\r\n\r\n'));

		assert.strictEqual(receivedEvents.length, 1);
		assert.strictEqual(receivedEvents[0].type, 'custom');
		assert.strictEqual(receivedEvents[0].data, 'hello world');
	});
	it('stream processing chunks', () => {
		for (const lf of ['\n', '\r\n', '\r']) {
			const message = toUint8Array(`event: custom${lf}data: hello world${lf}${lf}event: custom2${lf}data: hello world2${lf}${lf}`);
			for (let chunkSize = 1; chunkSize < 5; chunkSize++) {
				receivedEvents.length = 0;

				for (let i = 0; i < message.length; i += chunkSize) {
					const chunk = message.slice(i, i + chunkSize);
					parser.feed(chunk);
				}

				assert.deepStrictEqual(receivedEvents, [
					{ type: 'custom', data: 'hello world' },
					{ type: 'custom2', data: 'hello world2' }
				], `Failed for chunk size ${chunkSize} and line ending ${JSON.stringify(lf)}`);
			}
		}
	});
	it('handles events with ID', () => {
		parser.feed(toUint8Array('event: custom\ndata: hello\nid: 123\n\n'));

		assert.strictEqual(receivedEvents.length, 1);
		assert.strictEqual(receivedEvents[0].type, 'custom');
		assert.strictEqual(receivedEvents[0].data, 'hello');
		assert.strictEqual(receivedEvents[0].id, '123');
		assert.strictEqual(parser.getLastEventId(), '123');
	});

	it('ignores comments', () => {
		parser.feed(toUint8Array('event: custom\n:this is a comment\ndata: hello\n\n'));

		assert.strictEqual(receivedEvents.length, 1);
		assert.strictEqual(receivedEvents[0].data, 'hello');
	});

	it('handles retry field', () => {
		parser.feed(toUint8Array('retry: 5000\ndata: hello\n\n'));

		assert.strictEqual(receivedEvents.length, 1);
		assert.strictEqual(receivedEvents[0].data, 'hello');
		assert.strictEqual(receivedEvents[0].retry, 5000);
		assert.strictEqual(parser.getReconnectionTime(), 5000);
	});
	it('handles invalid retry field', () => {
		parser.feed(toUint8Array('retry: invalid\ndata: hello\n\n'));

		assert.strictEqual(receivedEvents.length, 1);
		assert.strictEqual(receivedEvents[0].data, 'hello');
		assert.strictEqual(receivedEvents[0].retry, undefined);
		assert.strictEqual(parser.getReconnectionTime(), undefined);
	});

	it('ignores fields with NULL character in ID', () => {
		parser.feed(toUint8Array('id: 12\0 3\ndata: hello\n\n'));

		assert.strictEqual(receivedEvents.length, 1);
		assert.strictEqual(receivedEvents[0].id, undefined);
		assert.strictEqual(parser.getLastEventId(), undefined);
	});

	it('handles fields with no value', () => {
		parser.feed(toUint8Array('data\nid\n\n'));

		assert.strictEqual(receivedEvents.length, 1);
		assert.strictEqual(receivedEvents[0].data, '');
		assert.strictEqual(receivedEvents[0].id, '');
	});
	it('handles fields with space after colon', () => {
		parser.feed(toUint8Array('data: hello\nevent: custom\nid: 123\n\n'));

		assert.strictEqual(receivedEvents.length, 1);
		assert.strictEqual(receivedEvents[0].data, 'hello');
		assert.strictEqual(receivedEvents[0].type, 'custom');
		assert.strictEqual(receivedEvents[0].id, '123');
	});

	it('handles different line endings (LF)', () => {
		parser.feed(toUint8Array('data: hello\n\n'));

		assert.strictEqual(receivedEvents.length, 1);
		assert.strictEqual(receivedEvents[0].data, 'hello');
	});

	it('handles different line endings (CR)', () => {
		parser.feed(toUint8Array('data: hello\r\r'));

		assert.strictEqual(receivedEvents.length, 1);
		assert.strictEqual(receivedEvents[0].data, 'hello');
	});

	it('handles different line endings (CRLF)', () => {
		parser.feed(toUint8Array('data: hello\r\n\r\n'));

		assert.strictEqual(receivedEvents.length, 1);
		assert.strictEqual(receivedEvents[0].data, 'hello');
	});
	it('handles empty data with blank line', () => {
		parser.feed(toUint8Array('data:\n\n'));

		assert.strictEqual(receivedEvents.length, 1);
		assert.strictEqual(receivedEvents[0].data, '');
	});

	it('ignores events with no data after blank line', () => {
		parser.feed(toUint8Array('event: custom\n\n'));

		assert.strictEqual(receivedEvents.length, 0);
	});

	it('supports chunked data', () => {
		parser.feed(toUint8Array('event: cus'));
		parser.feed(toUint8Array('tom\nda'));
		parser.feed(toUint8Array('ta: hello\n'));
		parser.feed(toUint8Array('\n'));

		assert.strictEqual(receivedEvents.length, 1);
		assert.strictEqual(receivedEvents[0].type, 'custom');
		assert.strictEqual(receivedEvents[0].data, 'hello');
	});

	it('supports spec example', () => {
		// Example from the spec
		parser.feed(toUint8Array(':This is a comment\ndata: first event\nid: 1\n\n'));
		parser.feed(toUint8Array('data:second event\nid\n\n'));
		parser.feed(toUint8Array('data:  third event\n\n'));

		assert.strictEqual(receivedEvents.length, 3);
		assert.strictEqual(receivedEvents[0].data, 'first event');
		assert.strictEqual(receivedEvents[0].id, '1');
		assert.strictEqual(receivedEvents[1].data, 'second event');
		assert.strictEqual(receivedEvents[1].id, '');
		assert.strictEqual(receivedEvents[2].data, ' third event');
	});

	it('resets correctly', () => {
		parser.feed(toUint8Array('data: hello\n'));
		parser.reset();
		parser.feed(toUint8Array('data: world\n\n'));

		assert.strictEqual(receivedEvents.length, 1);
		assert.strictEqual(receivedEvents[0].data, 'world');
	});
});
