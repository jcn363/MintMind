/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IObservable, ITransaction } from '../observable.js';
import { observableValueOpts } from './observables/observableValueOpts.js';

export class ObservableSet<T> implements Set<T> {

	private readonly _data = new Set<T>();

	private _obs = observableValueOpts({ equalsFn: () => false }, this);

	readonly observable: IObservable<Set<T>> = this._obs;

	get size(): number {
		return this._data.size;
	}

	has(value: T): boolean {
		return this._data.has(value);
	}

	add(value: T, tx?: ITransaction): this {
		const hadValue = this._data.has(value);
		if (!hadValue) {
			this._data.add(value);
			this._obs.set(this, tx);
		}
		return this;
	}

	delete(value: T, tx?: ITransaction): boolean {
		const result = this._data.delete(value);
		if (result) {
			this._obs.set(this, tx);
		}
		return result;
	}

	clear(tx?: ITransaction): void {
		if (this._data.size > 0) {
			this._data.clear();
			this._obs.set(this, tx);
		}
	}

	forEach(callbackfn: (value: T, value2: T, set: Set<T>) => void, thisArg?: any): void {
		this._data.forEach((value, value2, _set) => {
			// eslint-disable-next-line local/code-no-any-casts
			callbackfn.call(thisArg, value, value2, this as any);
		});
	}

	entries(): SetIterator<[T, T]> {
		const iterator = this._data.values();
		return {
			next: () => {
				const result = iterator.next();
				return result.done ? { value: undefined, done: true } : { value: [result.value, result.value] as [T, T], done: false };
			},
			[Symbol.iterator]: function() { return this; },
			[Symbol.dispose]: () => {}
		};
	}

	keys(): SetIterator<T> {
		const iterator = this._data.keys();
		return {
			next: () => {
				const result = iterator.next();
				return result.done ? { value: undefined, done: true } : { value: result.value, done: false };
			},
			[Symbol.iterator]: function() { return this; },
			[Symbol.dispose]: () => {}
		};
	}

	values(): SetIterator<T> {
		const iterator = this._data.values();
		return {
			next: () => {
				const result = iterator.next();
				return result.done ? { value: undefined, done: true } : { value: result.value, done: false };
			},
			[Symbol.iterator]: function() { return this; },
			[Symbol.dispose]: () => {}
		};
	}

	[Symbol.iterator](): SetIterator<T> {
		return this.values();
	}

	get [Symbol.toStringTag](): string {
		return 'ObservableSet';
	}
}
