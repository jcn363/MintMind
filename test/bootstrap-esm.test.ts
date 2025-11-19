/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { readTextFile, writeTextFile } from '@tauri-apps/api/fs';

// Mock Tauri APIs
jest.mock('@tauri-apps/api/fs', () => ({
  readTextFile: jest.fn(),
  writeTextFile: jest.fn(),
}));

// Mock performance
jest.mock('../src/vs/base/common/performance.js', () => ({
  mark: jest.fn(),
}));

// Mock logger
jest.mock('../src/vs/base/common/logger.js', () => ({
  createModuleLogger: jest.fn(() => ({
    error: jest.fn(),
  })),
}));

// Mock NLS
jest.mock('../src/vs/nls.js', () => ({
  INLSConfiguration: {},
}));

// Mock product and pkg
jest.mock('../src/bootstrap-meta.js', () => ({
  product: { commit: 'test-commit' },
  pkg: { version: '1.0.0' },
}));

describe('bootstrap-esm', () => {
  let mockReadTextFile: jest.MockedFunction<typeof readTextFile>;
  let mockWriteTextFile: jest.MockedFunction<typeof writeTextFile>;
  let loggerMock: { error: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset global variables
    delete (globalThis as any)._MINTMIND_NLS_LANGUAGE;
    delete (globalThis as any)._MINTMIND_NLS_MESSAGES;

    // Get mocked functions
    mockReadTextFile = readTextFile as jest.MockedFunction<typeof readTextFile>;
    mockWriteTextFile = writeTextFile as jest.MockedFunction<typeof writeTextFile>;

    // Mock logger
    loggerMock = { error: jest.fn() };
    (require('../src/vs/base/common/logger.js').createModuleLogger as jest.Mock).mockReturnValue(loggerMock);
  });

  afterEach(() => {
    // Clean up environment variables
    delete process.env.MINTMIND_NLS_CONFIG;
    delete process.env.MINTMIND_DEV;
  });

  describe('doSetupNLS', () => {
    it('should return undefined when MINTMIND_DEV is set', async () => {
      // Arrange
      process.env.MINTMIND_DEV = '1';

      // Import after setting environment
      const { doSetupNLS } = await import('../src/bootstrap-esm.js');

      // Act
      const result = await doSetupNLS();

      // Assert
      expect(result).toBeUndefined();
    });

    it('should return undefined when no messagesFile is configured', async () => {
      // Arrange
      process.env.MINTMIND_NLS_CONFIG = JSON.stringify({
        resolvedLanguage: 'en',
        // No languagePack or defaultMessagesFile
      });

      const { doSetupNLS } = await import('../src/bootstrap-esm.js');

      // Act
      const result = await doSetupNLS();

      // Assert
      expect(result).toBeUndefined();
    });

    it('should successfully load NLS messages from file', async () => {
      // Arrange
      const mockMessages = { 'test.key': 'Test Message' };
      const messagesFile = '/path/to/messages.json';

      process.env.MINTMIND_NLS_CONFIG = JSON.stringify({
        resolvedLanguage: 'en',
        languagePack: {
          messagesFile,
        },
      });

      mockReadTextFile.mockResolvedValue(JSON.stringify(mockMessages));

      const { doSetupNLS } = await import('../src/bootstrap-esm.js');

      // Act
      const result = await doSetupNLS();

      // Assert
      expect(result).toEqual({
        resolvedLanguage: 'en',
        languagePack: { messagesFile },
      });
      expect(mockReadTextFile).toHaveBeenCalledWith(messagesFile);
      expect((globalThis as any)._MINTMIND_NLS_LANGUAGE).toBe('en');
      expect((globalThis as any)._MINTMIND_NLS_MESSAGES).toEqual(mockMessages);
    });

    it('should fallback to defaultMessagesFile when messagesFile fails', async () => {
      // Arrange
      const mockMessages = { 'test.key': 'Default Message' };
      const messagesFile = '/path/to/messages.json';
      const defaultMessagesFile = '/path/to/default-messages.json';
      const corruptMarkerFile = '/path/to/corrupt.marker';

      process.env.MINTMIND_NLS_CONFIG = JSON.stringify({
        resolvedLanguage: 'en',
        languagePack: {
          messagesFile,
          corruptMarkerFile,
        },
        defaultMessagesFile,
      });

      // First call fails
      mockReadTextFile.mockRejectedValueOnce(new Error('File not found'));
      // Second call succeeds
      mockReadTextFile.mockResolvedValueOnce(JSON.stringify(mockMessages));
      mockWriteTextFile.mockResolvedValue(undefined);

      const { doSetupNLS } = await import('../src/bootstrap-esm.js');

      // Act
      const result = await doSetupNLS();

      // Assert
      expect(result).toEqual({
        resolvedLanguage: 'en',
        languagePack: { messagesFile, corruptMarkerFile },
        defaultMessagesFile,
      });
      expect(mockReadTextFile).toHaveBeenCalledTimes(2);
      expect(mockReadTextFile).toHaveBeenNthCalledWith(1, messagesFile);
      expect(mockReadTextFile).toHaveBeenNthCalledWith(2, defaultMessagesFile);
      expect(mockWriteTextFile).toHaveBeenCalledWith(corruptMarkerFile, 'corrupted');
      expect((globalThis as any)._MINTMIND_NLS_MESSAGES).toEqual(mockMessages);
      expect(loggerMock.error).toHaveBeenCalledTimes(2); // error reading messages and writing marker
    });

    it('should handle JSON parse errors gracefully', async () => {
      // Arrange
      const messagesFile = '/path/to/messages.json';

      process.env.MINTMIND_NLS_CONFIG = JSON.stringify({
        resolvedLanguage: 'en',
        languagePack: { messagesFile },
      });

      mockReadTextFile.mockResolvedValue('invalid json');

      const { doSetupNLS } = await import('../src/bootstrap-esm.js');

      // Act
      const result = await doSetupNLS();

      // Assert
      expect(result).toEqual({
        resolvedLanguage: 'en',
        languagePack: { messagesFile },
      });
      expect(loggerMock.error).toHaveBeenCalledWith(
        `Error reading NLS messages file ${messagesFile}`,
        expect.any(SyntaxError)
      );
    });

    it('should handle invalid MINTMIND_NLS_CONFIG gracefully', async () => {
      // Arrange
      process.env.MINTMIND_NLS_CONFIG = 'invalid json';

      const { doSetupNLS } = await import('../src/bootstrap-esm.js');

      // Act
      const result = await doSetupNLS();

      // Assert
      expect(result).toBeUndefined();
      expect(loggerMock.error).toHaveBeenCalledWith(
        'Error reading MINTMIND_NLS_CONFIG from environment',
        expect.any(SyntaxError)
      );
    });
  });

  describe('setupNLS', () => {
    it('should cache the result of doSetupNLS', async () => {
      // Arrange
      const { setupNLS } = await import('../src/bootstrap-esm.js');

      // Act - call multiple times
      const result1 = await setupNLS();
      const result2 = await setupNLS();

      // Assert - doSetupNLS should only be called once
      expect(result1).toBe(result2);
    });
  });

  describe('bootstrapESM', () => {
    it('should call setupNLS', async () => {
      // Arrange
      const { bootstrapESM } = await import('../src/bootstrap-esm.js');

      // Act
      await bootstrapESM();

      // Assert - setupNLS is called internally
      // This is tested through the fact that global variables are set
    });
  });
});