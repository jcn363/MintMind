/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// This is a facade for the observable implementation. Only import from here!

export { type IObservable, type IObservableWithChange, type IObserver, type IReader, type ISettable, type ISettableObservable, type ITransaction } from './base.js';
export { recordChanges, recordChangesLazy, type IChangeContext, type IChangeTracker } from './changeTracker.js';
export { type DebugOwner } from './debugName.js';
export { derivedConstOnceDefined, latestChangedValue } from './experimental/utils.js';
export { constObservable } from './observables/constObservable.js';
export { derived, derivedDisposable, derivedHandleChanges, derivedOpts, derivedWithSetter, derivedWithStore } from './observables/derived.js';
export { type IDerivedReader } from './observables/derivedImpl.js';
export { observableFromEvent, observableFromEventOpts } from './observables/observableFromEvent.js';
export { observableSignal, type IObservableSignal } from './observables/observableSignal.js';
export { observableSignalFromEvent } from './observables/observableSignalFromEvent.js';
export { disposableObservableValue, observableValue } from './observables/observableValue.js';
export { observableValueOpts } from './observables/observableValueOpts.js';
export { autorun, autorunDelta, autorunHandleChanges, autorunIterableDelta, autorunOpts, autorunSelfDisposable, autorunWithStore, autorunWithStoreHandleChanges } from './reactions/autorun.js';
export { TransactionImpl, asyncTransaction, globalTransaction, subtransaction, transaction } from './transaction.js';
export { ObservableLazy, ObservableLazyPromise, ObservablePromise, PromiseResult } from './utils/promise.js';
export { runOnChange, runOnChangeWithCancellationToken, runOnChangeWithStore, type RemoveUndefined } from './utils/runOnChange.js';
export {
    debouncedObservable, debouncedObservableDeprecated, derivedObservableWithCache,
    derivedObservableWithWritableCache, keepObserved, mapObservableArrayCached, observableFromPromise,
    recomputeInitiallyAndOnChange,
    signalFromObservable, wasEventTriggeredRecently
} from './utils/utils.js';
export { derivedWithCancellationToken, waitForState } from './utils/utilsCancellation.js';
export { ValueWithChangeEventFromObservable, observableFromValueWithChangeEvent } from './utils/valueWithChangeEvent.js';

export { DebugLocation } from './debugLocation.js';
export { ObservableMap } from './map.js';
export { ObservableSet } from './set.js';

import { env } from '../process.js';
import { ConsoleObservableLogger, logObservableToConsole } from './logging/consoleObservableLogger.js';
import { debugGetObservableGraph } from './logging/debugGetDependencyGraph.js';
import { DevToolsLogger } from './logging/debugger/devToolsLogger.js';
import { addLogger, setLogObservableFn } from './logging/logging.js';
import { _setDebugGetObservableGraph } from './observables/baseObservable.js';

_setDebugGetObservableGraph(debugGetObservableGraph);
setLogObservableFn(logObservableToConsole);

// Remove "//" in the next line to enable logging
const enableLogging = false
	// || Boolean("true") // done "weirdly" so that a lint warning prevents you from pushing this
	;

if (enableLogging) {
	addLogger(new ConsoleObservableLogger());
}

if (env && env['MINTMIND_DEV_DEBUG_OBSERVABLES']) {
	// To debug observables you also need the extension "ms-vscode.debug-value-editor"
	addLogger(DevToolsLogger.getInstance());
}
