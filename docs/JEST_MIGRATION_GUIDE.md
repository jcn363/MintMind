# Jest Migration Guide

## Section 2: Installing Jest and Dependencies

This section covers the installation of Jest and its required dependencies, including the removal of existing test framework packages and setup for TypeScript support.

### Removing Existing Test Framework Packages

Before installing Jest, remove any existing testing frameworks from your project to avoid conflicts and ensure a clean migration.

**For npm:**
```bash
npm uninstall mocha chai sinon
npm uninstall @types/mocha @types/chai @types/sinon
```

**For yarn:**
```bash
yarn remove mocha chai sinon
yarn remove @types/mocha @types/chai @types/sinon
```

**For bun:**
```bash
bun remove mocha chai sinon
bun remove @types/mocha @types/chai @types/sinon
```

### Installing Jest Core Dependencies

Install Jest and the essential packages required for a TypeScript testing environment.

**For npm:**
```bash
npm install --save-dev jest @types/jest ts-jest
```

**For yarn:**
```bash
yarn add --dev jest @types/jest ts-jest
```

**For bun:**
```bash
bun add -d jest @types/jest ts-jest
```

### TypeScript Support Setup

For projects using TypeScript, ensure the TypeScript compiler and related tools are properly configured for Jest integration.

**Additional TypeScript testing dependencies (if not already installed):**
```bash
npm install --save-dev typescript tslib
```

**For yarn:**
```bash
yarn add --dev typescript tslib
```

**For bun:**
```bash
bun add -d typescript tslib
```

### Package.json Scripts Update

Update your `package.json` scripts section to include Jest test commands. Replace or update existing test scripts:

```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage"
  }
}
```

### Environment-Specific Dependencies

For projects requiring DOM testing or browser environment simulation:

**For DOM testing with jsdom:**
```bash
npm install --save-dev jest-environment-jsdom
```

**For yarn:**
```bash
yarn add --dev jest-environment-jsdom
```

**For bun:**
```bash
bun add -d jest-environment-jsdom
```

### Verification

After installation, verify the setup by running:

```bash
npm run test
```

This should execute Jest with your basic configuration and display the test results.

### Common Installation Issues

- **Permission errors**: Use `sudo` if installing globally, though local dev dependencies are preferred
- **Lock file conflicts**: Delete `package-lock.json` or `yarn.lock` and reinstall if experiencing resolution issues
- **TypeScript compilation errors**: Ensure `typescript` is installed and `tsconfig.json` is properly configured

The dependencies are now installed and ready for Jest configuration in the following sections.

## Section 3: Configuring Jest

This section covers the configuration of Jest for Babel support, TypeScript integration, code coverage settings, and mocking strategies. Proper configuration ensures that Jest can handle your project's specific requirements and testing patterns.

### Basic Jest Configuration

Create a `jest.config.js` file in your project root or configure Jest in your `package.json`. Here are examples for different project setups:

#### TypeScript-Only Project (ESM)

For projects using TypeScript with ES modules, use this configuration:

```javascript
/** @type {import('jest').Config} */
const config = {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.test.ts',
    '<rootDir>/src/**/*.test.ts'
  ],
  collectCoverageFrom: [
    'src/**/*.{ts,js}',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**'
  ],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1'
  }
};

export default config;
```

#### JavaScript with Babel Project

For projects using Babel for JavaScript transformation:

```javascript
module.exports = {
  testEnvironment: 'node',
  transform: {
    '^.+\\.js$': 'babel-jest'
  },
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.test.js',
    '<rootDir>/src/**/*.test.js'
  ],
  collectCoverageFrom: [
    'src/**/*.{js,jsx}',
    '!src/**/__tests__/**'
  ]
};
```

#### Mixed TypeScript/JavaScript Project

For projects with both TypeScript and JavaScript:

```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.test.{ts,tsx,js,jsx}',
    '<rootDir>/src/**/*.test.{ts,tsx,js,jsx}'
  ],
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest',
    '^.+\\.(js|jsx)$': 'babel-jest'
  },
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1'
  },
  collectCoverageFrom: [
    'src/**/*.{ts,tsx,js,jsx}',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**'
  ]
};
```

### Babel Configuration

If your project uses Babel, create or update your `babel.config.js`:

```javascript
module.exports = {
  presets: [
    [
      '@babel/preset-env',
      {
        targets: {
          node: 'current'
        }
      }
    ],
    '@babel/preset-typescript'
  ]
};
```

For React projects:

```javascript
module.exports = {
  presets: [
    [
      '@babel/preset-env',
      {
        targets: {
          node: 'current'
        }
      }
    ],
    '@babel/preset-typescript',
    ['@babel/preset-react', { runtime: 'automatic' }]
  ]
};
```

### TypeScript Configuration

Ensure your `tsconfig.json` is properly configured for Jest:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "node",
    "allowSyntheticDefaultImports": true,
    "esModuleInterop": true,
    "allowJs": true,
    "checkJs": false,
    "verbatimModuleSyntax": false,
    "types": ["jest", "node"],
    "declaration": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": [
    "src/**/*",
    "test/**/*"
  ],
  "exclude": [
    "node_modules",
    "dist",
    "**/*.test.ts"
  ]
}
```

### Coverage Configuration

Configure code coverage thresholds and collection:

#### Basic Coverage Setup

```javascript
module.exports = {
  collectCoverageFrom: [
    'src/**/*.{js,ts,jsx,tsx}',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**',
    '!src/**/__mocks__/**',
    '!src/index.{js,ts}',
    '!src/types/**'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  coverageReporters: [
    'text',
    'lcov',
    'html'
  ],
  coverageDirectory: 'coverage'
};
```

#### Coverage for Multiple Environments

```javascript
module.exports = {
  collectCoverageFrom: [
    'src/**/*.{js,ts,jsx,tsx}',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**',
    '!src/**/__mocks__/**'
  ],
  coverageThreshold: {
    global: {
      branches: 75,
      functions: 75,
      lines: 75,
      statements: 75
    },
    './src/components/': {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90
    },
    './src/utils/': {
      branches: 85,
      functions: 85,
      lines: 85,
      statements: 85
    }
  }
};
```

### Mocking Setup

Configure mocking strategies for different scenarios:

#### Module Mocking

```javascript
module.exports = {
  moduleNameMapper: {
    // Mock CSS imports
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    // Mock image imports
    '\\.(jpg|jpeg|png|gif|svg)$': '<rootDir>/__mocks__/fileMock.js',
    // Alias resolution
    '^@/(.*)$': '<rootDir>/src/$1'
  }
};
```

#### Setup Files

Create setup files for global mocks and configurations:

```javascript
// test/setup.ts
import 'jest-canvas-mock';

// Mock fetch globally
global.fetch = jest.fn();

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
global.localStorage = localStorageMock;

// Mock window methods
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});
```

#### Manual Mocks

Create manual mocks in `__mocks__` directories:

```javascript
// __mocks__/axios.js
const mockAxios = jest.createMockFromModule('axios');

mockAxios.create = jest.fn(() => mockAxios);
mockAxios.get = jest.fn(() => Promise.resolve({ data: {} }));
mockAxios.post = jest.fn(() => Promise.resolve({ data: {} }));

export default mockAxios;
```

#### ESM Module Mocking

For ES modules, use different approaches:

```javascript
// For named exports
jest.mock('some-module', () => ({
  namedExport: jest.fn(),
  anotherExport: jest.fn()
}));

// For default exports
jest.mock('some-module', () => jest.fn());

// For mixed exports
jest.mock('some-module', () => ({
  __esModule: true,
  default: jest.fn(),
  namedExport: jest.fn()
}));
```

### Package.json Configuration

You can also configure Jest directly in `package.json`:

```json
{
  "jest": {
    "preset": "ts-jest",
    "testEnvironment": "jsdom",
    "testMatch": [
      "<rootDir>/src/**/__tests__/**/*.test.{ts,tsx}",
      "<rootDir>/src/**/*.test.{ts,tsx}"
    ],
    "moduleNameMapper": {
      "^@/(.*)$": "<rootDir>/src/$1",
      "\\.(css|less|scss|sass)$": "identity-obj-proxy"
    },
    "collectCoverageFrom": [
      "src/**/*.{ts,tsx}",
      "!src/**/*.d.ts",
      "!src/**/__tests__/**"
    ],
    "setupFilesAfterEnv": ["<rootDir>/test/setup.ts"],
    "transform": {
      "^.+\\.(ts|tsx)$": "ts-jest"
    }
  }
}
```

### Environment-Specific Configuration

#### Node.js Environment

```javascript
module.exports = {
  testEnvironment: 'node',
  testMatch: [
    '<rootDir>/src/**/*.test.ts'
  ],
  // Node-specific settings
  setupFilesAfterEnv: ['<rootDir>/test/setup-node.ts']
};
```

#### Browser Environment (jsdom)

```javascript
module.exports = {
  testEnvironment: 'jsdom',
  testEnvironmentOptions: {
    url: 'http://localhost:3000',
    userAgent: 'JestTestAgent/1.0'
  },
  setupFiles: ['<rootDir>/test/browser-mock.ts'],
  setupFilesAfterEnv: ['<rootDir>/test/setup-browser.ts']
};
```

### Advanced Configuration Options

#### Performance Optimization

```javascript
module.exports = {
  // Run tests in parallel
  maxWorkers: '50%',
  
  // Timeout settings
  testTimeout: 10000,
  
  // Force exit to prevent hanging
  forceExit: true,
  detectOpenHandles: true,
  
  // Memory management
  workerIdleMemoryLimit: '512MB',
  detectLeaks: false,
  
  // Clear mocks between tests
  clearMocks: true,
  restoreMocks: true
};
```

#### Custom Test Environment

```javascript
// custom-environment.js
const JsdomTestEnvironment = require('jest-environment-jsdom');

class CustomTestEnvironment extends JsdomTestEnvironment {
  async setup() {
    await super.setup();
    // Custom setup logic
    this.global.customProperty = 'value';
  }

  async teardown() {
    // Custom teardown logic
    await super.teardown();
  }
}

module.exports = CustomTestEnvironment;
```

Then use it in your config:

```javascript
module.exports = {
  testEnvironment: './custom-environment.js'
};
```

### Configuration Validation

After setting up your configuration, validate it by running:

```bash
npx jest --showConfig
```

This command displays your complete Jest configuration and helps identify any issues.

### Common Configuration Issues

- **Module resolution errors**: Ensure `moduleNameMapper` correctly maps your import aliases
- **Transform errors**: Verify that your `transform` configuration matches your file extensions
- **Coverage collection issues**: Check that `collectCoverageFrom` patterns correctly exclude test files
- **ESM/CommonJS conflicts**: Use appropriate presets (`default-esm` for ES modules)
- **TypeScript compilation errors**: Ensure `tsconfig.json` paths are correctly configured

The Jest configuration is now complete and ready for writing tests in the following sections.

## Section 4: Converting Test Files

This section covers the conversion of existing test files from Mocha/Jasmine to Jest syntax. It focuses on syntax changes, assertion migration, spy and mock conversions, timeout handling, and async test patterns. Each subsection provides before/after code examples to illustrate the migration process.

### Syntax Changes: describe/it Blocks

Jest uses the same `describe` and `it` functions as Mocha/Jasmine, so basic test structure remains unchanged. However, Jest provides enhanced features for test organization and execution.

#### Basic Test Structure (No Changes Required)

```javascript
// Before (Mocha/Jasmine) and After (Jest) - identical
describe('Calculator', () => {
  it('should add two numbers', () => {
    expect(add(2, 3)).toBe(5);
  });
});
```

#### Nested describe Blocks

```javascript
// Before (Mocha/Jasmine) and After (Jest) - identical
describe('Calculator', () => {
  describe('Addition', () => {
    it('should add positive numbers', () => {
      expect(add(2, 3)).toBe(5);
    });

    it('should add negative numbers', () => {
      expect(add(-2, -3)).toBe(-5);
    });
  });

  describe('Subtraction', () => {
    it('should subtract numbers', () => {
      expect(subtract(5, 3)).toBe(2);
    });
  });
});
```

### Migrating Expectations and Assertions

Jest includes a built-in assertion library that replaces Chai's `expect` syntax. While similar, there are key differences in method names and behavior.

#### Basic Equality Assertions

```javascript
// Chai (Before)
const chai = require('chai');
const expect = chai.expect;

describe('Assertions', () => {
  it('should check equality', () => {
    expect(2 + 2).to.equal(4);
    expect(result).to.not.equal(5);
  });
});

// Jest (After)
describe('Assertions', () => {
  it('should check equality', () => {
    expect(2 + 2).toBe(4);
    expect(result).not.toBe(5);
  });
});
```

#### Type and Existence Checks

```javascript
// Chai (Before)
it('should check types and existence', () => {
  expect(result).to.be.a('string');
  expect(result).to.exist;
  expect(empty).to.be.undefined;
  expect(value).to.be.null;
});

// Jest (After)
it('should check types and existence', () => {
  expect(typeof result).toBe('string');
  expect(result).toBeDefined();
  expect(empty).toBeUndefined();
  expect(value).toBeNull();
});
```

#### Array and Object Assertions

```javascript
// Chai (Before)
it('should check arrays and objects', () => {
  expect([1, 2, 3]).to.include(2);
  expect([1, 2, 3]).to.have.lengthOf(3);
  expect(user).to.have.property('name');
  expect(user).to.have.property('name', 'John');
});

// Jest (After)
it('should check arrays and objects', () => {
  expect([1, 2, 3]).toContain(2);
  expect([1, 2, 3]).toHaveLength(3);
  expect(user).toHaveProperty('name');
  expect(user).toHaveProperty('name', 'John');
});
```

#### Exception Testing

```javascript
// Chai (Before)
it('should throw an error', () => {
  expect(() => divide(10, 0)).to.throw('Division by zero');
});

// Jest (After)
it('should throw an error', () => {
  expect(() => divide(10, 0)).toThrow('Division by zero');
});
```

### Handling Spies and Mocks

Jest provides built-in mocking capabilities that replace Sinon's spy and mock functionality.

#### Function Spies

```javascript
// Sinon (Before)
const sinon = require('sinon');

describe('Spies', () => {
  it('should spy on function calls', () => {
    const spy = sinon.spy(myObject, 'method');
    myObject.method('arg1', 'arg2');

    expect(spy.calledOnce).to.be.true;
    expect(spy.calledWith('arg1', 'arg2')).to.be.true;
    expect(spy.callCount).to.equal(1);

    spy.restore();
  });
});

// Jest (After)
describe('Spies', () => {
  it('should spy on function calls', () => {
    const spy = jest.spyOn(myObject, 'method');
    myObject.method('arg1', 'arg2');

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith('arg1', 'arg2');
    expect(spy).toHaveBeenCalledTimes(1);

    spy.mockRestore();
  });
});
```

#### Mock Functions

```javascript
// Sinon (Before)
it('should mock function return values', () => {
  const mock = sinon.mock(myObject);
  mock.expects('method').once().returns('mocked value');

  const result = myObject.method();
  expect(result).to.equal('mocked value');

  mock.verify();
});

// Jest (After)
it('should mock function return values', () => {
  const mockFn = jest.fn().mockReturnValue('mocked value');
  myObject.method = mockFn;

  const result = myObject.method();
  expect(result).toBe('mocked value');
  expect(mockFn).toHaveBeenCalledTimes(1);
});
```

#### Module Mocking

```javascript
// Sinon (Before)
const sinon = require('sinon');

describe('Module Mocking', () => {
  let axiosStub;

  beforeEach(() => {
    axiosStub = sinon.stub(axios, 'get').resolves({ data: 'mocked' });
  });

  afterEach(() => {
    axiosStub.restore();
  });

  it('should mock axios calls', async () => {
    const result = await axios.get('/api/data');
    expect(result.data).to.equal('mocked');
  });
});

// Jest (After)
describe('Module Mocking', () => {
  beforeEach(() => {
    jest.spyOn(axios, 'get').mockResolvedValue({ data: 'mocked' });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should mock axios calls', async () => {
    const result = await axios.get('/api/data');
    expect(result.data).toBe('mocked');
  });
});
```

### Updating Timeouts

Jest handles timeouts differently from Mocha/Jasmine. Global timeouts are configured in Jest config, while individual test timeouts use `jest.setTimeout()`.

#### Global Timeout Configuration

```javascript
// Mocha/Jasmine (in test file or config)
// this.timeout(5000); // 5 second timeout

// Jest (in jest.config.js or package.json)
module.exports = {
  testTimeout: 5000  // 5 second global timeout
};
```

#### Individual Test Timeouts

```javascript
// Mocha/Jasmine (Before)
describe('Slow Tests', () => {
  it('should handle slow operation', function(done) {
    this.timeout(10000); // 10 second timeout for this test

    setTimeout(() => {
      expect(true).to.be.true;
      done();
    }, 5000);
  });
});

// Jest (After)
describe('Slow Tests', () => {
  it('should handle slow operation', async () => {
    jest.setTimeout(10000); // 10 second timeout for this test

    await new Promise(resolve => setTimeout(resolve, 5000));
    expect(true).toBe(true);
  }, 10000); // Alternative: pass timeout as third parameter
});
```

### beforeEach/afterEach Conversions

Jest's `beforeEach` and `afterEach` work identically to Mocha/Jasmine but with Jest's spy/mock cleanup features.

#### Basic Setup/Teardown

```javascript
// Before (Mocha/Jasmine) and After (Jest) - identical
describe('Database Tests', () => {
  let db;

  beforeEach(async () => {
    db = await createTestDatabase();
  });

  afterEach(async () => {
    await db.cleanup();
  });

  it('should perform database operations', () => {
    // test code
  });
});
```

#### Mock Setup/Cleanup

```javascript
// Mocha/Jasmine (Before)
describe('Mock Tests', () => {
  let mock;

  beforeEach(() => {
    mock = sinon.mock(myModule);
  });

  afterEach(() => {
    mock.restore();
  });

  it('should use mock', () => {
    // test code
  });
});

// Jest (After)
describe('Mock Tests', () => {
  beforeEach(() => {
    jest.spyOn(myModule, 'method');
  });

  afterEach(() => {
    jest.restoreAllMocks(); // Jest's automatic cleanup
  });

  it('should use mock', () => {
    // test code
  });
});
```

### Assertion Library Differences

Jest's built-in assertions provide comprehensive testing capabilities that cover most Chai use cases with a cleaner API.

#### Numeric Comparisons

```javascript
// Chai (Before)
expect(value).to.be.above(5);
expect(value).to.be.at.least(10);
expect(value).to.be.below(100);
expect(value).to.be.at.most(50);

// Jest (After)
expect(value).toBeGreaterThan(5);
expect(value).toBeGreaterThanOrEqual(10);
expect(value).toBeLessThan(100);
expect(value).toBeLessThanOrEqual(50);
```

#### String Matching

```javascript
// Chai (Before)
expect(str).to.match(/pattern/);
expect(str).to.include('substring');
expect(str).to.have.lengthOf(10);

// Jest (After)
expect(str).toMatch(/pattern/);
expect(str).toContain('substring');
expect(str).toHaveLength(10);
```

#### Promise/Async Assertions

```javascript
// Chai with chai-as-promised (Before)
const chaiAsPromised = require('chai-as-promised');

chai.use(chaiAsPromised);

it('should resolve', () => {
  return expect(Promise.resolve('value')).to.eventually.equal('value');
});

// Jest (After) - built-in async/await support
it('should resolve', async () => {
  await expect(Promise.resolve('value')).resolves.toBe('value');
});
```

### Handling Async Tests

Jest has excellent async/await support and provides better error reporting for async operations compared to Mocha/Jasmine.

#### Async/Await Tests

```javascript
// Mocha/Jasmine (Before)
describe('Async Tests', () => {
  it('should handle async operations', function(done) {
    asyncOperation().then(result => {
      expect(result).to.equal('success');
      done();
    }).catch(done);
  });

  it('should handle promises', () => {
    return asyncOperation().then(result => {
      expect(result).to.equal('success');
    });
  });
});

// Jest (After)
describe('Async Tests', () => {
  it('should handle async operations', async () => {
    const result = await asyncOperation();
    expect(result).toBe('success');
  });

  it('should handle promises', () => {
    return expect(asyncOperation()).resolves.toBe('success');
  });
});
```

#### Error Handling in Async Tests

```javascript
// Mocha/Jasmine (Before)
it('should handle async errors', function(done) {
  failingOperation().then(() => {
    done(new Error('Should have failed'));
  }).catch(err => {
    expect(err.message).to.equal('Expected error');
    done();
  });
});

// Jest (After)
it('should handle async errors', async () => {
  await expect(failingOperation()).rejects.toThrow('Expected error');
});
```

#### Testing Async Callbacks

```javascript
// Mocha/Jasmine (Before)
it('should test callbacks', function(done) {
  asyncCallbackFunction((err, result) => {
    if (err) return done(err);
    expect(result).to.equal('data');
    done();
  });
});

// Jest (After)
it('should test callbacks', () => {
  return new Promise((resolve, reject) => {
    asyncCallbackFunction((err, result) => {
      try {
        expect(err).toBeNull();
        expect(result).toBe('data');
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  });
});
```

### Complete Migration Example

Here's a comprehensive before/after example showing all major conversions:

```javascript
// Mocha + Chai + Sinon (Before)
const chai = require('chai');
const expect = chai.expect;
const sinon = require('sinon');

describe('User Service', () => {
  let userService;
  let apiMock;

  beforeEach(function() {
    this.timeout(5000);
    userService = new UserService();
    apiMock = sinon.mock(api);
  });

  afterEach(() => {
    apiMock.restore();
  });

  describe('getUser', () => {
    it('should return user data', function(done) {
      apiMock.expects('get').once().returns(Promise.resolve({ id: 1, name: 'John' }));

      userService.getUser(1).then(user => {
        expect(user).to.have.property('id', 1);
        expect(user).to.have.property('name', 'John');
        expect(user.name).to.be.a('string');
        done();
      }).catch(done);
    });

    it('should handle errors', () => {
      return userService.getUser(999).catch(err => {
        expect(err.message).to.include('User not found');
      });
    });
  });
});

// Jest (After)
describe('User Service', () => {
  let userService;

  beforeEach(() => {
    jest.setTimeout(5000);
    userService = new UserService();
    jest.spyOn(api, 'get').mockResolvedValue({ id: 1, name: 'John' });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('getUser', () => {
    it('should return user data', async () => {
      const user = await userService.getUser(1);

      expect(user).toHaveProperty('id', 1);
      expect(user).toHaveProperty('name', 'John');
      expect(typeof user.name).toBe('string');
    });

    it('should handle errors', async () => {
      jest.spyOn(api, 'get').mockRejectedValue(new Error('User not found'));

      await expect(userService.getUser(999)).rejects.toThrow('User not found');
    });
  });
});
```

### Migration Checklist

- [ ] Replace Chai `expect` with Jest `expect`
- [ ] Update assertion methods (`.equal` → `.toBe`, `.include` → `.toContain`, etc.)
- [ ] Replace Sinon spies with `jest.spyOn`
- [ ] Replace Sinon mocks with `jest.fn()` and `jest.spyOn`
- [ ] Update timeout handling (remove `this.timeout()`, use `jest.setTimeout()` or config)
- [ ] Convert callback-based async tests to async/await
- [ ] Use Jest's built-in mock restoration (`jest.restoreAllMocks()`)
- [ ] Update promise assertions to use Jest's `.resolves` and `.rejects`
- [ ] Verify all assertions work as expected

The test file conversion is now complete. Run your Jest test suite to verify all tests pass with the new syntax and assertions.