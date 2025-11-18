# Tauri Testing Guide

This guide provides comprehensive documentation for testing the MintMind Tauri application, covering the four-tier testing strategy, test execution commands, writing guidelines, and troubleshooting.

## Testing Strategy Overview

MintMind employs a four-tier testing strategy to ensure code quality and reliability across the Rust backend, TypeScript frontend, and integrated Tauri components:

### 1. Rust Unit Tests
- **Scope**: Individual functions, methods, and modules in the Rust codebase
- **Purpose**: Validate core logic, data structures, and utilities
- **Location**: `src-tauri/src/**/*.rs`
- **Coverage Goal**: 70%+

### 2. TypeScript Integration Tests
- **Scope**: Tauri API interactions, IPC commands, and frontend-backend communication
- **Purpose**: Ensure proper integration between TypeScript code and Rust backend
- **Location**: `src/vs/**/*.ts`, `src-tauri/src/**/*.rs` (IPC-related)
- **Coverage Goal**: 80%+

### 3. End-to-End (E2E) Tests
- **Scope**: Complete user workflows through the Tauri application
- **Purpose**: Validate full application behavior in real scenarios
- **Location**: `test/e2e/**/*.spec.ts`
- **Coverage Goal**: Critical user paths

### 4. Performance Tests
- **Scope**: Application startup time, memory usage, IPC latency, and bundle size
- **Purpose**: Monitor performance metrics and detect regressions
- **Location**: `scripts/performance-benchmark.js`
- **Coverage Goal**: Maintain baseline performance metrics

## Running Tests

### Rust Unit Tests
```bash
# Run all Rust tests
cargo test

# Run tests in a specific module
cargo test --lib -- <module_name>

# Run tests with coverage (requires cargo-tarpaulin)
cargo tarpaulin --out Html
```

### TypeScript Integration Tests
```bash
# Run TypeScript integration tests
npm run test:tauri

# Run tests in watch mode during development
npm run test:tauri:watch

# Run tests with coverage
npm run test:tauri:coverage
```

### End-to-End Tests
```bash
# Run all E2E tests
npx playwright test

# Run tests for specific platform
npx playwright test --project=chromium
npx playwright test --project=firefox
npx playwright test --project=webkit

# Run tests in headed mode (visible browser)
npx playwright test --headed

# Generate test report
npx playwright show-report
```

### Performance Tests
```bash
# Run performance benchmarks
node scripts/performance-benchmark.js

# Run specific benchmark suite
node scripts/performance-benchmark.js --suite startup

# Compare against baseline
node scripts/performance-benchmark.js --compare
```

## Writing Tests

### Rust Unit Tests

#### Naming Conventions
- Test functions: `test_<function_name>_<scenario>`
- Module tests: `tests.rs` files in each module directory
- Integration tests: `tests/` directory at crate root

#### Test Structure
```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_function_name_success_case() {
        // Arrange
        let input = "test input";
        let expected = "expected output";

        // Act
        let result = function_name(input);

        // Assert
        assert_eq!(result, expected);
    }

    #[test]
    fn test_function_name_error_case() {
        // Arrange
        let input = "invalid input";

        // Act & Assert
        assert!(function_name(input).is_err());
    }
}
```

#### Mocking Guidelines
- Use `mockall` crate for complex mocking scenarios
- Prefer dependency injection for testable code
- Mock external dependencies (file system, network, etc.)

### TypeScript Integration Tests

#### Naming Conventions
- Test files: `<component>.test.ts`
- IPC tests: `<command>.ipc.test.ts`
- Integration tests: `<feature>.integration.test.ts`

#### Test Structure
```typescript
import { expect, test } from '@jest/globals';
import { invoke } from '@tauri-apps/api/tauri';

describe('Command Integration', () => {
  test('should execute command successfully', async () => {
    // Arrange
    const params = { key: 'value' };

    // Act
    const result = await invoke('command_name', params);

    // Assert
    expect(result).toEqual(expectedResult);
  });

  test('should handle command errors', async () => {
    // Arrange
    const invalidParams = { key: 'invalid' };

    // Act & Assert
    await expect(invoke('command_name', invalidParams)).rejects.toThrow();
  });
});
```

#### Mocking Guidelines
- Use Jest mocks for external dependencies
- Mock Tauri API calls when testing components in isolation
- Prefer integration tests over heavily mocked unit tests

### E2E Tests

#### Naming Conventions
- Test files: `<feature>.spec.ts`
- Page object files: `<page>.page.ts`

#### Test Structure
```typescript
import { test, expect } from '@playwright/test';

test.describe('Feature Name', () => {
  test('should complete user workflow', async ({ page }) => {
    // Arrange
    await page.goto('/');

    // Act
    await page.fill('[data-testid="input"]', 'test data');
    await page.click('[data-testid="submit"]');

    // Assert
    await expect(page.locator('[data-testid="result"]')).toHaveText('expected result');
  });
});
```

### Performance Tests
- Use `performance.now()` for timing measurements
- Run tests multiple times and calculate averages
- Define acceptable performance thresholds
- Monitor memory usage with `process.memoryUsage()`

## Platform-Specific Tests

### Windows-Only Tests
```rust
#[cfg(target_os = "windows")]
mod windows_tests {
    // Windows-specific test logic
}
```

```typescript
// In test file
if (process.platform === 'win32') {
  test('Windows-specific behavior', async () => {
    // Windows-only test logic
  });
}
```

### macOS-Only Tests
```rust
#[cfg(target_os = "macos")]
mod macos_tests {
    // macOS-specific test logic
}
```

### Linux-Only Tests
```rust
#[cfg(target_os = "linux")]
mod linux_tests {
    // Linux-specific test logic
}
```

### Running Platform-Specific Tests
```bash
# Run tests for current platform only
cargo test --lib

# Run tests for specific target
cargo test --target x86_64-pc-windows-gnu
cargo test --target x86_64-apple-darwin
cargo test --target x86_64-unknown-linux-gnu
```

## CI/CD Integration

### GitHub Actions Configuration
Tests are automatically run on:
- Pull requests (all tiers)
- Main branch pushes (all tiers)
- Release builds (extended performance tests)

### Interpreting Results

#### Test Status Badges
- ✅ All tests passing
- ❌ Test failures detected
- ⏳ Tests in progress

#### Coverage Reports
- Rust: Generated via `cargo-tarpaulin`
- TypeScript: Generated via `jest --coverage`
- Combined report available in CI artifacts

#### Performance Alerts
- Threshold violations trigger notifications
- Historical trends tracked in CI dashboards

### Required CI Checks
- Rust unit tests (must pass)
- TypeScript integration tests (must pass)
- E2E tests (must pass on at least one platform)
- Performance regression check (must pass)

## Troubleshooting Common Issues

### PTY Tests in CI
**Issue**: Pseudoterminal tests fail in headless CI environments

**Solutions**:
- Use `expect` library for PTY interaction mocking
- Skip PTY tests in CI with `#[cfg(not(ci))]` attribute
- Configure CI to use virtual displays for GUI components

### Dialog Tests Requiring GUI
**Issue**: File/open dialogs fail in headless environments

**Solutions**:
- Mock dialog APIs in test environments
- Use Playwright's file chooser API for E2E tests
- Configure CI with virtual framebuffers (`xvfb`)

### IPC Latency Issues
**Issue**: Tests fail due to timing-sensitive IPC calls

**Solutions**:
- Increase timeouts for async operations
- Use `waitFor` utilities in Playwright tests
- Implement retry logic for flaky async operations

### Platform-Specific Failures
**Issue**: Tests pass locally but fail on different platforms

**Solutions**:
- Review platform-specific code paths
- Check conditional compilation flags
- Test on multiple platforms during development

### Memory Issues in Tests
**Issue**: Tests consume excessive memory or leak resources

**Solutions**:
- Implement proper cleanup in test teardown
- Use scoped mocks and fixtures
- Monitor memory usage in performance tests

## Coverage Goals

### Rust Code Coverage
- **Target**: 70% overall coverage
- **Critical Paths**: 90%+ coverage for core modules
- **Acceptance Criteria**: No PR merged below 65% coverage

### TypeScript Tauri Integration Coverage
- **Target**: 80% overall coverage
- **IPC Commands**: 95%+ coverage
- **Acceptance Criteria**: No PR merged below 75% coverage

### E2E Coverage
- **Target**: All critical user workflows covered
- **Automation Rate**: 90%+ of manual test cases automated

### Performance Baselines
- Startup time: < 3 seconds
- Memory usage: < 200MB initial heap
- IPC latency: < 10ms average
- Bundle size: < 100MB compressed

## Best Practices

### Test Organization
- Group related tests in describe blocks
- Use clear, descriptive test names
- Follow AAA pattern (Arrange, Act, Assert)

### Test Maintenance
- Keep tests DRY (Don't Repeat Yourself)
- Update tests when refactoring code
- Remove obsolete tests regularly

### Performance Testing
- Run performance tests in isolated environments
- Use statistical analysis for result validation
- Monitor trends over time, not individual runs

### CI Optimization
- Use test parallelization where possible
- Cache dependencies to reduce setup time
- Implement smart test selection (only changed files)

## Resources

- [Rust Testing Book](https://doc.rust-lang.org/book/ch11-00-testing.html)
- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Playwright Documentation](https://playwright.dev/docs/intro)
- [Tauri Testing Guide](https://tauri.app/v1/guides/testing/)
- [Cargo Tarpaulin](https://github.com/xd009642/tarpaulin)