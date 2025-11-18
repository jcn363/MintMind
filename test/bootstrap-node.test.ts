/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { jest } from '@jest/globals';
import * as fs from 'node:fs';
import * as path from 'node:path';

// Mock fs
jest.mock('node:fs', () => ({
  existsSync: jest.fn(),
}));

// Mock createRequire
jest.mock('node:module', () => ({
  createRequire: jest.fn(() => ({
    register: jest.fn(),
  })),
}));

// Mock process
const mockProcess = {
  platform: 'linux',
  env: {},
  on: jest.fn(),
  cwd: jest.fn(() => '/test/cwd'),
  chdir: jest.fn(),
  versions: { electron: undefined },
};

Object.defineProperty(global, 'process', {
  value: mockProcess,
  writable: true,
});

describe('bootstrap-node', () => {
  let originalProcess: any;
  let mockFs: jest.Mocked<typeof fs>;
  let mockModule: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset process env
    mockProcess.env = {};
    mockProcess.platform = 'linux';

    // Get mocked modules
    mockFs = fs as jest.Mocked<typeof fs>;
    mockModule = require('node:module');
  });

  afterEach(() => {
    // Clean up
    delete process.env.MINTMIND_DEV;
    delete process.env.MINTMIND_DEV_INJECT_NODE_MODULE_LOOKUP_PATH;
    delete process.env.MINTMIND_PORTABLE;
    delete process.env.MINTMIND_CWD;
  });

  describe('setupCurrentWorkingDirectory', () => {
    it('should set MINTMIND_CWD when not already defined', () => {
      const { setupCurrentWorkingDirectory } = require('../src/bootstrap-node.js');

      mockProcess.cwd.mockReturnValue('/test/cwd');

      setupCurrentWorkingDirectory();

      expect(mockProcess.env.MINTMIND_CWD).toBe('/test/cwd');
    });

    it('should not override existing MINTMIND_CWD', () => {
      const { setupCurrentWorkingDirectory } = require('../src/bootstrap-node.js');

      mockProcess.env.MINTMIND_CWD = 'existing-value';
      mockProcess.cwd.mockReturnValue('/test/cwd');

      setupCurrentWorkingDirectory();

      expect(mockProcess.env.MINTMIND_CWD).toBe('existing-value');
    });

    it('should change directory on Windows', () => {
      const { setupCurrentWorkingDirectory } = require('../src/bootstrap-node.js');

      mockProcess.platform = 'win32';
      mockProcess.execPath = 'C:\\test\\exec.exe';
      mockProcess.cwd.mockReturnValue('/test/cwd');

      setupCurrentWorkingDirectory();

      expect(mockProcess.chdir).toHaveBeenCalledWith('C:\\test');
    });

    it('should handle errors gracefully', () => {
      const { setupCurrentWorkingDirectory } = require('../src/bootstrap-node.js');

      mockProcess.chdir.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      // Should not throw
      expect(() => setupCurrentWorkingDirectory()).not.toThrow();
    });
  });

  describe('devInjectNodeModuleLookupPath', () => {
    it('should return early when not in dev mode', () => {
      const { devInjectNodeModuleLookupPath } = require('../src/bootstrap-node.js');

      devInjectNodeModuleLookupPath('/test/path');

      // Should not call register since not in dev mode
      expect(mockModule.createRequire().register).not.toHaveBeenCalled();
    });

    it('should throw error when injectPath is missing', () => {
      const { devInjectNodeModuleLookupPath } = require('../src/bootstrap-node.js');

      process.env.MINTMIND_DEV = '1';

      expect(() => devInjectNodeModuleLookupPath('')).toThrow('Missing injectPath');
      expect(() => devInjectNodeModuleLookupPath(undefined as any)).toThrow('Missing injectPath');
    });

    it('should register loader hook in dev mode', () => {
      const { devInjectNodeModuleLookupPath } = require('../src/bootstrap-node.js');

      process.env.MINTMIND_DEV = '1';
      const injectPath = '/test/node_modules';

      devInjectNodeModuleLookupPath(injectPath);

      expect(mockModule.createRequire().register).toHaveBeenCalledWith('./bootstrap-import.js', {
        parentURL: expect.any(String),
        data: injectPath
      });
    });
  });

  describe('removeGlobalNodeJsModuleLookupPaths', () => {
    let originalModule: any;

    beforeEach(() => {
      originalModule = {
        globalPaths: ['/usr/lib/node_modules', '/usr/local/lib/node_modules'],
        _resolveLookupPaths: jest.fn(),
        _nodeModulePaths: jest.fn(),
      };

      // Mock the require('module') call
      const mockRequire = jest.fn(() => originalModule);
      jest.doMock('module', () => ({ default: mockRequire, ...mockRequire }), { virtual: true });
    });

    it('should return early for Electron', () => {
      const { removeGlobalNodeJsModuleLookupPaths } = require('../src/bootstrap-node.js');

      mockProcess.versions.electron = '15.0.0';

      removeGlobalNodeJsModuleLookupPaths();

      expect(originalModule._resolveLookupPaths).not.toHaveBeenCalled();
    });

    it('should modify resolve lookup paths on non-Windows', () => {
      const { removeGlobalNodeJsModuleLookupPaths } = require('../src/bootstrap-node.js');

      delete mockProcess.versions.electron;
      mockProcess.platform = 'linux';

      originalModule._resolveLookupPaths.mockReturnValue([
        '/usr/lib/node_modules',
        '/usr/local/lib/node_modules',
        '/home/user/project/node_modules'
      ]);

      removeGlobalNodeJsModuleLookupPaths();

      const modifiedResolveLookupPaths = originalModule._resolveLookupPaths;
      const result = modifiedResolveLookupPaths('test-module', {});

      expect(result).toEqual(['/home/user/project/node_modules']);
    });

    it('should modify node module paths on Windows', () => {
      const { removeGlobalNodeJsModuleLookupPaths } = require('../src/bootstrap-node.js');

      delete mockProcess.versions.electron;
      mockProcess.platform = 'win32';

      originalModule._nodeModulePaths.mockReturnValue([
        'C:\\Users\\user\\node_modules',
        'C:\\Users\\node_modules',
        'C:\\node_modules'
      ]);

      removeGlobalNodeJsModuleLookupPaths();

      const modifiedNodeModulePaths = originalModule._nodeModulePaths;
      const result = modifiedNodeModulePaths('C:\\project');

      // Should filter out drive letters that don't match 'from'
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('configurePortable', () => {
    const mockProduct = {
      applicationName: 'TestApp',
      portable: 'test-portable-data'
    };

    beforeEach(() => {
      jest.clearAllMocks();
      mockFs.existsSync.mockReturnValue(false);
    });

    it('should return non-portable when no portable data exists', () => {
      const { configurePortable } = require('../src/bootstrap-node.js');

      const result = configurePortable(mockProduct);

      expect(result.isPortable).toBe(false);
      expect(result.portableDataPath).toContain('TestApp-portable-data');
      expect(process.env.MINTMIND_PORTABLE).toBeUndefined();
    });

    it('should configure portable mode when data directory exists', () => {
      const { configurePortable } = require('../src/bootstrap-node.js');

      mockFs.existsSync.mockReturnValue(true);
      process.env.MINTMIND_PORTABLE = '/custom/portable/path';

      const result = configurePortable(mockProduct);

      expect(result.isPortable).toBe(true);
      expect(result.portableDataPath).toBe('/custom/portable/path');
      expect(process.env.MINTMIND_PORTABLE).toBe('/custom/portable/path');
    });

    it('should configure temp directory for portable mode on Windows', () => {
      const { configurePortable } = require('../src/bootstrap-node.js');

      mockProcess.platform = 'win32';
      mockFs.existsSync.mockImplementation((path) => path.includes('tmp'));
      process.env.MINTMIND_PORTABLE = 'C:\\portable\\data';

      const result = configurePortable(mockProduct);

      expect(result.isPortable).toBe(true);
      expect(process.env.TMP).toBe('C:\\portable\\data\\tmp');
      expect(process.env.TEMP).toBe('C:\\portable\\data\\tmp');
    });

    it('should configure temp directory for portable mode on Linux/macOS', () => {
      const { configurePortable } = require('../src/bootstrap-node.js');

      mockProcess.platform = 'linux';
      mockFs.existsSync.mockImplementation((path) => path.includes('tmp'));
      process.env.MINTMIND_PORTABLE = '/portable/data';

      const result = configurePortable(mockProduct);

      expect(result.isPortable).toBe(true);
      expect(process.env.TMPDIR).toBe('/portable/data/tmp');
    });

    it('should get correct application path for dev mode', () => {
      const { configurePortable } = require('../src/bootstrap-node.js');

      process.env.MINTMIND_DEV = '1';
      const appRoot = path.dirname(path.dirname(path.dirname(__dirname))); // Simulating src/ directory structure

      // Mock import.meta.dirname
      (global as any).import = { meta: { dirname: appRoot } };

      const result = configurePortable(mockProduct);

      expect(result.portableDataPath).toBe(path.join(appRoot, 'data'));
    });

    it('should get correct application path for macOS', () => {
      const { configurePortable } = require('../src/bootstrap-node.js');

      mockProcess.platform = 'darwin';
      const appRoot = '/Applications/TestApp.app/Contents/Resources';

      // Mock import.meta.dirname
      (global as any).import = { meta: { dirname: appRoot } };

      const result = configurePortable(mockProduct);

      expect(result.portableDataPath).toContain('test-portable-data');
    });
  });
});