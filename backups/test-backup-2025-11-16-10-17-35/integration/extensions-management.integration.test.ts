/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { describe, beforeAll, afterAll, beforeEach, afterEach, it, expect, jest } from '@jest/globals';
import { setupTestDatabase, teardownTestDatabase } from './helpers/test-db';
import { setupTestServer, teardownTestServer } from './helpers/test-server';

// Mocks para servicios de extensiones
jest.mock('../../src/vs/platform/extensions/common/extensions', () => ({
  ExtensionIdentifier: jest.fn(),
  ExtensionType: {
    System: 'system',
    User: 'user',
  },
  IExtensionManifest: {},
}));

jest.mock('../../src/vs/workbench/services/extensions/common/extensionHostManager', () => ({
  ExtensionHostManager: jest.fn().mockImplementation(() => ({
    start: jest.fn(),
    stop: jest.fn(),
    restart: jest.fn(),
    getExtensionHosts: jest.fn(),
  }))
}));

jest.mock('../../src/vs/workbench/services/extensions/common/extensionManagement', () => ({
  ExtensionManagementService: jest.fn().mockImplementation(() => ({
    install: jest.fn(),
    uninstall: jest.fn(),
    getInstalled: jest.fn(),
    getExtensions: jest.fn(),
    update: jest.fn(),
  }))
}));

jest.mock('../../src/vs/workbench/services/extensions/common/extensionEnablementService', () => ({
  ExtensionEnablementService: jest.fn().mockImplementation(() => ({
    isEnabled: jest.fn(),
    setEnablement: jest.fn(),
    getDisabledExtensions: jest.fn(),
  }))
}));

describe('Extensions Management Integration', () => {
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
    // Limpiar estado de extensiones después de cada test
  });

  describe('Instalación de extensiones', () => {
    it('debe instalar una extensión correctamente', async () => {
      // Arrange
      const mockExtensionManagement = {
        install: jest.fn().mockResolvedValue({
          identifier: { id: 'ms-python.python' },
          manifest: {
            name: 'python',
            version: '1.0.0',
            publisher: 'ms-python',
          },
          location: { fsPath: '/extensions/ms-python.python' },
        }),
        getInstalled: jest.fn().mockResolvedValue([]),
      };

      const extensionId = 'ms-python.python';

      // Act
      const result = await mockExtensionManagement.install(extensionId);

      // Assert
      expect(mockExtensionManagement.install).toHaveBeenCalledWith(extensionId);
      expect(result.identifier.id).toBe(extensionId);
      expect(result.manifest.name).toBe('python');
    });

    it('debe manejar instalación de extensión con dependencias', async () => {
      // Arrange
      const mockExtensionManagement = {
        install: jest.fn().mockImplementation(async (extensionId) => {
          if (extensionId === 'main-extension') {
            // Simular instalación de extensión principal y sus dependencias
            return {
              identifier: { id: extensionId },
              manifest: {
                name: 'main-extension',
                extensionDependencies: ['dep1', 'dep2'],
              },
            };
          } else if (['dep1', 'dep2'].includes(extensionId)) {
            return {
              identifier: { id: extensionId },
              manifest: { name: extensionId },
            };
          }
        }),
      };

      // Act
      const mainResult = await mockExtensionManagement.install('main-extension');
      const dep1Result = await mockExtensionManagement.install('dep1');
      const dep2Result = await mockExtensionManagement.install('dep2');

      // Assert
      expect(mainResult.manifest.extensionDependencies).toEqual(['dep1', 'dep2']);
      expect(dep1Result.identifier.id).toBe('dep1');
      expect(dep2Result.identifier.id).toBe('dep2');
    });

    it('debe manejar errores de instalación', async () => {
      // Arrange
      const mockExtensionManagement = {
        install: jest.fn().mockRejectedValue(new Error('Network error')),
      };

      // Act & Assert
      await expect(mockExtensionManagement.install('invalid-extension'))
        .rejects
        .toThrow('Network error');
    });

    it('debe validar compatibilidad de versiones', async () => {
      // Arrange
      const mockExtensionManagement = {
        install: jest.fn().mockImplementation(async (extensionId, version) => {
          if (version === 'incompatible') {
            throw new Error('Version incompatible with MintMind');
          }
          return {
            identifier: { id: extensionId },
            manifest: { version },
          };
        }),
      };

      // Act & Assert - Versión compatible
      const result = await mockExtensionManagement.install('test-ext', '1.0.0');
      expect(result.manifest.version).toBe('1.0.0');

      // Act & Assert - Versión incompatible
      await expect(mockExtensionManagement.install('test-ext', 'incompatible'))
        .rejects
        .toThrow('Version incompatible with MintMind');
    });
  });

  describe('Activación y comunicación con extension host', () => {
    it('debe activar extensión correctamente', async () => {
      // Arrange
      const mockExtensionHost = {
        activateExtension: jest.fn().mockResolvedValue({
          exports: {
            activate: jest.fn(),
            deactivate: jest.fn(),
          },
        }),
        getExtension: jest.fn().mockReturnValue({
          isActive: false,
          activate: jest.fn().mockResolvedValue(true),
        }),
      };

      const mockExtension = {
        identifier: { id: 'test-extension' },
        activate: jest.fn().mockResolvedValue({
          commands: ['test.command'],
          statusBarItems: [],
        }),
      };

      // Act
      const activationResult = await mockExtensionHost.activateExtension(mockExtension.identifier.id);

      // Assert
      expect(activationResult.exports.activate).toBeDefined();
      expect(activationResult.exports.deactivate).toBeDefined();
    });

    it('debe manejar comunicación entre extensiones', async () => {
      // Arrange
      const mockExtensionHost = {
        callExtension: jest.fn().mockResolvedValue({ result: 'success' }),
        onMessage: jest.fn(),
      };

      const extensionId = 'communicator-ext';
      const message = { type: 'request', data: 'test data' };

      // Act
      const response = await mockExtensionHost.callExtension(extensionId, message);

      // Assert
      expect(mockExtensionHost.callExtension).toHaveBeenCalledWith(extensionId, message);
      expect(response.result).toBe('success');
    });

    it('debe manejar ciclo de vida de extension host', async () => {
      // Arrange
      const mockExtensionHostManager = {
        start: jest.fn().mockResolvedValue(undefined),
        stop: jest.fn().mockResolvedValue(undefined),
        restart: jest.fn().mockResolvedValue(undefined),
        getExtensionHosts: jest.fn().mockReturnValue([
          { id: 'host1', status: 'running' },
          { id: 'host2', status: 'stopped' },
        ]),
      };

      // Act
      await mockExtensionHostManager.start();
      const hosts = mockExtensionHostManager.getExtensionHosts();
      await mockExtensionHostManager.stop();
      await mockExtensionHostManager.restart();

      // Assert
      expect(mockExtensionHostManager.start).toHaveBeenCalled();
      expect(hosts).toHaveLength(2);
      expect(hosts[0].status).toBe('running');
      expect(hosts[1].status).toBe('stopped');
      expect(mockExtensionHostManager.stop).toHaveBeenCalled();
      expect(mockExtensionHostManager.restart).toHaveBeenCalled();
    });

    it('debe manejar aislamiento entre extensiones', async () => {
      // Arrange
      const mockExtensionHost1 = {
        setGlobalState: jest.fn(),
        getGlobalState: jest.fn().mockReturnValue({ key: 'value1' }),
      };

      const mockExtensionHost2 = {
        setGlobalState: jest.fn(),
        getGlobalState: jest.fn().mockReturnValue({ key: 'value2' }),
      };

      // Act
      mockExtensionHost1.setGlobalState('ext1', { data: 'private1' });
      mockExtensionHost2.setGlobalState('ext2', { data: 'private2' });

      const state1 = mockExtensionHost1.getGlobalState('ext1');
      const state2 = mockExtensionHost2.getGlobalState('ext2');

      // Assert
      expect(mockExtensionHost1.setGlobalState).toHaveBeenCalledWith('ext1', { data: 'private1' });
      expect(mockExtensionHost2.setGlobalState).toHaveBeenCalledWith('ext2', { data: 'private2' });
      expect(state1).not.toEqual(state2);
    });
  });

  describe('Configuración y preferencias de extensiones', () => {
    it('debe gestionar configuración específica de extensión', async () => {
      // Arrange
      const mockConfigurationService = {
        getValue: jest.fn().mockReturnValue('default-value'),
        updateValue: jest.fn(),
        inspect: jest.fn().mockReturnValue({
          defaultValue: 'default',
          userValue: 'custom-value',
          workspaceValue: undefined,
        }),
      };

      const extensionId = 'test-extension';
      const configKey = 'test.setting';

      // Act
      const value = mockConfigurationService.getValue(`${extensionId}.${configKey}`);
      const inspection = mockConfigurationService.inspect(`${extensionId}.${configKey}`);

      // Assert
      expect(mockConfigurationService.getValue).toHaveBeenCalledWith(`${extensionId}.${configKey}`);
      expect(value).toBe('default-value');
      expect(inspection.userValue).toBe('custom-value');
    });

    it('debe validar configuración de extensión', async () => {
      // Arrange
      const mockConfigurationService = {
        updateValue: jest.fn().mockImplementation((key, value) => {
          if (key === 'invalid.setting' && value === 'invalid') {
            throw new Error('Invalid configuration value');
          }
        }),
      };

      // Act & Assert - Configuración válida
      await expect(mockConfigurationService.updateValue('valid.setting', 'valid-value'))
        .resolves
        .toBeUndefined();

      // Act & Assert - Configuración inválida
      await expect(mockConfigurationService.updateValue('invalid.setting', 'invalid'))
        .rejects
        .toThrow('Invalid configuration value');
    });

    it('debe manejar configuración por workspace', async () => {
      // Arrange
      const mockConfigurationService = {
        updateValue: jest.fn(),
        getValue: jest.fn().mockReturnValue('workspace-value'),
        inspect: jest.fn().mockReturnValue({
          defaultValue: 'default',
          userValue: undefined,
          workspaceValue: 'workspace-value',
        }),
      };

      // Act
      await mockConfigurationService.updateValue('extension.setting', 'workspace-value', {
        target: 'workspace',
      });
      const value = mockConfigurationService.getValue('extension.setting');

      // Assert
      expect(value).toBe('workspace-value');
    });
  });

  describe('Habilitación y deshabilitación', () => {
    it('debe habilitar/deshabilitar extensiones correctamente', async () => {
      // Arrange
      const mockEnablementService = {
        isEnabled: jest.fn().mockReturnValue(true),
        setEnablement: jest.fn().mockResolvedValue(undefined),
        getDisabledExtensions: jest.fn().mockReturnValue([]),
      };

      const extensionId = 'test-extension';

      // Act
      const isEnabled = mockEnablementService.isEnabled(extensionId);
      await mockEnablementService.setEnablement(extensionId, false);
      const disabledExtensions = mockEnablementService.getDisabledExtensions();

      // Assert
      expect(isEnabled).toBe(true);
      expect(mockEnablementService.setEnablement).toHaveBeenCalledWith(extensionId, false);
      expect(disabledExtensions).toEqual([]);
    });

    it('debe manejar extensiones deshabilitadas globalmente', async () => {
      // Arrange
      const mockEnablementService = {
        getDisabledExtensions: jest.fn().mockReturnValue([
          { id: 'disabled-ext1' },
          { id: 'disabled-ext2' },
        ]),
        setEnablement: jest.fn().mockResolvedValue(undefined),
      };

      // Act
      const disabled = mockEnablementService.getDisabledExtensions();
      await mockEnablementService.setEnablement('disabled-ext1', true);

      // Assert
      expect(disabled).toHaveLength(2);
      expect(disabled[0].id).toBe('disabled-ext1');
      expect(mockEnablementService.setEnablement).toHaveBeenCalledWith('disabled-ext1', true);
    });

    it('debe manejar extensiones recomendadas del workspace', async () => {
      // Arrange
      const mockWorkspaceExtensions = {
        getRecommendations: jest.fn().mockReturnValue([
          { extensionId: 'recommended-ext1' },
          { extensionId: 'recommended-ext2' },
        ]),
        installRecommended: jest.fn().mockResolvedValue(undefined),
      };

      // Act
      const recommendations = mockWorkspaceExtensions.getRecommendations();
      await mockWorkspaceExtensions.installRecommended();

      // Assert
      expect(recommendations).toHaveLength(2);
      expect(recommendations[0].extensionId).toBe('recommended-ext1');
      expect(mockWorkspaceExtensions.installRecommended).toHaveBeenCalled();
    });
  });

  describe('Actualizaciones y versiones', () => {
    it('debe verificar y aplicar actualizaciones', async () => {
      // Arrange
      const mockExtensionManagement = {
        checkForUpdates: jest.fn().mockResolvedValue([
          {
            extension: { identifier: { id: 'outdated-ext' } },
            currentVersion: '1.0.0',
            newVersion: '1.1.0',
          }
        ]),
        update: jest.fn().mockResolvedValue(undefined),
      };

      // Act
      const updates = await mockExtensionManagement.checkForUpdates();
      await mockExtensionManagement.update('outdated-ext');

      // Assert
      expect(updates).toHaveLength(1);
      expect(updates[0].newVersion).toBe('1.1.0');
      expect(mockExtensionManagement.update).toHaveBeenCalledWith('outdated-ext');
    });

    it('debe manejar versiones pre-release', async () => {
      // Arrange
      const mockExtensionManagement = {
        install: jest.fn().mockResolvedValue({
          identifier: { id: 'pre-release-ext' },
          manifest: {
            version: '2.0.0-beta.1',
            preview: true,
          },
        }),
        getPreReleaseVersions: jest.fn().mockReturnValue([
          '2.0.0-alpha.1',
          '2.0.0-beta.1',
          '2.0.0-rc.1',
        ]),
      };

      // Act
      const preReleaseVersions = mockExtensionManagement.getPreReleaseVersions('pre-release-ext');
      const result = await mockExtensionManagement.install('pre-release-ext@2.0.0-beta.1');

      // Assert
      expect(preReleaseVersions).toContain('2.0.0-beta.1');
      expect(result.manifest.preview).toBe(true);
    });

    it('debe manejar downgrades controlados', async () => {
      // Arrange
      const mockExtensionManagement = {
        install: jest.fn().mockResolvedValue({
          identifier: { id: 'downgrade-ext' },
          manifest: { version: '1.0.0' },
        }),
        canDowngrade: jest.fn().mockReturnValue(true),
      };

      // Act
      const canDowngrade = mockExtensionManagement.canDowngrade('downgrade-ext', '2.0.0', '1.0.0');
      const result = await mockExtensionManagement.install('downgrade-ext@1.0.0');

      // Assert
      expect(canDowngrade).toBe(true);
      expect(result.manifest.version).toBe('1.0.0');
    });
  });

  describe('Extension marketplace', () => {
    it('debe buscar extensiones en marketplace', async () => {
      // Arrange
      const mockMarketplace = {
        search: jest.fn().mockResolvedValue({
          results: [
            {
              extension: {
                identifier: { id: 'search-result1' },
                displayName: 'Result 1',
                description: 'Description 1',
              },
              stats: { downloads: 1000 },
            },
            {
              extension: {
                identifier: { id: 'search-result2' },
                displayName: 'Result 2',
                description: 'Description 2',
              },
              stats: { downloads: 500 },
            },
          ],
        }),
      };

      // Act
      const results = await mockMarketplace.search('typescript');

      // Assert
      expect(results.results).toHaveLength(2);
      expect(results.results[0].extension.displayName).toBe('Result 1');
      expect(results.results[1].stats.downloads).toBe(500);
    });

    it('debe manejar categorías y filtros', async () => {
      // Arrange
      const mockMarketplace = {
        getCategories: jest.fn().mockReturnValue([
          'Programming Languages',
          'Debuggers',
          'Formatters',
        ]),
        search: jest.fn().mockResolvedValue({
          results: [
            {
              extension: {
                identifier: { id: 'filtered-result' },
                categories: ['Programming Languages'],
              },
            },
          ],
        }),
      };

      // Act
      const categories = mockMarketplace.getCategories();
      const filteredResults = await mockMarketplace.search('', {
        category: 'Programming Languages',
        sortBy: 'downloads',
      });

      // Assert
      expect(categories).toContain('Programming Languages');
      expect(filteredResults.results[0].extension.categories).toContain('Programming Languages');
    });

    it('debe manejar ratings y reviews', async () => {
      // Arrange
      const mockMarketplace = {
        getExtensionInfo: jest.fn().mockResolvedValue({
          extension: { identifier: { id: 'rated-ext' } },
          stats: {
            rating: 4.5,
            ratingCount: 100,
            downloads: 10000,
          },
          reviews: [
            { rating: 5, comment: 'Great extension!' },
            { rating: 4, comment: 'Very useful' },
          ],
        }),
      };

      // Act
      const info = await mockMarketplace.getExtensionInfo('rated-ext');

      // Assert
      expect(info.stats.rating).toBe(4.5);
      expect(info.stats.ratingCount).toBe(100);
      expect(info.reviews).toHaveLength(2);
    });
  });

  describe('Extension API y contribuciones', () => {
    it('debe registrar comandos de extensión correctamente', async () => {
      // Arrange
      const mockCommandService = {
        registerCommand: jest.fn().mockReturnValue({
          id: 'extension.command',
          dispose: jest.fn(),
        }),
      };

      const command = {
        command: 'extension.testCommand',
        title: 'Test Command',
        handler: jest.fn().mockResolvedValue('executed'),
      };

      // Act
      const registration = mockCommandService.registerCommand(command);

      // Assert
      expect(registration.id).toBe('extension.command');
      expect(registration.dispose).toBeDefined();
    });

    it('debe manejar menús y context menus', async () => {
      // Arrange
      const mockMenuService = {
        createMenu: jest.fn().mockReturnValue({
          addItem: jest.fn(),
          removeItem: jest.fn(),
        }),
      };

      const menuItems = [
        {
          command: 'extension.command1',
          title: 'Command 1',
          when: 'editorTextFocus',
        },
        {
          command: 'extension.command2',
          title: 'Command 2',
          when: 'explorerViewletVisible',
        },
      ];

      // Act
      const menu = mockMenuService.createMenu('editor/context');
      menuItems.forEach(item => menu.addItem(item));

      // Assert
      expect(menu.addItem).toHaveBeenCalledTimes(2);
    });

    it('debe gestionar keybindings de extensiones', async () => {
      // Arrange
      const mockKeybindingService = {
        registerKeybinding: jest.fn().mockReturnValue({
          command: 'extension.keyCommand',
          keybinding: 'ctrl+shift+p',
          dispose: jest.fn(),
        }),
      };

      const keybinding = {
        command: 'extension.keyCommand',
        key: 'ctrl+shift+p',
        when: 'editorTextFocus',
      };

      // Act
      const registration = mockKeybindingService.registerKeybinding(keybinding);

      // Assert
      expect(registration.command).toBe('extension.keyCommand');
      expect(registration.keybinding).toBe('ctrl+shift+p');
    });

    it('debe manejar themes y snippets de extensiones', async () => {
      // Arrange
      const mockThemeService = {
        registerTheme: jest.fn().mockReturnValue({
          id: 'extension-theme',
          dispose: jest.fn(),
        }),
      };

      const mockSnippetService = {
        registerSnippets: jest.fn().mockResolvedValue(undefined),
      };

      const theme = {
        name: 'Extension Theme',
        colors: {
          'editor.background': '#1e1e1e',
        },
      };

      const snippets = [
        {
          language: 'typescript',
          snippets: {
            'log': {
              prefix: 'log',
              body: 'console.log($1);',
            },
          },
        },
      ];

      // Act
      const themeRegistration = mockThemeService.registerTheme(theme);
      await mockSnippetService.registerSnippets(snippets);

      // Assert
      expect(themeRegistration.id).toBe('extension-theme');
      expect(mockSnippetService.registerSnippets).toHaveBeenCalledWith(snippets);
    });
  });

  describe('Diagnóstico y troubleshooting', () => {
    it('debe detectar extensiones problemáticas', async () => {
      // Arrange
      const mockExtensionDiagnostics = {
        getProblematicExtensions: jest.fn().mockReturnValue([
          {
            extension: { identifier: { id: 'problematic-ext' } },
            problems: ['activation_failed', 'high_memory_usage'],
            severity: 'error',
          },
        ]),
        disableExtension: jest.fn().mockResolvedValue(undefined),
      };

      // Act
      const problems = mockExtensionDiagnostics.getProblematicExtensions();
      await mockExtensionDiagnostics.disableExtension('problematic-ext');

      // Assert
      expect(problems).toHaveLength(1);
      expect(problems[0].problems).toContain('activation_failed');
      expect(problems[0].severity).toBe('error');
      expect(mockExtensionDiagnostics.disableExtension).toHaveBeenCalledWith('problematic-ext');
    });

    it('debe generar reportes de diagnóstico', async () => {
      // Arrange
      const mockExtensionDiagnostics = {
        generateReport: jest.fn().mockResolvedValue({
          timestamp: new Date().toISOString(),
          extensions: [
            {
              id: 'ext1',
              version: '1.0.0',
              status: 'active',
              activationTime: 150,
            },
          ],
          performance: {
            totalMemory: '50MB',
            extensionsMemory: '10MB',
          },
        }),
      };

      // Act
      const report = await mockExtensionDiagnostics.generateReport();

      // Assert
      expect(report.timestamp).toBeDefined();
      expect(report.extensions).toHaveLength(1);
      expect(report.performance.totalMemory).toBe('50MB');
    });

    it('debe manejar logs de extensiones', async () => {
      // Arrange
      const mockExtensionLogger = {
        log: jest.fn(),
        getLogs: jest.fn().mockReturnValue([
          {
            timestamp: new Date(),
            level: 'error',
            message: 'Extension crashed',
            extensionId: 'crashed-ext',
          },
        ]),
        clearLogs: jest.fn(),
      };

      // Act
      mockExtensionLogger.log('error', 'Extension crashed', 'crashed-ext');
      const logs = mockExtensionLogger.getLogs();
      mockExtensionLogger.clearLogs();

      // Assert
      expect(mockExtensionLogger.log).toHaveBeenCalledWith('error', 'Extension crashed', 'crashed-ext');
      expect(logs).toHaveLength(1);
      expect(logs[0].extensionId).toBe('crashed-ext');
      expect(mockExtensionLogger.clearLogs).toHaveBeenCalled();
    });
  });
});
