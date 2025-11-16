# Testing Guide

This guide provides comprehensive information about testing in the MintMind project, including how to run tests, write new tests, and follow best practices.

## Table of Contents

- [Test Types](#test-types)
- [Running Tests](#running-tests)
- [Writing Tests](#writing-tests)
- [Test Utilities](#test-utilities)
- [Testing Best Practices](#testing-best-practices)
- [Debugging Tests](#debugging-tests)
- [Continuous Integration](#continuous-integration)
- [Code Coverage](#code-coverage)
- [Performance Testing](#performance-testing)

## Test Types

MintMind includes several types of tests:

1. **Unit Tests**: Test individual functions and components in isolation
2. **Integration Tests**: Test interactions between components
3. **End-to-End (E2E) Tests**: Test complete user flows
4. **Performance Tests**: Measure and track performance metrics
5. **Visual Regression Tests**: Ensure UI consistency

## Running Tests

### Running All Tests

```bash
# Run all tests
bun test
```

### Running Specific Test Types

```bash
# Run unit tests
bun test:unit

# Run integration tests
bun test:integration

# Run E2E tests
bun test:e2e

# Run performance tests
bun test:perf
```

### Running Individual Test Files

```bash
# Run a specific test file
bun test test/unit/example.test.ts

# Run tests matching a pattern
bun test --testNamePattern="should handle errors"
```

### Test Watch Mode

```bash
# Run tests in watch mode
bun test --watch
```

## Writing Tests

### Test File Structure

Test files should be placed in the `test` directory, organized by test type:

```
test/
  unit/           # Unit tests
  integration/    # Integration tests
  e2e/            # End-to-end tests
  perf/           # Performance tests
  fixtures/       # Test fixtures
  utils/          # Test utilities
```

### Basic Test Example

```typescript
import { describe, it, expect } from "bun:test";
import { sum } from "../../src/utils/math";

describe("Math Utils", () => {
	describe("sum", () => {
		it("should add two numbers correctly", () => {
			expect(sum(1, 2)).toBe(3);
		});

		it("should handle negative numbers", () => {
			expect(sum(-1, -2)).toBe(-3);
		});
	});
});
```

### Testing Async Code

```typescript
describe("Async Operations", () => {
	it("should fetch data", async () => {
		const data = await fetchData();
		expect(data).toBeDefined();
	});

	it("should handle errors", async () => {
		await expect(failingOperation()).rejects.toThrow("Error message");
	});
});
```

## Test Utilities

### Test Fixtures

Create reusable test fixtures in the `test/fixtures` directory:

```typescript
// test/fixtures/test-document.ts
export function createTestDocument(content: string): vscode.TextDocument {
	return {
		uri: vscode.Uri.parse("untitled:test.js"),
		getText: () => content,
		// ... other required methods
	};
}
```

### Custom Matchers

Extend Jest's expect with custom matchers:

```typescript
// test/setup.ts
expect.extend({
	toBeWithinRange(received: number, floor: number, ceiling: number) {
		const pass = received >= floor && received <= ceiling;
		return {
			message: () =>
				`expected ${received} ${
					pass ? "not " : ""
				}to be within range ${floor} - ${ceiling}`,
			pass,
		};
	},
});

// Declare the type for TypeScript
declare global {
	namespace jest {
		interface Matchers<R> {
			toBeWithinRange(floor: number, ceiling: number): R;
		}
	}
}
```

## Testing Best Practices

### Unit Testing

- Test one thing per test case
- Use descriptive test names
- Follow the Arrange-Act-Assert pattern
- Keep tests independent and isolated
- Mock external dependencies

### Integration Testing

- Test the interaction between components
- Use real implementations when possible
- Set up and tear down test data
- Test error conditions and edge cases

### E2E Testing

- Test complete user flows
- Use page object pattern
- Make tests resilient to UI changes
- Run tests in a clean environment

## Debugging Tests

### Debugging in VS Code

1. Set breakpoints in your test files
2. Use the VS Code debugger with the "Debug Tests" configuration
3. Inspect variables and step through code

### Debugging in the Browser

For tests that run in the browser:

1. Add `debugger` statements in your test code
2. Run tests with `--inspect-brk` flag:
   ```bash
   bun test --inspect-brk
   ```
3. Open Chrome DevTools and navigate to `chrome://inspect`
4. Click on the "Open dedicated DevTools for Node" link

## Continuous Integration

Tests are automatically run on every push and pull request using GitHub Actions. The CI pipeline includes:

- Linting
- Type checking
- Unit tests
- Integration tests
- E2E tests
- Code coverage reporting

## Code Coverage

### Generating Coverage Reports

```bash
# Generate coverage report
bun test --coverage

# View coverage in browser
bun run coverage:serve
```

### Coverage Thresholds

Minimum coverage thresholds are set in `package.json`:

```json
{
	"jest": {
		"coverageThreshold": {
			"global": {
				"branches": 80,
				"functions": 85,
				"lines": 90,
				"statements": 90
			}
		}
	}
}
```

## Performance Testing

### Running Performance Tests

```bash
# Run performance tests
bun test:perf

# Generate performance report
bun run perf:report
```

### Writing Performance Tests

```typescript
import { performance } from "node:perf_hooks";

describe("Performance", () => {
	it("should process items efficiently", () => {
		const start = performance.now();

		// Code to measure
		const result = processLargeDataset();

		const end = performance.now();
		const duration = end - start;

		console.log(`Processed in ${duration}ms`);
		expect(duration).toBeLessThan(100); // 100ms threshold
	});
});
```

## Visual Regression Testing

### Running Visual Tests

```bash
# Run visual regression tests
bun test:visual

# Update visual snapshots
bun test:visual --update-snapshot
```

### Writing Visual Tests

```typescript
import { toMatchImageSnapshot } from "jest-image-snapshot";

expect.extend({ toMatchImageSnapshot });

describe("UI Components", () => {
	it("should render the button correctly", async () => {
		const button = render(<Button>Click me</Button>);
		const image = await page.screenshot();
		expect(image).toMatchImageSnapshot();
	});
});
```

## Mocking

### Mocking Modules

```typescript
// Mock an entire module
jest.mock("some-module", () => ({
	someFunction: jest.fn(),
}));

// Mock a single function
import { someFunction } from "some-module";
jest.mock("some-module");

// In your test
(someFunction as jest.Mock).mockReturnValue("mocked value");
```

### Mocking VS Code API

```typescript
// test/mocks/vscode.ts
const vscode = {
	window: {
		showInformationMessage: jest.fn(),
		showErrorMessage: jest.fn(),
	},
	// ... other VS Code APIs
};

export default vscode;
```

## Testing Best Practices

1. **Keep tests focused**: Each test should verify one specific behavior
2. **Use descriptive test names**: Test names should describe the expected behavior
3. **Test edge cases**: Include tests for error conditions and boundary values
4. **Keep tests fast**: Mock expensive operations
5. **Make tests deterministic**: Tests should produce the same results every time
6. **Clean up after tests**: Reset mocks and clean up test data
7. **Test the behavior, not the implementation**: Focus on what the code does, not how it does it
