/** @type {import('jest').Config} */
const config = {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'jsdom',
  testEnvironmentOptions: {
    url: 'http://localhost',
  },
  setupFiles: [
    '<rootDir>/test/__mocks__/browser-mock.ts',
  ],
  setupFilesAfterEnv: [
    '<rootDir>/test/setup.ts',
  ],
  moduleNameMapper: {
    '^vs/(.*)$': '<rootDir>/src/vs/$1',
    '^(\\.{1,2}/.*)\\.js$': '$1',
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
  maxWorkers: '75%', // Increased from 50% for better parallelization
  forceExit: false, // Disabled to prevent early exit issues
  detectOpenHandles: false, // Disabled for performance, re-enable if needed
  clearMocks: true,
  restoreMocks: true,
  testTimeout: 10000,
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

export default config;