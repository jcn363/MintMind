/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
const { vscodeLogger, createModuleLogger } = require('./src/vs/base/common/logger.js');

// Test del logger principal
console.log('=== Testing MintMind Logger ===');
vscodeLogger.debug('This is a debug message');
vscodeLogger.info('This is an info message');
vscodeLogger.warn('This is a warning message');
vscodeLogger.error('This is an error message');

// Test del logger de módulo
console.log('=== Testing Module Logger ===');
const testLogger = createModuleLogger('test-module');
testLogger.debug('Debug from test module');
testLogger.info('Info from test module');
testLogger.warn('Warn from test module');
testLogger.error('Error from test module');

// Test con error object
console.log('=== Testing Error Logging ===');
try {
  throw new Error('Test error');
} catch (err) {
  vscodeLogger.error('Caught test error', err);
  testLogger.error('Caught test error in module', err);
}

console.log('Logger test completed');
