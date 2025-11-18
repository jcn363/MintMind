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
  maxWorkers: '50%', // Dynamic worker allocation based on CPU cores for modern parallelization
  forceExit: true, // Force exit in CI environments to prevent hanging processes
  detectOpenHandles: true, // Detect open handles to prevent resource leaks
  clearMocks: true,
  restoreMocks: true,
  testTimeout: 5000, // Unit tests: 5s max
  workerIdleMemoryLimit: '256MB', // Reduced memory limit for better resource management
  detectLeaks: false,

  // Enhanced performance optimizations
  cache: true,
  cacheDirectory: '<rootDir>/.jest/cache',
  haste: {
    computeSha1: true,
    throwOnModuleCollision: false,
  },

  // Watch path optimizations for better performance
  watchPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/.git/',
    '<rootDir>/coverage/',
    '<rootDir>/test-results/',
    '<rootDir>/.jest/',
    '<rootDir>/out/',
    '<rootDir>/.vscode-test/',
    '<rootDir>/extensions/',
    '<rootDir>/docs/',
    '<rootDir>/scripts/',
    '<rootDir>/resources/',
  ],

  // Additional performance settings
  errorOnDeprecated: false,
  resetModules: false, // Keep modules for better performance
  resetMocks: false,
  restoreMocks: true,

  // Custom timeouts based on test type
  // Note: Integration tests use 10s, E2E use 30s via test file configuration
};

  // Override testEnvironment for Tauri tests
  if (process.env.TEST_PATH_PATTERN && process.env.TEST_PATH_PATTERN.includes('tauri')) {
    config.testEnvironment = 'node';
  }

export default config;