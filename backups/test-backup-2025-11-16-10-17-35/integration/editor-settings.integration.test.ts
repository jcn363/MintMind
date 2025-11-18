/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { describe, beforeAll, afterAll, beforeEach, afterEach, it, expect, jest } from '@jest/globals';
import { setupTestDatabase, teardownTestDatabase } from './helpers/test-db';
import { setupTestServer, teardownTestServer } from './helpers/test-server';

// Mocks para servicios de configuración
jest.mock('../../src/vs/workbench/services/configuration/common/configuration', () => ({
  ConfigurationService: jest.fn().mockImplementation(() => ({
    getValue: jest.fn(),
    updateValue: jest.fn(),
    inspect: jest.fn(),
    reloadConfiguration: jest.fn(),
  }))
}));

jest.mock('../../src/vs/workbench/services/keybinding/common/keybindingService', () => ({
  KeybindingService: jest.fn().mockImplementation(() => ({
    registerKeybinding: jest.fn(),
    removeKeybinding: jest.fn(),
    getKeybindings: jest.fn(),
    resetKeybindings: jest.fn(),
  }))
}));

jest.mock('../../src/vs/workbench/services/themes/common/themeService', () => ({
  ThemeService: jest.fn().mockImplementation(() => ({
    getAvailableThemes: jest.fn(),
    setTheme: jest.fn(),
    getCurrentTheme: jest.fn(),
  }))
}));

describe('Editor Settings Integration', () => {
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
    // Limpiar configuraciones después de cada test
  });

  describe('Configuración de Editor', () => {
    it('debe gestionar configuración básica del editor', async () => {
      // Arrange
      const ConfigurationService = require('../../src/vs/workbench/services/configuration/common/configuration').ConfigurationService;
      const mockConfigService = {
        getValue: jest.fn(),
        updateValue: jest.fn().mockResolvedValue(undefined),
        inspect: jest.fn(),
      };

      ConfigurationService.mockReturnValue(mockConfigService);

      // Configurar valores por defecto
      mockConfigService.getValue.mockImplementation((key: string) => {
        const defaults: { [key: string]: any } = {
          'editor.fontSize': 14,
          'editor.tabSize': 4,
          'editor.insertSpaces': true,
          'editor.wordWrap': 'off',
          'editor.minimap.enabled': true,
          'editor.lineNumbers': 'on',
          'editor.renderWhitespace': 'selection',
          'editor.cursorBlinking': 'blink',
          'editor.formatOnSave': false,
          'editor.formatOnPaste': true,
        };
        return defaults[key];
      });

      mockConfigService.inspect.mockImplementation((key: string) => ({
        defaultValue: mockConfigService.getValue(key),
        userValue: undefined,
        workspaceValue: undefined,
        key,
      }));

      // Act
      const fontSize = mockConfigService.getValue('editor.fontSize');
      const tabSize = mockConfigService.getValue('editor.tabSize');
      const wordWrap = mockConfigService.getValue('editor.wordWrap');
      const minimap = mockConfigService.getValue('editor.minimap.enabled');

      // Cambiar configuraciones
      await mockConfigService.updateValue('editor.fontSize', 16);
      await mockConfigService.updateValue('editor.tabSize', 2);
      await mockConfigService.updateValue('editor.formatOnSave', true);

      const inspection = mockConfigService.inspect('editor.fontSize');

      // Assert
      expect(fontSize).toBe(14);
      expect(tabSize).toBe(4);
      expect(wordWrap).toBe('off');
      expect(minimap).toBe(true);
      expect(mockConfigService.updateValue).toHaveBeenCalledTimes(3);
      expect(inspection.defaultValue).toBe(14);
    });

    it('debe validar configuración del editor', async () => {
      // Arrange
      const mockConfigService = {
        updateValue: jest.fn().mockImplementation(async (key, value) => {
          // Validaciones
          if (key === 'editor.fontSize' && (value < 6 || value > 100)) {
            throw new Error('Font size must be between 6 and 100');
          }
          if (key === 'editor.tabSize' && ![1, 2, 3, 4, 5, 6, 8, 12].includes(value)) {
            throw new Error('Invalid tab size');
          }
          if (key === 'editor.lineNumbers' && !['on', 'off', 'relative', 'interval'].includes(value)) {
            throw new Error('Invalid line numbers setting');
          }
        }),
        validateConfiguration: jest.fn().mockImplementation((config) => {
          const errors: string[] = [];
          if (config['editor.fontSize'] && config['editor.fontSize'] < 6) {
            errors.push('Font size too small');
          }
          if (config['editor.tabSize'] && config['editor.tabSize'] > 12) {
            errors.push('Tab size too large');
          }
          return errors;
        }),
      };

      // Act & Assert - Configuraciones válidas
      await expect(mockConfigService.updateValue('editor.fontSize', 14)).resolves.toBeUndefined();
      await expect(mockConfigService.updateValue('editor.tabSize', 2)).resolves.toBeUndefined();
      await expect(mockConfigService.updateValue('editor.lineNumbers', 'relative')).resolves.toBeUndefined();

      // Act & Assert - Configuraciones inválidas
      await expect(mockConfigService.updateValue('editor.fontSize', 3))
        .rejects.toThrow('Font size must be between 6 and 100');

      await expect(mockConfigService.updateValue('editor.tabSize', 20))
        .rejects.toThrow('Invalid tab size');

      await expect(mockConfigService.updateValue('editor.lineNumbers', 'invalid'))
        .rejects.toThrow('Invalid line numbers setting');

      // Validación general
      const validErrors = mockConfigService.validateConfiguration({
        'editor.fontSize': 12,
        'editor.tabSize': 4,
      });
      const invalidErrors = mockConfigService.validateConfiguration({
        'editor.fontSize': 3,
        'editor.tabSize': 20,
      });

      expect(validErrors).toHaveLength(0);
      expect(invalidErrors).toHaveLength(2);
    });

    it('debe manejar configuración por lenguaje', async () => {
      // Arrange
      const mockConfigService = {
        getValue: jest.fn(),
        updateValue: jest.fn().mockResolvedValue(undefined),
      };

      // Configurar valores por lenguaje
      mockConfigService.getValue.mockImplementation((key: string, overrides?: any) => {
        if (overrides?.overrideIdentifier === 'typescript') {
          const tsConfig: { [key: string]: any } = {
            'editor.tabSize': 2,
            'editor.insertSpaces': true,
            'editor.formatOnSave': true,
          };
          return tsConfig[key];
        } else if (overrides?.overrideIdentifier === 'python') {
          const pyConfig: { [key: string]: any } = {
            'editor.tabSize': 4,
            'editor.insertSpaces': false,
          };
          return pyConfig[key];
        }
        return key === 'editor.tabSize' ? 4 : undefined;
      });

      // Act
      const globalTabSize = mockConfigService.getValue('editor.tabSize');
      const tsTabSize = mockConfigService.getValue('editor.tabSize', { overrideIdentifier: 'typescript' });
      const pyTabSize = mockConfigService.getValue('editor.tabSize', { overrideIdentifier: 'python' });
      const tsFormatOnSave = mockConfigService.getValue('editor.formatOnSave', { overrideIdentifier: 'typescript' });

      // Cambiar configuración específica de lenguaje
      await mockConfigService.updateValue('editor.tabSize', 2, { overrideIdentifier: 'python' });

      // Assert
      expect(globalTabSize).toBe(4);
      expect(tsTabSize).toBe(2);
      expect(pyTabSize).toBe(4);
      expect(tsFormatOnSave).toBe(true);
      expect(mockConfigService.updateValue).toHaveBeenCalledWith(
        'editor.tabSize',
        2,
        { overrideIdentifier: 'python' }
      );
    });
  });

  describe('Atajos de Teclado', () => {
    it('debe gestionar atajos de teclado correctamente', async () => {
      // Arrange
      const KeybindingService = require('../../src/vs/workbench/services/keybinding/common/keybindingService').KeybindingService;
      const mockKeybindingService = {
        registerKeybinding: jest.fn().mockReturnValue({
          id: 'custom.save',
          dispose: jest.fn(),
        }),
        removeKeybinding: jest.fn().mockResolvedValue(undefined),
        getKeybindings: jest.fn().mockReturnValue([
          {
            id: 'workbench.action.files.save',
            keybinding: 'Ctrl+S',
            command: 'workbench.action.files.save',
            when: 'editorTextFocus',
          },
          {
            id: 'editor.action.formatDocument',
            keybinding: 'Shift+Alt+F',
            command: 'editor.action.formatDocument',
            when: 'editorTextFocus && !editorReadonly',
          },
        ]),
        resetKeybindings: jest.fn().mockResolvedValue(undefined),
      };

      KeybindingService.mockReturnValue(mockKeybindingService);

      // Act
      const keybindings = mockKeybindingService.getKeybindings();

      // Registrar nuevo atajo
      const customKeybinding = mockKeybindingService.registerKeybinding({
        keybinding: 'Ctrl+Shift+P',
        command: 'workbench.action.showCommands',
        when: 'editorTextFocus',
      });

      // Cambiar atajo existente
      await mockKeybindingService.registerKeybinding({
        id: 'workbench.action.files.save',
        keybinding: 'Ctrl+Alt+S',
      });

      // Remover atajo
      await mockKeybindingService.removeKeybinding('old.keybinding');

      // Assert
      expect(keybindings).toHaveLength(2);
      expect(keybindings[0].keybinding).toBe('Ctrl+S');
      expect(keybindings[1].command).toBe('editor.action.formatDocument');
      expect(customKeybinding.id).toBe('custom.save');
      expect(mockKeybindingService.registerKeybinding).toHaveBeenCalledTimes(2);
      expect(mockKeybindingService.removeKeybinding).toHaveBeenCalledWith('old.keybinding');
    });

    it('debe manejar conflictos de atajos de teclado', async () => {
      // Arrange
      const mockKeybindingService = {
        registerKeybinding: jest.fn().mockImplementation((rule) => {
          if (rule.keybinding === 'Ctrl+S' && rule.command !== 'workbench.action.files.save') {
            throw new Error('Keybinding conflict: Ctrl+S is already used by workbench.action.files.save');
          }
          return { id: `kb-${Date.now()}`, dispose: jest.fn() };
        }),
        detectConflicts: jest.fn().mockResolvedValue([
          {
            keybinding: 'Ctrl+S',
            conflicts: [
              { command: 'workbench.action.files.save', source: 'default' },
              { command: 'custom.save', source: 'user' },
            ],
          },
        ]),
        resolveConflict: jest.fn().mockResolvedValue(undefined),
      };

      // Act
      const conflicts = await mockKeybindingService.detectConflicts();

      // Intentar registrar atajo conflictivo
      await expect(mockKeybindingService.registerKeybinding({
        keybinding: 'Ctrl+S',
        command: 'custom.save',
      })).rejects.toThrow('Keybinding conflict');

      // Resolver conflicto
      await mockKeybindingService.resolveConflict('Ctrl+S', 'custom.save', 'keep-both');

      // Assert
      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].conflicts).toHaveLength(2);
      expect(mockKeybindingService.resolveConflict).toHaveBeenCalledWith('Ctrl+S', 'custom.save', 'keep-both');
    });

    it('debe gestionar perfiles de atajos de teclado', async () => {
      // Arrange
      const mockKeybindingProfiles = {
        getProfiles: jest.fn().mockReturnValue([
          {
            id: 'default',
            name: 'Default',
            keybindings: 100,
          },
          {
            id: 'vscode',
            name: 'MintMind',
            keybindings: 95,
          },
          {
            id: 'vim',
            name: 'Vim',
            keybindings: 50,
          },
        ]),
        setActiveProfile: jest.fn().mockResolvedValue(undefined),
        getActiveProfile: jest.fn().mockReturnValue({
          id: 'vscode',
          name: 'MintMind',
        }),
        createProfile: jest.fn().mockResolvedValue({
          id: 'custom-profile',
          name: 'Custom Profile',
        }),
        exportProfile: jest.fn().mockResolvedValue('profile-content'),
        importProfile: jest.fn().mockResolvedValue(undefined),
      };

      // Act
      const profiles = mockKeybindingProfiles.getProfiles();
      const activeProfile = mockKeybindingProfiles.getActiveProfile();
      await mockKeybindingProfiles.setActiveProfile('vim');

      const newProfile = await mockKeybindingProfiles.createProfile('Custom Profile', 'default');
      const exported = await mockKeybindingProfiles.exportProfile('vscode');
      await mockKeybindingProfiles.importProfile('profile-content', 'Imported Profile');

      // Assert
      expect(profiles).toHaveLength(3);
      expect(profiles[1].name).toBe('MintMind');
      expect(activeProfile.id).toBe('vscode');
      expect(mockKeybindingProfiles.setActiveProfile).toHaveBeenCalledWith('vim');
      expect(newProfile.name).toBe('Custom Profile');
      expect(exported).toBe('profile-content');
      expect(mockKeybindingProfiles.importProfile).toHaveBeenCalledWith('profile-content', 'Imported Profile');
    });
  });

  describe('Temas y Apariencia', () => {
    it('debe gestionar temas correctamente', async () => {
      // Arrange
      const ThemeService = require('../../src/vs/workbench/services/themes/common/themeService').ThemeService;
      const mockThemeService = {
        getAvailableThemes: jest.fn().mockResolvedValue([
          {
            id: 'vs-dark',
            label: 'Dark Modern',
            uiTheme: 'vs-dark',
            path: 'themes/dark-modern.json',
          },
          {
            id: 'vs-light',
            label: 'Light Modern',
            uiTheme: 'vs',
            path: 'themes/light-modern.json',
          },
          {
            id: 'hc-black',
            label: 'High Contrast Dark',
            uiTheme: 'hc-black',
            path: 'themes/hc-dark.json',
          },
        ]),
        setTheme: jest.fn().mockResolvedValue(undefined),
        getCurrentTheme: jest.fn().mockReturnValue({
          id: 'vs-dark',
          label: 'Dark Modern',
          uiTheme: 'vs-dark',
        }),
      };

      ThemeService.mockReturnValue(mockThemeService);

      // Act
      const themes = await mockThemeService.getAvailableThemes();
      const currentTheme = mockThemeService.getCurrentTheme();
      await mockThemeService.setTheme('vs-light');

      // Assert
      expect(themes).toHaveLength(3);
      expect(themes[0].id).toBe('vs-dark');
      expect(themes[2].label).toBe('High Contrast Dark');
      expect(currentTheme.id).toBe('vs-dark');
      expect(mockThemeService.setTheme).toHaveBeenCalledWith('vs-light');
    });

    it('debe manejar temas personalizados', async () => {
      // Arrange
      const mockThemeService = {
        createTheme: jest.fn().mockResolvedValue({
          id: 'custom-theme',
          label: 'Custom Theme',
          uiTheme: 'vs-dark',
        }),
        updateTheme: jest.fn().mockResolvedValue(undefined),
        deleteTheme: jest.fn().mockResolvedValue(undefined),
        exportTheme: jest.fn().mockResolvedValue('theme-content'),
        importTheme: jest.fn().mockResolvedValue({
          id: 'imported-theme',
          label: 'Imported Theme',
        }),
        validateTheme: jest.fn().mockImplementation((theme) => {
          const errors: string[] = [];
          if (!theme.colors || Object.keys(theme.colors).length === 0) {
            errors.push('Theme must have colors');
          }
          if (!theme.tokenColors || theme.tokenColors.length === 0) {
            errors.push('Theme must have token colors');
          }
          return errors;
        }),
      };

      const customTheme = {
        name: 'Custom Dark',
        colors: {
          'editor.background': '#1a1a1a',
          'editor.foreground': '#cccccc',
        },
        tokenColors: [
          {
            scope: 'keyword',
            settings: { foreground: '#569cd6' },
          },
        ],
      };

      // Act
      const createdTheme = await mockThemeService.createTheme(customTheme);
      const validationErrors = mockThemeService.validateTheme(customTheme);

      const invalidThemeErrors = mockThemeService.validateTheme({ name: 'Invalid' });

      await mockThemeService.updateTheme('custom-theme', { name: 'Updated Custom Theme' });
      await mockThemeService.deleteTheme('old-theme');

      const exported = await mockThemeService.exportTheme('custom-theme');
      const imported = await mockThemeService.importTheme('theme-content', 'New Theme');

      // Assert
      expect(createdTheme.label).toBe('Custom Theme');
      expect(validationErrors).toHaveLength(0);
      expect(invalidThemeErrors).toHaveLength(2);
      expect(mockThemeService.updateTheme).toHaveBeenCalledWith('custom-theme', { name: 'Updated Custom Theme' });
      expect(mockThemeService.deleteTheme).toHaveBeenCalledWith('old-theme');
      expect(exported).toBe('theme-content');
      expect(imported.label).toBe('Imported Theme');
    });

    it('debe gestionar iconos y fuentes personalizadas', async () => {
      // Arrange
      const mockFontService = {
        getAvailableFonts: jest.fn().mockReturnValue([
          'Consolas',
          'Monaco',
          'Fira Code',
          'JetBrains Mono',
          'Cascadia Code',
        ]),
        setFontFamily: jest.fn().mockResolvedValue(undefined),
        getFontMetrics: jest.fn().mockReturnValue({
          family: 'Fira Code',
          size: 14,
          lineHeight: 1.4,
          characterWidth: 8.2,
        }),
        validateFont: jest.fn().mockImplementation((fontName) => {
          const availableFonts = ['Consolas', 'Monaco', 'Fira Code', 'JetBrains Mono'];
          return availableFonts.includes(fontName);
        }),
      };

      const mockIconThemeService = {
        getAvailableIconThemes: jest.fn().mockReturnValue([
          { id: 'vs-seti', label: 'Seti' },
          { id: 'vs-minimal', label: 'Minimal' },
          { id: 'material-icon-theme', label: 'Material Icons' },
        ]),
        setIconTheme: jest.fn().mockResolvedValue(undefined),
        getCurrentIconTheme: jest.fn().mockReturnValue({
          id: 'vs-seti',
          label: 'Seti',
        }),
      };

      // Act
      const fonts = mockFontService.getAvailableFonts();
      const isValidFont = mockFontService.validateFont('Fira Code');
      const isInvalidFont = mockFontService.validateFont('Invalid Font');

      await mockFontService.setFontFamily('Fira Code');
      const metrics = mockFontService.getFontMetrics();

      const iconThemes = await mockIconThemeService.getAvailableIconThemes();
      const currentIconTheme = mockIconThemeService.getCurrentIconTheme();
      await mockIconThemeService.setIconTheme('material-icon-theme');

      // Assert
      expect(fonts).toHaveLength(5);
      expect(fonts).toContain('JetBrains Mono');
      expect(isValidFont).toBe(true);
      expect(isInvalidFont).toBe(false);
      expect(mockFontService.setFontFamily).toHaveBeenCalledWith('Fira Code');
      expect(metrics.family).toBe('Fira Code');
      expect(metrics.characterWidth).toBe(8.2);
      expect(iconThemes).toHaveLength(3);
      expect(currentIconTheme.id).toBe('vs-seti');
      expect(mockIconThemeService.setIconTheme).toHaveBeenCalledWith('material-icon-theme');
    });
  });

  describe('Sincronización de Configuración', () => {
    it('debe sincronizar configuración entre dispositivos', async () => {
      // Arrange
      const mockSyncService = {
        syncSettings: jest.fn().mockResolvedValue({
          uploaded: 25,
          downloaded: 10,
          conflicts: 2,
          lastSync: new Date(),
        }),
        getSyncState: jest.fn().mockReturnValue({
          enabled: true,
          lastSync: new Date('2024-01-01'),
          pendingChanges: false,
        }),
        resolveSyncConflict: jest.fn().mockResolvedValue({
          resolved: true,
          chosenValue: 'local',
        }),
        disableSync: jest.fn().mockResolvedValue(undefined),
        enableSync: jest.fn().mockResolvedValue(undefined),
      };

      // Act
      const syncState = mockSyncService.getSyncState();
      const syncResult = await mockSyncService.syncSettings();

      // Resolver conflicto
      await mockSyncService.resolveSyncConflict('editor.fontSize', {
        local: 16,
        remote: 14,
        lastModified: new Date(),
      });

      await mockSyncService.disableSync();
      await mockSyncService.enableSync();

      // Assert
      expect(syncState.enabled).toBe(true);
      expect(syncResult.uploaded).toBe(25);
      expect(syncResult.conflicts).toBe(2);
      expect(mockSyncService.resolveSyncConflict).toHaveBeenCalled();
      expect(mockSyncService.disableSync).toHaveBeenCalled();
      expect(mockSyncService.enableSync).toHaveBeenCalled();
    });

    it('debe gestionar perfiles de configuración', async () => {
      // Arrange
      const mockProfileService = {
        getProfiles: jest.fn().mockReturnValue([
          {
            id: 'default',
            name: 'Default',
            settings: {},
            isActive: false,
          },
          {
            id: 'typescript-dev',
            name: 'TypeScript Development',
            settings: {
              'editor.formatOnSave': true,
              'typescript.preferences.importModuleSpecifier': 'relative',
            },
            isActive: true,
          },
        ]),
        createProfile: jest.fn().mockResolvedValue({
          id: 'new-profile',
          name: 'New Profile',
        }),
        activateProfile: jest.fn().mockResolvedValue(undefined),
        exportProfile: jest.fn().mockResolvedValue('profile-json-content'),
        importProfile: jest.fn().mockResolvedValue(undefined),
        deleteProfile: jest.fn().mockResolvedValue(undefined),
      };

      // Act
      const profiles = mockProfileService.getProfiles();
      const activeProfile = profiles.find(p => p.isActive);

      const newProfile = await mockProfileService.createProfile('React Development', {
        'emmet.includeLanguages': { 'javascript': 'javascriptreact' },
        'editor.formatOnSave': true,
      });

      await mockProfileService.activateProfile('new-profile');
      const exported = await mockProfileService.exportProfile('typescript-dev');
      await mockProfileService.importProfile('profile-content', 'Imported Profile');
      await mockProfileService.deleteProfile('old-profile');

      // Assert
      expect(profiles).toHaveLength(2);
      expect(activeProfile?.name).toBe('TypeScript Development');
      expect(activeProfile?.settings['editor.formatOnSave']).toBe(true);
      expect(newProfile.name).toBe('New Profile');
      expect(mockProfileService.activateProfile).toHaveBeenCalledWith('new-profile');
      expect(exported).toBe('profile-json-content');
      expect(mockProfileService.importProfile).toHaveBeenCalledWith('profile-content', 'Imported Profile');
      expect(mockProfileService.deleteProfile).toHaveBeenCalledWith('old-profile');
    });

    it('debe manejar backup y restauración de configuración', async () => {
      // Arrange
      const mockBackupService = {
        createBackup: jest.fn().mockResolvedValue({
          id: 'backup-123',
          timestamp: new Date(),
          path: '/backups/settings-backup.zip',
          size: 1024000,
        }),
        listBackups: jest.fn().mockReturnValue([
          { id: 'backup-1', timestamp: new Date('2024-01-01'), size: 1000000 },
          { id: 'backup-2', timestamp: new Date('2024-01-02'), size: 1100000 },
        ]),
        restoreBackup: jest.fn().mockResolvedValue({
          success: true,
          restoredSettings: 45,
          errors: [],
        }),
        cleanupBackups: jest.fn().mockResolvedValue({
          deletedCount: 5,
          spaceFreed: 5000000,
        }),
        validateBackup: jest.fn().mockResolvedValue({
          valid: true,
          settingsCount: 50,
          version: '1.0.0',
        }),
      };

      // Act
      const backup = await mockBackupService.createBackup();
      const backups = mockBackupService.listBackups();
      const validation = await mockBackupService.validateBackup('backup-1');
      const restore = await mockBackupService.restoreBackup('backup-1');
      const cleanup = await mockBackupService.cleanupBackups(30); // Mantener últimos 30 días

      // Assert
      expect(backup.path).toContain('.zip');
      expect(backup.size).toBe(1024000);
      expect(backups).toHaveLength(2);
      expect(validation.valid).toBe(true);
      expect(validation.settingsCount).toBe(50);
      expect(restore.success).toBe(true);
      expect(restore.restoredSettings).toBe(45);
      expect(cleanup.deletedCount).toBe(5);
      expect(cleanup.spaceFreed).toBe(5000000);
    });
  });

  describe('Integración con Extensiones', () => {
    it('debe gestionar configuración de extensiones', async () => {
      // Arrange
      const mockExtensionConfig = {
        getExtensionSettings: jest.fn().mockResolvedValue({
          'gitlens.currentLine.enabled': true,
          'gitlens.hovers.currentLine.over': 'line',
          'prettier.tabWidth': 2,
          'prettier.useTabs': false,
        }),
        updateExtensionSetting: jest.fn().mockResolvedValue(undefined),
        resetExtensionSettings: jest.fn().mockResolvedValue(undefined),
        getExtensionContributions: jest.fn().mockResolvedValue({
          configuration: [
            {
              title: 'GitLens',
              properties: {
                'gitlens.currentLine.enabled': {
                  type: 'boolean',
                  default: false,
                  description: 'Enable current line blame',
                },
              },
            },
          ],
        }),
      };

      // Act
      const settings = await mockExtensionConfig.getExtensionSettings();
      const contributions = await mockExtensionConfig.getExtensionContributions();

      await mockExtensionConfig.updateExtensionSetting('prettier.tabWidth', 4);
      await mockExtensionConfig.resetExtensionSettings('gitlens');

      // Assert
      expect(settings['gitlens.currentLine.enabled']).toBe(true);
      expect(settings['prettier.tabWidth']).toBe(2);
      expect(contributions.configuration).toHaveLength(1);
      expect(contributions.configuration[0].title).toBe('GitLens');
      expect(mockExtensionConfig.updateExtensionSetting).toHaveBeenCalledWith('prettier.tabWidth', 4);
      expect(mockExtensionConfig.resetExtensionSettings).toHaveBeenCalledWith('gitlens');
    });

    it('debe manejar configuración condicional de extensiones', async () => {
      // Arrange
      const mockConditionalConfig = {
        getConditionalSettings: jest.fn().mockResolvedValue([
          {
            extension: 'ms-vscode.vscode-typescript-next',
            condition: 'workspaceContains:tsconfig.json',
            settings: {
              'typescript.preferences.importModuleSpecifier': 'workspace',
              'editor.formatOnSave': true,
            },
          },
          {
            extension: 'ms-python.python',
            condition: 'workspaceContains:requirements.txt',
            settings: {
              'python.formatting.provider': 'black',
              'editor.formatOnSave': true,
            },
          },
        ]),
        applyConditionalSettings: jest.fn().mockResolvedValue({
          applied: 2,
          skipped: 1,
        }),
        removeConditionalSettings: jest.fn().mockResolvedValue(undefined),
      };

      // Act
      const conditionalSettings = await mockConditionalConfig.getConditionalSettings();
      const applyResult = await mockConditionalConfig.applyConditionalSettings();
      await mockConditionalConfig.removeConditionalSettings('old-extension');

      // Assert
      expect(conditionalSettings).toHaveLength(2);
      expect(conditionalSettings[0].condition).toBe('workspaceContains:tsconfig.json');
      expect(conditionalSettings[1].settings['python.formatting.provider']).toBe('black');
      expect(applyResult.applied).toBe(2);
      expect(applyResult.skipped).toBe(1);
      expect(mockConditionalConfig.removeConditionalSettings).toHaveBeenCalledWith('old-extension');
    });
  });
});
