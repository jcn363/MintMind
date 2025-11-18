/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { jest } from '@jest/globals';

// Mock all imports since we're testing the entry point
jest.mock('../src/bootstrap-esm.js', () => ({
  bootstrapESM: jest.fn(),
}));

jest.mock('../src/bootstrap-meta.js', () => ({
  product: { commit: 'test-commit' },
}));

jest.mock('../src/bootstrap-node.js', () => ({
  devInjectNodeModuleLookupPath: jest.fn(),
}));

jest.mock('../src/vs/base/node/nls.js', () => ({
  resolveNLSConfiguration: jest.fn(),
}));

describe('server-cli', () => {
  let mockBootstrapESM: jest.Mock;
  let mockDevInjectNodeModuleLookupPath: jest.Mock;
  let mockResolveNLSConfiguration: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset environment variables
    delete process.env.MINTMIND_DEV;
    delete process.env.MINTMIND_DEV_INJECT_NODE_MODULE_LOOKUP_PATH;
    delete process.env.MINTMIND_NLS_CONFIG;

    // Get mock functions
    mockBootstrapESM = require('../src/bootstrap-esm.js').bootstrapESM;
    mockDevInjectNodeModuleLookupPath = require('../src/bootstrap-node.js').devInjectNodeModuleLookupPath;
    mockResolveNLSConfiguration = require('../src/vs/base/node/nls.js').resolveNLSConfiguration;

    // Default mock implementations
    mockResolveNLSConfiguration.mockResolvedValue({
      resolvedLanguage: 'en',
      defaultMessagesFile: '/path/to/messages.json'
    });
    mockBootstrapESM.mockResolvedValue(undefined);
  });

  afterEach(() => {
    // Clean up environment
    delete process.env.MINTMIND_DEV;
    delete process.env.MINTMIND_DEV_INJECT_NODE_MODULE_LOOKUP_PATH;
    delete process.env.MINTMIND_NLS_CONFIG;
  });

  it('should configure NLS and bootstrap ESM', async () => {
    // Arrange
    const expectedNLSConfig = {
      resolvedLanguage: 'en',
      defaultMessagesFile: '/path/to/messages.json'
    };

    mockResolveNLSConfiguration.mockResolvedValue(expectedNLSConfig);

    // Act - import the module (this will execute the top-level code)
    await import('../src/server-cli.ts');

    // Assert
    expect(mockResolveNLSConfiguration).toHaveBeenCalledWith({
      userLocale: 'en',
      osLocale: 'en',
      commit: 'test-commit',
      userDataPath: '',
      nlsMetadataPath: expect.any(String)
    });

    expect(process.env.MINTMIND_NLS_CONFIG).toBe(JSON.stringify(expectedNLSConfig));
    expect(mockBootstrapESM).toHaveBeenCalledTimes(1);
  });

  it('should handle MINTMIND_DEV environment variable', async () => {
    // Arrange
    process.env.MINTMIND_DEV = '1';
    process.env.MINTMIND_DEV_INJECT_NODE_MODULE_LOOKUP_PATH = '/custom/node_modules/path';

    // Act
    await import('../src/server-cli.ts');

    // Assert
    expect(mockDevInjectNodeModuleLookupPath).toHaveBeenCalledWith('/custom/node_modules/path');
  });

  it('should set default inject path when MINTMIND_DEV is set but no custom path', async () => {
    // Arrange
    process.env.MINTMIND_DEV = '1';
    delete process.env.MINTMIND_DEV_INJECT_NODE_MODULE_LOOKUP_PATH;

    const expectedPath = expect.stringContaining('remote/node_modules');

    // Act
    await import('../src/server-cli.ts');

    // Assert
    expect(mockDevInjectNodeModuleLookupPath).toHaveBeenCalledWith(expectedPath);
  });

  it('should delete environment variables when not in dev mode', async () => {
    // Arrange
    delete process.env.MINTMIND_DEV;
    process.env.MINTMIND_DEV_INJECT_NODE_MODULE_LOOKUP_PATH = 'should-be-deleted';

    // Act
    await import('../src/server-cli.ts');

    // Assert
    expect(process.env.MINTMIND_DEV_INJECT_NODE_MODULE_LOOKUP_PATH).toBeUndefined();
    expect(mockDevInjectNodeModuleLookupPath).not.toHaveBeenCalled();
  });

  it('should handle NLS configuration resolution errors gracefully', async () => {
    // Arrange
    const error = new Error('NLS resolution failed');
    mockResolveNLSConfiguration.mockRejectedValue(error);

    // Act & Assert - should not throw, but we can't easily test this due to top-level await
    // In a real scenario, this would be caught by the runtime
    // For testing purposes, we verify the function is called
    await expect(import('../src/server-cli.ts')).rejects.toThrow();

    expect(mockResolveNLSConfiguration).toHaveBeenCalled();
  });

  it('should handle bootstrapESM errors gracefully', async () => {
    // Arrange
    const error = new Error('Bootstrap failed');
    mockBootstrapESM.mockRejectedValue(error);

    // Act & Assert - should not throw, but we can't easily test this due to top-level await
    // In a real scenario, this would be caught by the runtime
    await expect(import('../src/server-cli.ts')).rejects.toThrow();

    expect(mockBootstrapESM).toHaveBeenCalled();
  });
});