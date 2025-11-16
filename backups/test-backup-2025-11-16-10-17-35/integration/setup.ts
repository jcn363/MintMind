/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { jest } from '@jest/globals';

// Configurar timeout global para tests de integración
jest.setTimeout(30000);

// Configurar variables de entorno para tests
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error'; // Reducir logs durante tests

// Limpiar mocks después de cada test para evitar contaminación
afterEach(() => {
  jest.clearAllMocks();
});

// Limpiar todos los mocks después de todos los tests
afterAll(() => {
  jest.restoreAllMocks();
});

// Configuración adicional específica para integración
global.testConfig = {
  database: {
    host: 'localhost',
    port: 5432,
    database: 'test_db',
    username: 'test_user',
    password: 'test_password'
  },
  api: {
    baseUrl: 'http://localhost:3001',
    timeout: 5000
  },
  redis: {
    host: 'localhost',
    port: 6379
  }
};

// Declaraciones de tipos globales para tests de integración
declare global {
  var testConfig: {
    database: {
      host: string;
      port: number;
      database: string;
      username: string;
      password: string;
    };
    api: {
      baseUrl: string;
      timeout: number;
    };
    redis: {
      host: string;
      port: number;
    };
  };
}
