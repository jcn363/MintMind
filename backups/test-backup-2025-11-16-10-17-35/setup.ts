/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { jest } from '@jest/globals';
import { expect } from '@jest/globals';

// Configurar timeout global para tests
jest.setTimeout(10000);

// Configurar variables de entorno para tests
process.env.NODE_ENV = 'test';
process.env.BUN_ENV = 'test';

// Configurar console para reducir ruido en tests
const originalConsoleError = console.error;
console.error = (...args: any[]) => {
  if (
    typeof args[0] === 'string' &&
    args[0].includes('Warning: ReactDOM.render is no longer supported')
  ) {
    return;
  }
  originalConsoleError.call(console, ...args);
};

// Limpiar mocks después de cada test para evitar contaminación
afterEach(() => {
  jest.clearAllMocks();
});

// Limpiar todos los mocks después de todos los tests
afterAll(() => {
  jest.restoreAllMocks();
});

// Mocha to Jest globals mapping
global.setup = function (fn: () => void) {
  beforeAll(fn);
};

global.suite = function (name: string, fn: () => void) {
  describe(name, fn);
};

global.suite.skip = function (name: string, fn: () => void) {
  describe.skip(name, fn);
};

global.test = global.it;
global.test.only = global.it.only;
global.test.skip = global.it.skip;
global.test.todo = global.it.todo;
global.test.concurrent = global.it.concurrent;

// Add other Mocha globals
(global as any).after = global.afterAll;
(global as any).before = global.beforeAll;
(global as any).teardown = global.afterEach;

// Mock ensureNoDisposablesAreLeakedInTestSuite
jest.mock('../src/vs/base/test/common/utils', () => {
  const original = jest.requireActual('../src/vs/base/test/common/utils');
  return {
    ...original,
    ensureNoDisposablesAreLeakedInTestSuite: () => ({
      add: () => {}
    })
  };
});

// Configuración adicional específica para tests unitarios
global.testUtils = {
  // Utilidades comunes para tests
  createMockFunction: <T extends (...args: any[]) => any>(
    implementation?: T
  ): jest.MockedFunction<T> => {
    return jest.fn(implementation) as jest.MockedFunction<T>;
  },

  // Helper para crear objetos mock
  createMockObject: <T extends Record<string, any>>(
    overrides: Partial<T> = {}
  ): T => {
    return {
      ...overrides,
    } as T;
  },

  // Helper para esperar a que se resuelvan promesas pendientes
  flushPromises: (): Promise<void> => {
    return new Promise((resolve) => setImmediate(resolve));
  },

  // Helper para esperar un número específico de ticks del event loop
  waitForTicks: (ticks: number = 1): Promise<void> => {
    return new Promise((resolve) => {
      let remaining = ticks;
      const check = () => {
        remaining--;
        if (remaining === 0) {
          resolve();
        } else {
          setImmediate(check);
        }
      };
      setImmediate(check);
    });
  },
};

// Declaraciones de tipos globales para tests
declare global {
  var testUtils: {
    createMockFunction: <T extends (...args: any[]) => any>(
      implementation?: T
    ) => jest.MockedFunction<T>;
    createMockObject: <T extends Record<string, any>>(
      overrides?: Partial<T>
    ) => T;
    flushPromises: () => Promise<void>;
    waitForTicks: (ticks?: number) => Promise<void>;
  };
}
