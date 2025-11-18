/** @type {import('jest').Config} */
const config = {
  preset: 'ts-jest/presets/default-esm',
  extensionsToTreatAsEsm: ['.ts', '.tsx'],
  testEnvironment: 'node',
  testEnvironmentOptions: {
    url: 'http://localhost',
  },
  setupFiles: [
  ],
  setupFilesAfterEnv: [
    '<rootDir>/test/setup.ts',
    '<rootDir>/test/__mocks__/browser-mock.ts',
  ],
  moduleNameMapper: {
    '^vs/(.*)$': '<rootDir>/src/vs/$1',
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '^@tauri-apps/api/core': '<rootDir>/test/tauri/__mocks__/@tauri-apps-api-core.ts',
    '^@tauri-apps/api/event': '<rootDir>/test/tauri/__mocks__/@tauri-apps-api-event.ts',
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      useESM: true,
      tsconfig: {
        module: 'ESNext',
        target: 'ES2022',
        moduleResolution: 'node',
        allowSyntheticDefaultImports: true,
        esModuleInterop: true,
        allowJs: true,
        checkJs: false,
        verbatimModuleSyntax: false,
      },
      diagnostics: {
        ignoreCodes: [151001, 151002, 151005, 151008, 151009, 151010, 151011, 151012, 151019, 151021, 151022, 151030, 151131],
      },
    }],
  },
  testMatch: [
    '<rootDir>/**/test/**/*.test.ts',
    '<rootDir>/**/test/**/*.test.tsx',
    '<rootDir>/test/tauri/**/*.test.ts',
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/out/',
    '/.vscode-test/',
    '/extensions/',
  ],
  collectCoverageFrom: [
    'src/**/*.{ts,js}',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**',
    '!src/**/__mocks__/**',
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
  coverageReporters: ['text', 'lcov', 'html'],
  reporters: [
    'default',
    ['jest-junit', {
      outputDirectory: 'test-results',
      outputName: 'junit.xml',
      ancestorSeparator: ' › ',
      uniqueOutputName: false,
      suiteNameTemplate: '{filepath}',
      classNameTemplate: '{classname}',
      titleTemplate: '{title}'
    }]
  ],
  maxWorkers: 1, // Optimized for Bun runtime
  forceExit: false, // Disabled to prevent early exit issues
  detectOpenHandles: false, // Disabled for performance, re-enable if needed
  clearMocks: true,
  restoreMocks: true,
  testTimeout: 15000,
  workerIdleMemoryLimit: '1GB', // Increased from 512MB for better stability
  detectLeaks: false,

  // Performance optimizations
  cache: true,
  cacheDirectory: '<rootDir>/.jest/cache',
  haste: {
    computeSha1: true,
    throwOnModuleCollision: false,
  },

  // Additional performance settings
  errorOnDeprecated: false,
  resetModules: false, // Keep modules for better performance
  resetMocks: false,
  restoreMocks: true,
};

  // Override testEnvironment for Tauri tests
  if (process.env.TEST_PATH_PATTERN && process.env.TEST_PATH_PATTERN.includes('tauri')) {
    config.testEnvironment = 'node';
  }

export default config;