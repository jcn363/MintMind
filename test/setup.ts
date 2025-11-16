/**
 * Jest setup file for MintMind project
 * Configures global test environment and utilities
 */

// Configure Jest globals
beforeAll(() => {
  // Set up any global test configuration
  jest.setTimeout(10000); // 10 second timeout
});

beforeEach(() => {
  // Clear all mocks before each test
  jest.clearAllMocks();
});

afterEach(() => {
  // Clean up after each test
  jest.clearAllTimers();
});

export {};
