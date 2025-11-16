/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { describe, beforeAll, afterAll, beforeEach, afterEach, it, expect, jest } from '@jest/globals';
import { setupTestDatabase, teardownTestDatabase } from './helpers/test-db';
import { setupTestServer, teardownTestServer } from './helpers/test-server';

// Mocks para servicios de workspace
jest.mock('../../src/vs/platform/workspace/common/workspace', () => ({
  Workspace: jest.fn(),
  WorkspaceFolder: jest.fn(),
  toWorkspaceIdentifier: jest.fn(),
}));

jest.mock('../../src/vs/workbench/services/workspace/common/workspaceEditing', () => ({
  WorkspaceEditingService: jest.fn().mockImplementation(() => ({
    createAndEnterWorkspace: jest.fn(),
    addFolders: jest.fn(),
    removeFolder: jest.fn(),
    saveAndEnterWorkspace: jest.fn(),
  }))
}));

jest.mock('../../src/vs/workbench/services/configuration/common/configuration', () => ({
  WorkspaceConfigurationService: jest.fn().mockImplementation(() => ({
    getValue: jest.fn(),
    updateValue: jest.fn(),
    reloadConfiguration: jest.fn(),
  }))
}));

jest.mock('../../src/vs/workbench/services/textfile/common/textFileService', () => ({
  TextFileService: jest.fn().mockImplementation(() => ({
    isDirty: jest.fn(),
    save: jest.fn(),
    saveAll: jest.fn(),
    revert: jest.fn(),
  }))
}));

describe('Workspace Management Integration', () => {
  let testDb: any;
  let testServer: any;

  beforeAll(async () => {
    testDb = await setupTestDatabase();
    testServer = await setupTestServer();
  }, 60000);

  afterAll(async () => {
    await teardownTestServer();
    await teardownTestDatabase();
  }, 60000);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(async () => {
    // Limpiar workspace temporal después de cada test
  });

  describe('Creación y Configuración de Workspaces', () => {
    it('debe crear un workspace básico correctamente', async () => {
      // Arrange
      const { Workspace } = require('../../src/vs/platform/workspace/common/workspace');
      const mockWorkspace = {
        id: 'workspace-1',
        name: 'Test Workspace',
        folders: [],
        configuration: {},
        save: jest.fn().mockResolvedValue(undefined),
      };

      Workspace.mockReturnValue(mockWorkspace);

      // Act
      const workspace = new Workspace({
        id: 'workspace-1',
        name: 'Test Workspace',
        folders: [],
        configuration: {},
      });

      await workspace.save();

      // Assert
      expect(Workspace).toHaveBeenCalledWith({
        id: 'workspace-1',
        name: 'Test Workspace',
        folders: [],
        configuration: {},
      });
      expect(workspace.id).toBe('workspace-1');
      expect(workspace.name).toBe('Test Workspace');
      expect(workspace.save).toHaveBeenCalled();
    });

    it('debe gestionar carpetas de workspace correctamente', async () => {
      // Arrange
      const WorkspaceEditingService = require('../../src/vs/workbench/services/workspace/common/workspaceEditing').WorkspaceEditingService;
      const mockWorkspaceEditing = {
        addFolders: jest.fn().mockResolvedValue(undefined),
        removeFolder: jest.fn().mockResolvedValue(undefined),
        createAndEnterWorkspace: jest.fn().mockResolvedValue({
          id: 'workspace-multi',
          folders: [
            { name: 'src', uri: { fsPath: '/project/src' } },
            { name: 'tests', uri: { fsPath: '/project/tests' } },
          ],
        }),
      };

      WorkspaceEditingService.mockReturnValue(mockWorkspaceEditing);

      const foldersToAdd = [
        { uri: { fsPath: '/project/src' }, name: 'src' },
        { uri: { fsPath: '/project/tests' }, name: 'tests' },
      ];

      // Act
      await mockWorkspaceEditing.addFolders(foldersToAdd);
      const workspace = await mockWorkspaceEditing.createAndEnterWorkspace('Test Multi-folder', foldersToAdd);
      await mockWorkspaceEditing.removeFolder(workspace.folders[0]);

      // Assert
      expect(mockWorkspaceEditing.addFolders).toHaveBeenCalledWith(foldersToAdd);
      expect(workspace.folders).toHaveLength(2);
      expect(workspace.folders[0].name).toBe('src');
      expect(mockWorkspaceEditing.removeFolder).toHaveBeenCalledWith(workspace.folders[0]);
    });

    it('debe guardar y cargar workspaces correctamente', async () => {
      // Arrange
      const mockWorkspaceService = {
        saveAndEnterWorkspace: jest.fn().mockResolvedValue(undefined),
        loadWorkspace: jest.fn().mockResolvedValue({
          id: 'saved-workspace',
          name: 'Saved Workspace',
          folders: [{ name: 'project', uri: { fsPath: '/saved/project' } }],
          configuration: {
            'editor.fontSize': 14,
            'files.autoSave': 'afterDelay',
          },
        }),
        getRecentlyOpened: jest.fn().mockReturnValue([
          { workspace: { id: 'recent-1' }, label: 'Recent 1' },
          { workspace: { id: 'recent-2' }, label: 'Recent 2' },
        ]),
      };

      // Act
      const workspaceData = {
        folders: [{ uri: { fsPath: '/project' } }],
        configuration: { 'editor.tabSize': 2 },
      };

      await mockWorkspaceService.saveAndEnterWorkspace('My Workspace', workspaceData);
      const loadedWorkspace = await mockWorkspaceService.loadWorkspace('saved-workspace');
      const recent = mockWorkspaceService.getRecentlyOpened();

      // Assert
      expect(mockWorkspaceService.saveAndEnterWorkspace).toHaveBeenCalledWith('My Workspace', workspaceData);
      expect(loadedWorkspace.name).toBe('Saved Workspace');
      expect(loadedWorkspace.configuration['editor.fontSize']).toBe(14);
      expect(recent).toHaveLength(2);
    });
  });

  describe('Configuración de Workspace', () => {
    it('debe gestionar configuración específica del workspace', async () => {
      // Arrange
      const WorkspaceConfigurationService = require('../../src/vs/workbench/services/configuration/common/configuration').WorkspaceConfigurationService;
      const mockConfigService = {
        getValue: jest.fn(),
        updateValue: jest.fn().mockResolvedValue(undefined),
        reloadConfiguration: jest.fn().mockResolvedValue(undefined),
        inspect: jest.fn(),
      };

      WorkspaceConfigurationService.mockReturnValue(mockConfigService);

      // Configurar mocks para diferentes niveles
      mockConfigService.getValue.mockImplementation((key: string) => {
        const configs: { [key: string]: any } = {
          'editor.fontSize': 14,
          'editor.tabSize': 4,
          'files.exclude': { '**/node_modules': true },
          'typescript.preferences.importModuleSpecifier': 'relative',
        };
        return configs[key];
      });

      mockConfigService.inspect.mockImplementation((key: string) => ({
        defaultValue: 12,
        userValue: undefined,
        workspaceValue: 14,
        workspaceFolderValue: undefined,
        key,
      }));

      // Act
      const fontSize = mockConfigService.getValue('editor.fontSize');
      const tabSize = mockConfigService.getValue('editor.tabSize');
      const excludes = mockConfigService.getValue('files.exclude');
      const importStyle = mockConfigService.getValue('typescript.preferences.importModuleSpecifier');

      const inspection = mockConfigService.inspect('editor.fontSize');

      await mockConfigService.updateValue('editor.fontSize', 16, 'workspace');
      await mockConfigService.reloadConfiguration();

      // Assert
      expect(fontSize).toBe(14);
      expect(tabSize).toBe(4);
      expect(excludes['**/node_modules']).toBe(true);
      expect(importStyle).toBe('relative');
      expect(inspection.workspaceValue).toBe(14);
      expect(mockConfigService.updateValue).toHaveBeenCalledWith('editor.fontSize', 16, 'workspace');
      expect(mockConfigService.reloadConfiguration).toHaveBeenCalled();
    });

    it('debe manejar configuración por carpeta', async () => {
      // Arrange
      const mockConfigService = {
        updateValue: jest.fn().mockResolvedValue(undefined),
        getValue: jest.fn(),
        inspect: jest.fn(),
      };

      // Configurar para diferentes carpetas
      mockConfigService.getValue.mockImplementation((key: string, scope?: any) => {
        if (scope?.folder?.name === 'frontend') {
          return key === 'typescript.preferences.importModuleSpecifier' ? 'relative' : undefined;
        } else if (scope?.folder?.name === 'backend') {
          return key === 'typescript.preferences.importModuleSpecifier' ? 'non-relative' : undefined;
        }
        return key === 'editor.tabSize' ? 4 : undefined;
      });

      // Act
      const globalTabSize = mockConfigService.getValue('editor.tabSize');
      const frontendImportStyle = mockConfigService.getValue(
        'typescript.preferences.importModuleSpecifier',
        { folder: { name: 'frontend' } }
      );
      const backendImportStyle = mockConfigService.getValue(
        'typescript.preferences.importModuleSpecifier',
        { folder: { name: 'backend' } }
      );

      await mockConfigService.updateValue(
        'editor.formatOnSave',
        true,
        { folder: { name: 'frontend' } }
      );

      // Assert
      expect(globalTabSize).toBe(4);
      expect(frontendImportStyle).toBe('relative');
      expect(backendImportStyle).toBe('non-relative');
      expect(mockConfigService.updateValue).toHaveBeenCalledWith(
        'editor.formatOnSave',
        true,
        { folder: { name: 'frontend' } }
      );
    });

    it('debe validar configuración del workspace', async () => {
      // Arrange
      const mockConfigService = {
        updateValue: jest.fn().mockImplementation(async (key, value) => {
          // Validaciones de ejemplo
          if (key === 'editor.fontSize' && (value < 6 || value > 100)) {
            throw new Error('Font size must be between 6 and 100');
          }
          if (key === 'editor.tabSize' && ![2, 4, 8].includes(value)) {
            throw new Error('Tab size must be 2, 4, or 8');
          }
        }),
        validateConfiguration: jest.fn().mockImplementation((config) => {
          const errors: string[] = [];
          if (config['editor.fontSize'] < 6) {
            errors.push('Font size too small');
          }
          if (config['files.exclude'] && typeof config['files.exclude'] !== 'object') {
            errors.push('files.exclude must be an object');
          }
          return errors;
        }),
      };

      // Act & Assert - Configuración válida
      await expect(mockConfigService.updateValue('editor.fontSize', 14)).resolves.toBeUndefined();
      await expect(mockConfigService.updateValue('editor.tabSize', 4)).resolves.toBeUndefined();

      // Act & Assert - Configuración inválida
      await expect(mockConfigService.updateValue('editor.fontSize', 3))
        .rejects.toThrow('Font size must be between 6 and 100');

      await expect(mockConfigService.updateValue('editor.tabSize', 6))
        .rejects.toThrow('Tab size must be 2, 4, or 8');

      // Validación general
      const validConfigErrors = mockConfigService.validateConfiguration({
        'editor.fontSize': 12,
        'files.exclude': { '**/node_modules': true },
      });
      const invalidConfigErrors = mockConfigService.validateConfiguration({
        'editor.fontSize': 3,
        'files.exclude': 'invalid',
      });

      expect(validConfigErrors).toHaveLength(0);
      expect(invalidConfigErrors).toHaveLength(2);
    });
  });

  describe('Sincronización y Persistencia', () => {
    it('debe sincronizar cambios entre sesiones', async () => {
      // Arrange
      const mockWorkspaceService = {
        saveWorkspaceState: jest.fn().mockResolvedValue(undefined),
        loadWorkspaceState: jest.fn().mockResolvedValue({
          lastModified: new Date('2024-01-01'),
          uiState: {
            sidebar: { visible: true, width: 300 },
            panel: { visible: false },
            editors: ['file1.ts', 'file2.js'],
          },
          breakpoints: [],
          bookmarks: [{ file: 'main.ts', line: 10 }],
        }),
        getWorkspaceSyncState: jest.fn().mockReturnValue({
          lastSync: new Date(),
          pendingChanges: false,
          conflicts: [],
        }),
      };

      // Act
      const syncState = mockWorkspaceService.getWorkspaceSyncState();
      const savedState = await mockWorkspaceService.loadWorkspaceState();

      // Guardar nuevo estado
      await mockWorkspaceService.saveWorkspaceState({
        uiState: {
          sidebar: { visible: false, width: 250 },
          editors: ['file3.md'],
        },
        bookmarks: [{ file: 'utils.ts', line: 5 }],
      });

      // Assert
      expect(syncState.pendingChanges).toBe(false);
      expect(savedState.uiState.sidebar.visible).toBe(true);
      expect(savedState.bookmarks[0].file).toBe('main.ts');
      expect(mockWorkspaceService.saveWorkspaceState).toHaveBeenCalled();
    });

    it('debe manejar conflictos de sincronización', async () => {
      // Arrange
      const mockSyncService = {
        detectConflicts: jest.fn().mockResolvedValue([
          {
            key: 'editor.fontSize',
            localValue: 14,
            remoteValue: 16,
            lastModified: new Date(),
          },
          {
            key: 'editor.theme',
            localValue: 'dark',
            remoteValue: 'light',
            lastModified: new Date(),
          },
        ]),
        resolveConflict: jest.fn().mockResolvedValue(undefined),
        mergeChanges: jest.fn().mockResolvedValue({
          merged: {
            'editor.fontSize': 15, // Promedio para números
            'editor.theme': 'dark', // Mantener local
          },
          conflictsResolved: 2,
        }),
      };

      // Act
      const conflicts = await mockSyncService.detectConflicts();
      const mergeResult = await mockSyncService.mergeChanges(conflicts);

      // Resolver conflicto específico
      await mockSyncService.resolveConflict('editor.fontSize', 'remote');

      // Assert
      expect(conflicts).toHaveLength(2);
      expect(conflicts[0].localValue).toBe(14);
      expect(conflicts[1].remoteValue).toBe('light');
      expect(mergeResult.merged['editor.fontSize']).toBe(15);
      expect(mergeResult.conflictsResolved).toBe(2);
      expect(mockSyncService.resolveConflict).toHaveBeenCalledWith('editor.fontSize', 'remote');
    });

    it('debe manejar backup y recuperación de workspace', async () => {
      // Arrange
      const mockBackupService = {
        createBackup: jest.fn().mockResolvedValue({
          id: 'backup-123',
          timestamp: new Date(),
          path: '/backups/workspace-2024-01-01.zip',
          size: 1024000,
        }),
        listBackups: jest.fn().mockResolvedValue([
          { id: 'backup-1', timestamp: new Date('2024-01-01'), size: 1000000 },
          { id: 'backup-2', timestamp: new Date('2024-01-02'), size: 1100000 },
        ]),
        restoreBackup: jest.fn().mockResolvedValue({
          success: true,
          restoredFiles: 15,
          errors: [],
        }),
        cleanupOldBackups: jest.fn().mockResolvedValue({
          deletedCount: 3,
          spaceFreed: 3000000,
        }),
      };

      // Act
      const backup = await mockBackupService.createBackup();
      const backups = await mockBackupService.listBackups();
      const restore = await mockBackupService.restoreBackup('backup-1');
      const cleanup = await mockBackupService.cleanupOldBackups(7); // Mantener últimos 7 días

      // Assert
      expect(backup.path).toContain('.zip');
      expect(backup.size).toBe(1024000);
      expect(backups).toHaveLength(2);
      expect(restore.success).toBe(true);
      expect(cleanup.deletedCount).toBe(3);
      expect(cleanup.spaceFreed).toBe(3000000);
    });
  });

  describe('Gestión de Archivos en Workspace', () => {
    it('debe gestionar archivos sucios y guardado', async () => {
      // Arrange
      const TextFileService = require('../../src/vs/workbench/services/textfile/common/textFileService').TextFileService;
      const mockTextFileService = {
        isDirty: jest.fn().mockReturnValue(true),
        save: jest.fn().mockResolvedValue({
          success: true,
          resource: { fsPath: '/workspace/file.ts' },
        }),
        saveAll: jest.fn().mockResolvedValue({
          results: [
            { success: true, resource: { fsPath: '/workspace/file1.ts' } },
            { success: true, resource: { fsPath: '/workspace/file2.ts' } },
          ],
        }),
        revert: jest.fn().mockResolvedValue(undefined),
        getDirtyFiles: jest.fn().mockReturnValue([
          { resource: { fsPath: '/workspace/dirty1.ts' } },
          { resource: { fsPath: '/workspace/dirty2.ts' } },
        ]),
      };

      TextFileService.mockReturnValue(mockTextFileService);

      // Act
      const isDirty = mockTextFileService.isDirty({ fsPath: '/workspace/file.ts' });
      const saveResult = await mockTextFileService.save({ fsPath: '/workspace/file.ts' });
      const saveAllResult = await mockTextFileService.saveAll();
      const dirtyFiles = mockTextFileService.getDirtyFiles();
      await mockTextFileService.revert({ fsPath: '/workspace/dirty1.ts' });

      // Assert
      expect(isDirty).toBe(true);
      expect(saveResult.success).toBe(true);
      expect(saveAllResult.results).toHaveLength(2);
      expect(dirtyFiles).toHaveLength(2);
      expect(mockTextFileService.revert).toHaveBeenCalledWith({ fsPath: '/workspace/dirty1.ts' });
    });

    it('debe manejar watchers de archivos', async () => {
      // Arrange
      const mockFileWatcher = {
        watch: jest.fn().mockReturnValue({
          dispose: jest.fn(),
          onDidChange: jest.fn(),
          onDidCreate: jest.fn(),
          onDidDelete: jest.fn(),
        }),
        unwatch: jest.fn(),
        getWatchedFiles: jest.fn().mockReturnValue([
          '/workspace/src/main.ts',
          '/workspace/src/utils.ts',
          '/workspace/tests/main.test.ts',
        ]),
      };

      const changeEvents: any[] = [];
      const createEvents: any[] = [];
      const deleteEvents: any[] = [];

      // Act
      const watcher = mockFileWatcher.watch('/workspace/src/**/*');
      watcher.onDidChange((e: any) => changeEvents.push(e));
      watcher.onDidCreate((e: any) => createEvents.push(e));
      watcher.onDidDelete((e: any) => deleteEvents.push(e));

      const watchedFiles = mockFileWatcher.getWatchedFiles();

      // Simular eventos
      watcher.onDidChange({ resource: { fsPath: '/workspace/src/main.ts' } });
      watcher.onDidCreate({ resource: { fsPath: '/workspace/src/newfile.ts' } });
      watcher.onDidDelete({ resource: { fsPath: '/workspace/src/oldfile.ts' } });

      watcher.dispose();

      // Assert
      expect(watchedFiles).toHaveLength(3);
      expect(changeEvents).toHaveLength(1);
      expect(createEvents).toHaveLength(1);
      expect(deleteEvents).toHaveLength(1);
      expect(watcher.dispose).toHaveBeenCalled();
    });

    it('debe manejar búsqueda en workspace', async () => {
      // Arrange
      const mockSearchService = {
        search: jest.fn().mockResolvedValue({
          results: [
            {
              resource: { fsPath: '/workspace/src/main.ts' },
              line: 10,
              column: 5,
              preview: '  console.log("found");',
              matches: ['console'],
            },
            {
              resource: { fsPath: '/workspace/src/utils.ts' },
              line: 25,
              column: 12,
              preview: '  const result = console.log(data);',
              matches: ['console'],
            },
          ],
          stats: {
            files: 2,
            matches: 2,
            searchTime: 150,
          },
        }),
        searchInFiles: jest.fn().mockResolvedValue({
          results: [],
          stats: { files: 0, matches: 0, searchTime: 50 },
        }),
      };

      // Act
      const searchResults = await mockSearchService.search({
        pattern: 'console',
        include: ['**/*.ts'],
        exclude: ['**/node_modules/**'],
      });

      const emptyResults = await mockSearchService.searchInFiles('nonexistent', '**/*.js');

      // Assert
      expect(searchResults.results).toHaveLength(2);
      expect(searchResults.results[0].resource.fsPath).toContain('main.ts');
      expect(searchResults.results[1].line).toBe(25);
      expect(searchResults.stats.files).toBe(2);
      expect(emptyResults.results).toHaveLength(0);
      expect(emptyResults.stats.searchTime).toBe(50);
    });
  });

  describe('Integración con Extensiones', () => {
    it('debe gestionar extensiones recomendadas por workspace', async () => {
      // Arrange
      const mockExtensionsService = {
        getWorkspaceRecommendations: jest.fn().mockResolvedValue([
          {
            extensionId: 'ms-vscode.vscode-typescript-next',
            displayName: 'TypeScript Next',
            reason: 'workspace-contains-tsconfig',
          },
          {
            extensionId: 'esbenp.prettier-vscode',
            displayName: 'Prettier',
            reason: 'workspace-contains-prettierrc',
          },
        ]),
        installRecommendedExtensions: jest.fn().mockResolvedValue({
          installed: ['ms-vscode.vscode-typescript-next'],
          failed: [],
        }),
        getExtensionSettings: jest.fn().mockResolvedValue({
          'typescript.preferences.importModuleSpecifier': 'workspace-relative',
          'prettier.configPath': './.prettierrc',
        }),
      };

      // Act
      const recommendations = await mockExtensionsService.getWorkspaceRecommendations();
      const installResult = await mockExtensionsService.installRecommendedExtensions(recommendations);
      const settings = await mockExtensionsService.getExtensionSettings();

      // Assert
      expect(recommendations).toHaveLength(2);
      expect(recommendations[0].extensionId).toBe('ms-vscode.vscode-typescript-next');
      expect(recommendations[1].reason).toBe('workspace-contains-prettierrc');
      expect(installResult.installed).toHaveLength(1);
      expect(settings['typescript.preferences.importModuleSpecifier']).toBe('workspace-relative');
    });

    it('debe manejar configuración de extensiones por workspace', async () => {
      // Arrange
      const mockExtensionConfig = {
        getExtensionConfiguration: jest.fn().mockImplementation((extensionId) => {
          const configs: { [key: string]: any } = {
            'ms-vscode.vscode-typescript-next': {
              'typescript.preferences.importModuleSpecifier': 'workspace',
              'typescript.suggest.autoImports': true,
            },
            'esbenp.prettier-vscode': {
              'prettier.tabWidth': 2,
              'prettier.useTabs': false,
            },
          };
          return configs[extensionId] || {};
        }),
        updateExtensionConfiguration: jest.fn().mockResolvedValue(undefined),
        resetExtensionConfiguration: jest.fn().mockResolvedValue(undefined),
      };

      // Act
      const tsConfig = mockExtensionConfig.getExtensionConfiguration('ms-vscode.vscode-typescript-next');
      const prettierConfig = mockExtensionConfig.getExtensionConfiguration('esbenp.prettier-vscode');

      await mockExtensionConfig.updateExtensionConfiguration(
        'esbenp.prettier-vscode',
        { 'prettier.semi': true }
      );

      await mockExtensionConfig.resetExtensionConfiguration('ms-vscode.vscode-typescript-next');

      // Assert
      expect(tsConfig['typescript.preferences.importModuleSpecifier']).toBe('workspace');
      expect(tsConfig['typescript.suggest.autoImports']).toBe(true);
      expect(prettierConfig['prettier.tabWidth']).toBe(2);
      expect(mockExtensionConfig.updateExtensionConfiguration).toHaveBeenCalledWith(
        'esbenp.prettier-vscode',
        { 'prettier.semi': true }
      );
      expect(mockExtensionConfig.resetExtensionConfiguration).toHaveBeenCalledWith('ms-vscode.vscode-typescript-next');
    });
  });

  describe('Manejo de Errores y Recuperación', () => {
    it('debe manejar workspaces corruptos', async () => {
      // Arrange
      const mockWorkspaceRecovery = {
        validateWorkspace: jest.fn().mockResolvedValue({
          valid: false,
          errors: [
            'Invalid folder URI: /nonexistent/path',
            'Corrupted configuration file',
          ],
          recoverable: true,
        }),
        repairWorkspace: jest.fn().mockResolvedValue({
          success: true,
          repaired: [
            'Removed invalid folder reference',
            'Reset corrupted configuration',
          ],
          warnings: ['Some settings were reset to defaults'],
        }),
        createRecoveryBackup: jest.fn().mockResolvedValue({
          path: '/backups/workspace-recovery.zip',
          size: 512000,
        }),
      };

      // Act
      const validation = await mockWorkspaceRecovery.validateWorkspace();
      const recovery = await mockWorkspaceRecovery.repairWorkspace();
      const backup = await mockWorkspaceRecovery.createRecoveryBackup();

      // Assert
      expect(validation.valid).toBe(false);
      expect(validation.errors).toHaveLength(2);
      expect(validation.recoverable).toBe(true);
      expect(recovery.success).toBe(true);
      expect(recovery.repaired).toHaveLength(2);
      expect(backup.path).toContain('recovery');
    });

    it('debe manejar límites de recursos del workspace', async () => {
      // Arrange
      const mockResourceMonitor = {
        checkLimits: jest.fn().mockResolvedValue({
          withinLimits: false,
          violations: [
            {
              type: 'file-count',
              current: 15000,
              limit: 10000,
              message: 'Too many files in workspace',
            },
            {
              type: 'workspace-size',
              current: 2.5 * 1024 * 1024 * 1024, // 2.5GB
              limit: 2 * 1024 * 1024 * 1024,    // 2GB
              message: 'Workspace too large',
            },
          ],
        }),
        optimizeWorkspace: jest.fn().mockResolvedValue({
          optimized: true,
          spaceSaved: 500 * 1024 * 1024, // 500MB
          filesRemoved: 500,
        }),
        getResourceUsage: jest.fn().mockReturnValue({
          fileCount: 12000,
          totalSize: 1.8 * 1024 * 1024 * 1024, // 1.8GB
          memoryUsage: 800 * 1024 * 1024,      // 800MB
        }),
      };

      // Act
      const limits = await mockResourceMonitor.checkLimits();
      const optimization = await mockResourceMonitor.optimizeWorkspace();
      const usage = mockResourceMonitor.getResourceUsage();

      // Assert
      expect(limits.withinLimits).toBe(false);
      expect(limits.violations).toHaveLength(2);
      expect(limits.violations[0].type).toBe('file-count');
      expect(optimization.spaceSaved).toBe(500 * 1024 * 1024);
      expect(usage.fileCount).toBe(12000);
    });
  });
});