/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/extensions'],
  testMatch: [
    '**/__integration__/**/*.test.ts',
    '**/__integration__/**/*.spec.ts',
    '**/*.integration.test.ts',
    '**/*.integration.spec.ts'
  ],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      useESM: true,
      tsconfig: 'tsconfig.json'
    }]
  },
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapping: {
    '^(\\.{1,2}/.*)\\.js$': '$1'
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    'extensions/**/*.ts',
    '!src/**/*.d.ts',
    '!extensions/**/*.d.ts',
    '!**/node_modules/**',
    '!**/out/**',
    '!**/build/**'
  ],
  coverageDirectory: 'coverage/integration',
  coverageReporters: ['text', 'lcov', 'html'],
  setupFilesAfterEnv: ['<rootDir>/test/integration/setup.ts'],
  testTimeout: 30000, // Tests de integración pueden tomar más tiempo
  verbose: true,
  maxWorkers: '50%',
  // Configuración específica para tests de integración
  testPathIgnorePatterns: [
    '/node_modules/',
    '/test/unit/',
    '/test/e2e/',
    '/test/smoke/',
    '/test/automation/'
  ],
  // Forzar recolección de cobertura en tests de integración
  collectCoverage: true,
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  }
};
