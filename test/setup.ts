/**
 * Jest setup file for MintMind project
 * Configures global test environment and utilities
 */

// Declaraciones de tipos globales para tests
declare global {
  namespace NodeJS {
    interface Global {
      testUtils: {
        createMockFunction: <T extends (...args: any[]) => any>(implementation?: T) => jest.MockedFunction<T>;
        createMockObject: <T extends Record<string, any>>(defaultValues?: Partial<T>) => jest.Mocked<T>;
        flushPromises: () => Promise<void>;
        waitForCondition: (condition: () => boolean, timeout?: number) => Promise<void>;
        createTestId: (prefix?: string) => string;
      };
    }
  }

  var testUtils: {
    createMockFunction: <T extends (...args: any[]) => any>(implementation?: T) => jest.MockedFunction<T>;
    createMockObject: <T extends Record<string, any>>(defaultValues?: Partial<T>) => jest.Mocked<T>;
    flushPromises: () => Promise<void>;
    waitForCondition: (condition: () => boolean, timeout?: number) => Promise<void>;
    createTestId: (prefix?: string) => string;
  };
}

// Configurar variables de entorno para tests con respaldo seguro
const originalEnv = { ...process.env };
process.env.NODE_ENV = 'test';
process.env.BUN_ENV = 'test';
process.env.JEST_WORKER_ID = process.env.JEST_WORKER_ID || '1';

// Función para restaurar variables de entorno originales después de cada test
const restoreOriginalEnv = () => {
  Object.keys(process.env).forEach(key => {
    if (!(key in originalEnv)) {
      delete process.env[key];
    } else {
      process.env[key] = originalEnv[key];
    }
  });
};

// Limpiar cambios de process.env después de cada test
afterEach(() => {
  restoreOriginalEnv();
});

// Utilidades globales para tests
const testUtils = {
  /**
   * Crea una función mock con implementación opcional
   */
  createMockFunction: <T extends (...args: any[]) => any>(implementation?: T): jest.MockedFunction<T> => {
    const mock = jest.fn(implementation);
    return mock as jest.MockedFunction<T>;
  },

  /**
   * Crea un objeto mock con valores por defecto
   */
  createMockObject: <T extends Record<string, any>>(defaultValues: Partial<T> = {}): jest.Mocked<T> => {
    const mock = { ...defaultValues } as jest.Mocked<T>;
    return mock;
  },

  /**
   * Utilidad para esperar a que todas las promesas pendientes se resuelvan
   */
  flushPromises: (): Promise<void> => {
    return new Promise(resolve => setImmediate(resolve));
  },

  /**
   * Espera a que una condición sea verdadera con timeout opcional
   */
  waitForCondition: async (condition: () => boolean, timeout: number = 5000): Promise<void> => {
    const startTime = Date.now();

    while (!condition()) {
      if (Date.now() - startTime > timeout) {
        throw new Error(`Condition not met within ${timeout}ms`);
      }
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  },

  /**
   * Crea un ID único para tests
   */
  createTestId: (prefix: string = 'test'): string => {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
};

// Asignar testUtils al objeto global con tipado correcto
(globalThis as any).testUtils = testUtils;

// Configurar Jest globals
beforeAll(() => {
  // Configuración global antes de todos los tests
  jest.setTimeout(15000); // 15 second timeout para tests más complejos
});

beforeEach(() => {
  // Limpiar mocks con mejor aislamiento por test
  jest.clearAllMocks();
  jest.resetAllMocks();
  jest.restoreAllMocks();

  // Reset modules para evitar interferencias entre tests
  jest.resetModules();
});

afterEach(() => {
  // Limpiar después de cada test
  jest.clearAllTimers();

  // Limpiar cualquier listener o estado global
  if (typeof global.gc === 'function') {
    global.gc(); // Forzar garbage collection en entornos que lo soporten
  }
});

afterAll(() => {
  // Limpieza final después de todos los tests
  jest.clearAllTimers();
  jest.useRealTimers();
  jest.restoreAllMocks();
});

export {};
