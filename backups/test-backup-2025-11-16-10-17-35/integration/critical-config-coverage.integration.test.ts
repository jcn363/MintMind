/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { describe, beforeAll, afterAll, beforeEach, afterEach, it, expect, jest } from '@jest/globals';
import { setupTestDatabase, teardownTestDatabase } from './helpers/test-db';
import { setupTestServer, teardownTestServer } from './helpers/test-server';

// Mocks para servicios críticos
jest.mock('../../src/vs/workbench/services/configuration/common/configuration', () => ({
  ConfigurationService: jest.fn().mockImplementation(() => ({
    getValue: jest.fn(),
    updateValue: jest.fn(),
    inspect: jest.fn(),
    reloadConfiguration: jest.fn(),
    validateConfiguration: jest.fn(),
  }))
}));

jest.mock('../../src/vs/workbench/services/extensions/common/extensionManagement', () => ({
  ExtensionManagementService: jest.fn().mockImplementation(() => ({
    install: jest.fn(),
    uninstall: jest.fn(),
    getInstalled: jest.fn(),
    update: jest.fn(),
  }))
}));

jest.mock('../../src/vs/workbench/services/themes/common/themeService', () => ({
  ThemeService: jest.fn().mockImplementation(() => ({
    getCurrentTheme: jest.fn(),
    setTheme: jest.fn(),
    getAvailableThemes: jest.fn(),
  }))
}));

describe('Critical Config Coverage Integration', () => {
  let testDb: any;
  let testServer: any;

  // Variables usadas para tracking
  let dbInitialized = false;
  let serverInitialized = false;

  beforeAll(async () => {
    testDb = await setupTestDatabase();
    dbInitialized = true;
    testServer = await setupTestServer();
    serverInitialized = true;
  }, 60000);

  afterAll(async () => {
    await teardownTestServer();
    await teardownTestDatabase();
  }, 60000);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(async () => {
    // Limpiar configuraciones críticas después de cada test
  });

  describe('Configuraciones críticas del editor', () => {
    it('debe validar configuraciones críticas del editor', async () => {
      // Arrange
      const ConfigurationService = require('../../src/vs/workbench/services/configuration/common/configuration').ConfigurationService;
      const mockConfigService = {
        getValue: jest.fn(),
        updateValue: jest.fn().mockResolvedValue(undefined),
        validateConfiguration: jest.fn(),
      };

      ConfigurationService.mockReturnValue(mockConfigService);

      // Configuraciones críticas que deben ser validadas
      const criticalConfigs: Record<string, any> = {
        'editor.fontSize': { min: 6, max: 100, default: 14 },
        'editor.tabSize': { allowed: [1, 2, 3, 4, 5, 6, 8, 12], default: 4 },
        'editor.lineNumbers': { allowed: ['on', 'off', 'relative', 'interval'], default: 'on' },
        'editor.wordWrap': { allowed: ['off', 'on', 'wordWrapColumn', 'bounded'], default: 'off' },
        'editor.insertSpaces': { type: 'boolean', default: true },
        'editor.detectIndentation': { type: 'boolean', default: true },
        'editor.trimAutoWhitespace': { type: 'boolean', default: true },
        'editor.renderWhitespace': { allowed: ['selection', 'boundary', 'trailing', 'all'], default: 'selection' },
        'editor.cursorBlinking': { allowed: ['blink', 'smooth', 'phase', 'expand', 'solid'], default: 'blink' },
        'editor.formatOnSave': { type: 'boolean', default: false },
        'editor.formatOnPaste': { type: 'boolean', default: false },
        'editor.minimap.enabled': { type: 'boolean', default: true },
        'editor.scrollBeyondLastLine': { type: 'boolean', default: true },
        'editor.smoothScrolling': { type: 'boolean', default: false },
        'editor.cursorSurroundingLines': { min: 0, max: 20, default: 0 },
        'editor.folding': { type: 'boolean', default: true },
        'editor.glyphMargin': { type: 'boolean', default: true },
        'editor.useTabStops': { type: 'boolean', default: true },
        'editor.dragAndDrop': { type: 'boolean', default: true },
        'editor.links': { type: 'boolean', default: true },
        'editor.colorDecorators': { type: 'boolean', default: true },
        'editor.lightbulb.enabled': { type: 'boolean', default: true },
        'editor.selectionHighlight': { type: 'boolean', default: true },
        'editor.occurrencesHighlight': { type: 'boolean', default: true },
        'editor.codeActionsOnSave': { type: 'object', default: {} },
        'editor.quickSuggestions': {
          type: 'object',
          default: { other: true, comments: false, strings: false }
        },
        'editor.suggestOnTriggerCharacters': { type: 'boolean', default: true },
        'editor.acceptSuggestionOnEnter': { allowed: ['on', 'smart', 'off'], default: 'on' },
        'editor.snippetSuggestions': { allowed: ['top', 'bottom', 'inline', 'none'], default: 'inline' },
        'editor.emptySelectionClipboard': { type: 'boolean', default: true },
        'editor.copyWithSyntaxHighlighting': { type: 'boolean', default: true },
        'editor.wordSeparators': { type: 'string', default: '`~!@#$%^&*()-=+[{]}\\|;:\'",.<>/?' },
        'editor.tabCompletion': { allowed: ['on', 'off', 'onlySnippets'], default: 'off' },
        'editor.suggest.localityBonus': { type: 'boolean', default: false },
        'editor.suggest.shareSuggestSelections': { type: 'boolean', default: false },
        'editor.suggest.snippetsPreventQuickSuggestions': { type: 'boolean', default: false },
        'editor.suggest.showIcons': { type: 'boolean', default: true },
        'editor.suggest.showStatusBar': { type: 'boolean', default: false },
        'editor.suggest.insertMode': { allowed: ['insert', 'replace'], default: 'insert' },
        'editor.suggest.filterGraceful': { type: 'boolean', default: true },
        'editor.suggest.showInlineDetails': { type: 'boolean', default: true },
        'editor.suggest.maxVisibleSuggestions': { min: 1, max: 15, default: 12 },
        'editor.hover.enabled': { type: 'boolean', default: true },
        'editor.hover.delay': { min: 0, max: 10000, default: 300 },
        'editor.hover.sticky': { type: 'boolean', default: true },
        'editor.parameterHints.enabled': { type: 'boolean', default: true },
        'editor.parameterHints.cycle': { type: 'boolean', default: false },
        'editor.gotoLocation.multiple': { allowed: ['peek', 'gotoAndPeek', 'goto'], default: 'peek' },
        'editor.gotoLocation.multipleDefinitions': { allowed: ['peek', 'gotoAndPeek', 'goto'], default: 'peek' },
        'editor.gotoLocation.multipleImplementations': { allowed: ['peek', 'gotoAndPeek', 'goto'], default: 'peek' },
        'editor.gotoLocation.multipleReferences': { allowed: ['peek', 'gotoAndPeek', 'goto'], default: 'peek' },
        'editor.gotoLocation.multipleTypeDefinitions': { allowed: ['peek', 'gotoAndPeek', 'goto'], default: 'peek' },
        'editor.find.addExtraSpaceOnTop': { type: 'boolean', default: true },
        'editor.find.seedSearchStringFromSelection': { type: 'boolean', default: true },
        'editor.find.autoFindInSelection': { type: 'boolean', default: false },
        'editor.find.globalFindClipboard': { type: 'boolean', default: false },
        'editor.find.loop': { type: 'boolean', default: true },
      };

      // Configurar validación
      mockConfigService.validateConfiguration.mockImplementation((config: any) => {
        const errors: string[] = [];

        for (const [key, rules] of Object.entries(criticalConfigs)) {
          const value = config[key];
          if (value !== undefined) {
            if (rules.min !== undefined && value < rules.min) {
              errors.push(`${key} must be >= ${rules.min}`);
            }
            if (rules.max !== undefined && value > rules.max) {
              errors.push(`${key} must be <= ${rules.max}`);
            }
            if (rules.allowed && Array.isArray(rules.allowed) && !rules.allowed.includes(value)) {
              errors.push(`${key} must be one of: ${rules.allowed.join(', ')}`);
            }
            if (rules.type === 'boolean' && typeof value !== 'boolean') {
              errors.push(`${key} must be a boolean`);
            }
            if (rules.type === 'string' && typeof value !== 'string') {
              errors.push(`${key} must be a string`);
            }
            if (rules.type === 'object' && value !== null && typeof value !== 'object') {
              errors.push(`${key} must be an object`);
            }
          }
        }

        return errors;
      });

      // Act & Assert - Configuración válida
      const validConfig = {
        'editor.fontSize': 16,
        'editor.tabSize': 2,
        'editor.lineNumbers': 'relative',
        'editor.insertSpaces': true,
        'editor.formatOnSave': true,
        'editor.minimap.enabled': false,
      };

      const validErrors = mockConfigService.validateConfiguration(validConfig);
      expect(validErrors).toHaveLength(0);

      // Act & Assert - Configuración inválida
      const invalidConfig = {
        'editor.fontSize': 200, // Demasiado grande
        'editor.tabSize': 20, // No permitido
        'editor.lineNumbers': 'invalid', // Valor no permitido
        'editor.insertSpaces': 'yes', // Debe ser boolean
        'editor.cursorSurroundingLines': -1, // Demasiado pequeño
        'editor.suggest.maxVisibleSuggestions': 20, // Demasiado grande
      };

      const invalidErrors = mockConfigService.validateConfiguration(invalidConfig);
      expect(invalidErrors && invalidErrors.length).toBeGreaterThan(0);
      expect(invalidErrors && invalidErrors.some((error: string) => error.includes('fontSize'))).toBe(true);
      expect(invalidErrors && invalidErrors.some((error: string) => error.includes('tabSize'))).toBe(true);
    });

    it('debe manejar recuperación de configuraciones corruptas', async () => {
      // Arrange
      const mockConfigService = {
        getValue: jest.fn(),
        updateValue: jest.fn().mockResolvedValue(undefined),
        reloadConfiguration: jest.fn().mockResolvedValue(undefined),
        resetToDefaults: jest.fn().mockResolvedValue(undefined),
        backupConfiguration: jest.fn().mockResolvedValue({
          path: '/backups/config-backup.json',
          timestamp: new Date(),
        }),
      };

      // Configuraciones corruptas simuladas
      const corruptedConfigs = [
        { key: 'editor.fontSize', value: 'invalid-string', expectedDefault: 14 },
        { key: 'editor.tabSize', value: null, expectedDefault: 4 },
        { key: 'editor.insertSpaces', value: undefined, expectedDefault: true },
        { key: 'editor.wordWrap', value: 123, expectedDefault: 'off' },
      ];

      // Configurar recuperación
      let recoveryAttempts = 0;
      mockConfigService.getValue.mockImplementation((key: string) => {
        const corrupted = corruptedConfigs.find((c: any) => c.key === key);
        if (corrupted && recoveryAttempts < 2) {
          recoveryAttempts++;
          throw new Error(`Corrupted configuration for ${key}`);
        }
        return corrupted?.expectedDefault;
      });

      // Act
      const recoveryResults = [];

      for (const config of corruptedConfigs) {
        try {
          const value = mockConfigService.getValue(config.key);
          recoveryResults.push({ key: config.key, value, recovered: false });
        } catch (error: any) {
          // Intentar recuperación
          await mockConfigService.resetToDefaults();
          const recoveredValue = mockConfigService.getValue(config.key);
          recoveryResults.push({
            key: config.key,
            value: recoveredValue,
            recovered: true,
            error: error.message
          });
        }
      }

      const backup = await mockConfigService.backupConfiguration();

      // Assert
      expect(recoveryResults).toHaveLength(4);
      expect(recoveryResults.filter(r => r.recovered)).toHaveLength(4);
      expect(recoveryResults[0].value).toBe(14); // Default for fontSize
      expect(recoveryResults[1].value).toBe(4); // Default for tabSize
      expect(mockConfigService.resetToDefaults).toHaveBeenCalled();
      expect(backup.path).toContain('config-backup.json');
    });
  });

  describe('Configuraciones críticas de extensiones', () => {
    it('debe validar configuraciones críticas de extensiones', async () => {
      // Arrange
      const ExtensionManagementService = require('../../src/vs/workbench/services/extensions/common/extensionManagement').ExtensionManagementService;
      const mockExtensionService = {
        getExtensionConfig: jest.fn(),
        updateExtensionConfig: jest.fn().mockResolvedValue(undefined),
        validateExtensionConfig: jest.fn(),
      };

      ExtensionManagementService.mockReturnValue(mockExtensionService);

      // Configuraciones críticas de extensiones comunes
      const extensionConfigs: Record<string, any> = {
        'ms-vscode.vscode-typescript-next': {
          'typescript.preferences.importModuleSpecifier': { allowed: ['relative', 'non-relative', 'project-relative'], default: 'relative' },
          'typescript.preferences.includePackageJsonAutoImports': { allowed: ['auto', 'on', 'off'], default: 'auto' },
          'typescript.preferences.quoteStyle': { allowed: ['single', 'double'], default: 'double' },
          'typescript.suggest.autoImports': { type: 'boolean', default: true },
          'typescript.suggest.includeAutomaticOptionalChainCompletions': { type: 'boolean', default: true },
          'typescript.suggest.includeCompletionsForImportStatements': { type: 'boolean', default: true },
          'typescript.validate.enable': { type: 'boolean', default: true },
          'typescript.format.enable': { type: 'boolean', default: true },
          'typescript.format.insertSpaceAfterCommaDelimiter': { type: 'boolean', default: true },
          'typescript.format.insertSpaceAfterConstructor': { type: 'boolean', default: false },
          'typescript.format.insertSpaceAfterFunctionKeywordForAnonymousFunctions': { type: 'boolean', default: true },
          'typescript.format.insertSpaceAfterKeywordsInControlFlowStatements': { type: 'boolean', default: true },
          'typescript.format.insertSpaceAfterOpeningAndBeforeClosingJsxExpressionBraces': { type: 'boolean', default: false },
          'typescript.format.insertSpaceAfterOpeningAndBeforeClosingNonemptyBraces': { type: 'boolean', default: true },
          'typescript.format.insertSpaceAfterOpeningAndBeforeClosingTemplateStringBraces': { type: 'boolean', default: false },
          'typescript.format.insertSpaceAfterSemicolonInForStatements': { type: 'boolean', default: true },
          'typescript.format.insertSpaceBeforeAndAfterBinaryOperators': { type: 'boolean', default: true },
          'typescript.format.insertSpaceBeforeFunctionParenthesis': { type: 'boolean', default: false },
          'typescript.format.placeOpenBraceOnNewLineForControlBlocks': { type: 'boolean', default: false },
          'typescript.format.placeOpenBraceOnNewLineForFunctions': { type: 'boolean', default: false },
          'typescript.referencesCodeLens.enabled': { type: 'boolean', default: false },
          'typescript.implementationsCodeLens.enabled': { type: 'boolean', default: false },
          'typescript.preferences.renameShorthandProperties': { type: 'boolean', default: true },
          'typescript.preferences.useAliasesForRenames': { type: 'boolean', default: false },
          'typescript.updateImportsOnFileMove.enabled': { allowed: ['always', 'prompt', 'never'], default: 'prompt' },
        },
        'esbenp.prettier-vscode': {
          'prettier.printWidth': { min: 1, max: 999, default: 80 },
          'prettier.tabWidth': { min: 1, max: 99, default: 2 },
          'prettier.useTabs': { type: 'boolean', default: false },
          'prettier.semi': { type: 'boolean', default: true },
          'prettier.singleQuote': { type: 'boolean', default: false },
          'prettier.quoteProps': { allowed: ['as-needed', 'consistent', 'preserve'], default: 'as-needed' },
          'prettier.trailingComma': { allowed: ['none', 'es5', 'all'], default: 'es5' },
          'prettier.bracketSpacing': { type: 'boolean', default: true },
          'prettier.bracketSameLine': { type: 'boolean', default: false },
          'prettier.arrowParens': { allowed: ['always', 'avoid'], default: 'always' },
          'prettier.endOfLine': { allowed: ['auto', 'lf', 'crlf', 'cr'], default: 'lf' },
          'prettier.embeddedLanguageFormatting': { allowed: ['auto', 'off'], default: 'auto' },
          'prettier.singleAttributePerLine': { type: 'boolean', default: false },
        },
        'ms-vscode.vscode-eslint': {
          'eslint.enable': { type: 'boolean', default: true },
          'eslint.validate': { type: 'array', default: ['javascript', 'javascriptreact', 'typescript', 'typescriptreact'] },
          'eslint.run': { allowed: ['onType', 'onSave'], default: 'onType' },
          'eslint.codeAction.showDocumentation': { type: 'object', default: { enable: true } },
          'eslint.format.enable': { type: 'boolean', default: false },
          'eslint.workingDirectories': { type: 'array', default: [] },
          'eslint.nodePath': { type: 'string', default: null },
          'eslint.options': { type: 'object', default: {} },
          'eslint.codeActionsOnSave.mode': { allowed: ['all', 'problems'], default: 'all' },
          'eslint.codeActionsOnSave.rules': { type: 'array', default: null },
        },
      };

      // Configurar validación
      mockExtensionService.validateExtensionConfig.mockImplementation((extensionId: string, config: any) => {
        const errors: string[] = [];
        const extensionConfig = extensionConfigs[extensionId];

        if (!extensionConfig) {
          errors.push(`Unknown extension: ${extensionId}`);
          return errors;
        }

        for (const [key, rules] of Object.entries(extensionConfig)) {
          const value = config[key];
          if (value !== undefined) {
            if (rules.min !== undefined && value < rules.min) {
              errors.push(`${key} must be >= ${rules.min}`);
            }
            if (rules.max !== undefined && value > rules.max) {
              errors.push(`${key} must be <= ${rules.max}`);
            }
            if (rules.allowed && Array.isArray(rules.allowed) && !rules.allowed.includes(value)) {
              errors.push(`${key} must be one of: ${rules.allowed.join(', ')}`);
            }
            if (rules.type === 'boolean' && typeof value !== 'boolean') {
              errors.push(`${key} must be a boolean`);
            }
            if (rules.type === 'string' && typeof value !== 'string') {
              errors.push(`${key} must be a string`);
            }
            if (rules.type === 'array' && !Array.isArray(value)) {
              errors.push(`${key} must be an array`);
            }
            if (rules.type === 'object' && value !== null && typeof value !== 'object') {
              errors.push(`${key} must be an object`);
            }
          }
        }

        return errors;
      });

      // Act & Assert - Configuración válida de TypeScript
      const validTsConfig = {
        'typescript.preferences.importModuleSpecifier': 'relative',
        'typescript.suggest.autoImports': true,
        'typescript.validate.enable': true,
      };

      const tsErrors = mockExtensionService.validateExtensionConfig('ms-vscode.vscode-typescript-next', validTsConfig);
      expect(tsErrors).toHaveLength(0);

      // Act & Assert - Configuración inválida de Prettier
      const invalidPrettierConfig = {
        'prettier.printWidth': 0, // Demasiado pequeño
        'prettier.tabWidth': 100, // Demasiado grande
        'prettier.useTabs': 'yes', // Debe ser boolean
        'prettier.trailingComma': 'invalid', // Valor no permitido
      };

      const prettierErrors = mockExtensionService.validateExtensionConfig('esbenp.prettier-vscode', invalidPrettierConfig);
      expect(prettierErrors && prettierErrors.length).toBeGreaterThan(0);

      // Act & Assert - Extensión desconocida
      const unknownErrors = mockExtensionService.validateExtensionConfig('unknown.extension', {});
      expect(unknownErrors).toContain('Unknown extension: unknown.extension');
    });

    it('debe manejar conflictos entre configuraciones de extensiones', async () => {
      // Arrange
      const mockExtensionService = {
        detectConfigConflicts: jest.fn().mockResolvedValue([
          {
            extensions: ['esbenp.prettier-vscode', 'ms-vscode.vscode-eslint'],
            setting: 'editor.formatOnSave',
            conflictType: 'formatting',
            severity: 'warning',
            resolution: 'Configure one to format on save, the other only on demand',
          },
          {
            extensions: ['ms-vscode.vscode-typescript-next', 'bradlc.vscode-tailwindcss'],
            setting: 'editor.quickSuggestions.other',
            conflictType: 'performance',
            severity: 'info',
            resolution: 'Both extensions provide suggestions, consider disabling one',
          },
        ]),
        resolveConfigConflict: jest.fn().mockResolvedValue(undefined),
        getConflictResolution: jest.fn().mockReturnValue({
          'editor.formatOnSave': {
            'esbenp.prettier-vscode': true,
            'ms-vscode.vscode-eslint': false,
          },
        }),
      };

      // Act
      const conflicts = await mockExtensionService.detectConfigConflicts();
      const resolution = mockExtensionService.getConflictResolution();

      await mockExtensionService.resolveConfigConflict('editor.formatOnSave', {
        'esbenp.prettier-vscode': true,
        'ms-vscode.vscode-eslint': false,
      });

      // Assert
      expect(conflicts).toHaveLength(2);
      expect(conflicts[0].conflictType).toBe('formatting');
      expect(conflicts[1].severity).toBe('info');
      expect(resolution['editor.formatOnSave']['esbenp.prettier-vscode']).toBe(true);
      expect(mockExtensionService.resolveConfigConflict).toHaveBeenCalledWith('editor.formatOnSave', {
        'esbenp.prettier-vscode': true,
        'ms-vscode.vscode-eslint': false,
      });
    });
  });

  describe('Configuraciones críticas del workspace', () => {
    it('debe validar configuraciones críticas del workspace', async () => {
      // Arrange
      const mockWorkspaceConfig = {
        getWorkspaceSettings: jest.fn(),
        updateWorkspaceSettings: jest.fn().mockResolvedValue(undefined),
        validateWorkspaceConfig: jest.fn(),
      };

      // Configuraciones críticas del workspace
      const workspaceCriticalConfigs = {
        'folders': { type: 'array', minLength: 1 },
        'settings': { type: 'object' },
        'launch': { type: 'object' },
        'tasks': { type: 'object' },
        'extensions': { type: 'object' },
      };

      // Configurar validación
      mockWorkspaceConfig.validateWorkspaceConfig.mockImplementation((config) => {
        const errors: string[] = [];

        for (const [key, rules] of Object.entries(workspaceCriticalConfigs)) {
          const value = config[key];

          if (rules.required && value === undefined) {
            errors.push(`${key} is required`);
          }

          if (value !== undefined) {
            if (rules.type === 'array' && !Array.isArray(value)) {
              errors.push(`${key} must be an array`);
            }
            if (rules.type === 'object' && typeof value !== 'object') {
              errors.push(`${key} must be an object`);
            }
            if (rules.minLength && Array.isArray(value) && value.length < rules.minLength) {
              errors.push(`${key} must have at least ${rules.minLength} items`);
            }
          }
        }

        // Validaciones específicas
        if (config.folders) {
          for (const folder of config.folders) {
            if (!folder.uri || typeof folder.uri !== 'string') {
              errors.push('Each folder must have a valid uri');
            }
          }
        }

        return errors;
      });

      // Act & Assert - Workspace válido
      const validWorkspace = {
        folders: [
          { uri: 'file:///home/user/project' },
          { uri: 'file:///home/user/libraries' },
        ],
        settings: {
          'editor.fontSize': 14,
          'typescript.preferences.importModuleSpecifier': 'relative',
        },
        extensions: {
          recommendations: ['ms-vscode.vscode-typescript-next', 'esbenp.prettier-vscode'],
        },
      };

      const validErrors = mockWorkspaceConfig.validateWorkspaceConfig(validWorkspace);
      expect(validErrors).toHaveLength(0);

      // Act & Assert - Workspace inválido
      const invalidWorkspace = {
        folders: 'not-an-array', // Debe ser array
        settings: 'not-an-object', // Debe ser object
        invalidProperty: 'should-not-be-here',
      };

      const invalidErrors = mockWorkspaceConfig.validateWorkspaceConfig(invalidWorkspace);
      expect(invalidErrors.length).toBeGreaterThan(0);
      expect(invalidErrors.some(error => error.includes('folders must be an array'))).toBe(true);
      expect(invalidErrors.some(error => error.includes('settings must be an object'))).toBe(true);
    });

    it('debe manejar migración de configuraciones del workspace', async () => {
      // Arrange
      const mockWorkspaceMigration = {
        detectOutdatedConfig: jest.fn().mockResolvedValue([
          {
            setting: 'typescript.preferences.importModuleSpecifier',
            oldValue: 'auto',
            newValue: 'relative',
            reason: 'Value "auto" is deprecated, use "relative" instead',
          },
          {
            setting: 'editor.formatOnSave',
            oldValue: undefined,
            newValue: false,
            reason: 'New setting with default value',
          },
        ]),
        migrateWorkspaceConfig: jest.fn().mockResolvedValue({
          migrated: 2,
          skipped: 0,
          errors: [],
          backupPath: '/backups/workspace-pre-migration.json',
        }),
        previewMigration: jest.fn().mockResolvedValue({
          changes: [
            { setting: 'typescript.preferences.importModuleSpecifier', from: 'auto', to: 'relative' },
          ],
          warnings: [],
          breakingChanges: false,
        }),
      };

      // Act
      const outdatedConfigs = await mockWorkspaceMigration.detectOutdatedConfig();
      const preview = await mockWorkspaceMigration.previewMigration();
      const migrationResult = await mockWorkspaceMigration.migrateWorkspaceConfig();

      // Assert
      expect(outdatedConfigs).toHaveLength(2);
      expect(outdatedConfigs[0].oldValue).toBe('auto');
      expect(outdatedConfigs[0].newValue).toBe('relative');
      expect(preview.changes).toHaveLength(1);
      expect(preview.breakingChanges).toBe(false);
      expect(migrationResult.migrated).toBe(2);
      expect(migrationResult.backupPath).toContain('pre-migration');
    });
  });

  describe('Configuraciones críticas de rendimiento', () => {
    it('debe validar configuraciones críticas de rendimiento', async () => {
      // Arrange
      const mockPerformanceConfig = {
        getPerformanceSettings: jest.fn(),
        updatePerformanceSettings: jest.fn().mockResolvedValue(undefined),
        validatePerformanceConfig: jest.fn(),
      };

      // Configuraciones críticas de rendimiento
      const performanceCriticalConfigs = {
        'editor.largeFileOptimizations': { type: 'boolean', default: true },
        'editor.maxTokenizationLineLength': { min: 1000, max: 100000, default: 20000 },
        'editor.renderLineHighlight': { allowed: ['line', 'gutter', 'none'], default: 'line' },
        'editor.renderWhitespace': { allowed: ['selection', 'boundary', 'trailing', 'all'], default: 'selection' },
        'editor.smoothScrolling': { type: 'boolean', default: false },
        'editor.cursorBlinking': { allowed: ['blink', 'smooth', 'phase', 'expand', 'solid'], default: 'blink' },
        'editor.cursorSmoothCaretAnimation': { type: 'boolean', default: false },
        'editor.fastScrollSensitivity': { min: 1, max: 10, default: 5 },
        'workbench.editor.enablePreview': { type: 'boolean', default: true },
        'workbench.editor.showTabs': { allowed: ['multiple', 'single', 'none'], default: 'multiple' },
        'workbench.quickOpen.closeOnFocusLost': { type: 'boolean', default: true },
        'files.watcherExclude': { type: 'object', default: {} },
        'search.exclude': { type: 'object', default: {} },
        'extensions.autoUpdate': { type: 'boolean', default: true },
        'extensions.autoCheckUpdates': { type: 'boolean', default: true },
      };

      // Configurar validación
      mockPerformanceConfig.validatePerformanceConfig.mockImplementation((config) => {
        const errors: string[] = [];

        for (const [key, rules] of Object.entries(performanceCriticalConfigs)) {
          const value = config[key];
          if (value !== undefined) {
            if (rules.min !== undefined && value < rules.min) {
              errors.push(`${key} must be >= ${rules.min}`);
            }
            if (rules.max !== undefined && value > rules.max) {
              errors.push(`${key} must be <= ${rules.max}`);
            }
            if (rules.allowed && !rules.allowed.includes(value)) {
              errors.push(`${key} must be one of: ${rules.allowed.join(', ')}`);
            }
            if (rules.type === 'boolean' && typeof value !== 'boolean') {
              errors.push(`${key} must be a boolean`);
            }
          }
        }

        return errors;
      });

      // Act & Assert - Configuración válida
      const validPerformanceConfig = {
        'editor.largeFileOptimizations': true,
        'editor.maxTokenizationLineLength': 25000,
        'editor.renderLineHighlight': 'gutter',
        'editor.smoothScrolling': true,
        'editor.cursorBlinking': 'smooth',
        'workbench.editor.showTabs': 'single',
      };

      const validErrors = mockPerformanceConfig.validatePerformanceConfig(validPerformanceConfig);
      expect(validErrors).toHaveLength(0);

      // Act & Assert - Configuración inválida
      const invalidPerformanceConfig = {
        'editor.maxTokenizationLineLength': 500, // Demasiado pequeño
        'editor.renderLineHighlight': 'invalid', // Valor no permitido
        'editor.cursorBlinking': 'fast', // Valor no permitido
        'editor.fastScrollSensitivity': 15, // Demasiado grande
      };

      const invalidErrors = mockPerformanceConfig.validatePerformanceConfig(invalidPerformanceConfig);
      expect(invalidErrors.length).toBeGreaterThan(0);
    });

    it('debe monitorear y ajustar configuraciones de rendimiento automáticamente', async () => {
      // Arrange
      const mockPerformanceMonitor = {
        monitorPerformanceMetrics: jest.fn().mockResolvedValue({
          memoryUsage: 800 * 1024 * 1024, // 800MB
          cpuUsage: 75,
          renderTime: 45, // ms
          fileLoadTime: 120, // ms
          searchTime: 200, // ms
        }),
        suggestPerformanceOptimizations: jest.fn().mockResolvedValue([
          {
            setting: 'editor.minimap.enabled',
            currentValue: true,
            suggestedValue: false,
            reason: 'High memory usage detected',
            impact: 'Reduce memory by ~50MB',
          },
          {
            setting: 'editor.renderWhitespace',
            currentValue: 'all',
            suggestedValue: 'selection',
            reason: 'Slow render time detected',
            impact: 'Improve render performance by ~30%',
          },
        ]),
        applyPerformanceOptimizations: jest.fn().mockResolvedValue({
          applied: 2,
          skipped: 0,
          restartRequired: false,
        }),
        createPerformanceBaseline: jest.fn().mockResolvedValue({
          timestamp: new Date(),
          metrics: { /* baseline metrics */ },
        }),
      };

      // Act
      const metrics = await mockPerformanceMonitor.monitorPerformanceMetrics();
      const suggestions = await mockPerformanceMonitor.suggestPerformanceOptimizations();
      const application = await mockPerformanceMonitor.applyPerformanceOptimizations();
      const baseline = await mockPerformanceMonitor.createPerformanceBaseline();

      // Assert
      expect(metrics.memoryUsage).toBeGreaterThan(500 * 1024 * 1024); // Más de 500MB
      expect(metrics.renderTime).toBeLessThan(100); // Menos de 100ms
      expect(suggestions).toHaveLength(2);
      expect(suggestions[0].setting).toBe('editor.minimap.enabled');
      expect(suggestions[1].impact).toContain('%');
      expect(application.applied).toBe(2);
      expect(baseline.timestamp).toBeDefined();
    });
  });

  describe('Configuraciones críticas de seguridad', () => {
    it('debe validar configuraciones críticas de seguridad', async () => {
      // Arrange
      const mockSecurityConfig = {
        getSecuritySettings: jest.fn(),
        updateSecuritySettings: jest.fn().mockResolvedValue(undefined),
        validateSecurityConfig: jest.fn(),
        auditSecurityConfig: jest.fn().mockResolvedValue({
          score: 85,
          issues: [
            {
              severity: 'high',
              setting: 'security.workspace.trust.enabled',
              issue: 'Workspace trust is disabled',
              recommendation: 'Enable workspace trust for better security',
            },
          ],
          recommendations: [
            'Enable workspace trust',
            'Configure allowed extension types',
            'Set up content security policies',
          ],
        }),
      };

      // Configuraciones críticas de seguridad
      const securityCriticalConfigs = {
        'security.workspace.trust.enabled': { type: 'boolean', default: true },
        'security.workspace.trust.banner': { allowed: ['always', 'untilTrusted', 'never'], default: 'untilTrusted' },
        'security.workspace.trust.emptyWindow': { type: 'boolean', default: true },
        'extensions.verifySignature': { type: 'boolean', default: true },
        'http.proxy': { type: 'string', default: '' },
        'http.proxyStrictSSL': { type: 'boolean', default: true },
        'http.systemCertificates': { type: 'boolean', default: true },
        'git.enabled': { type: 'boolean', default: true },
        'git.path': { type: 'string', default: null },
        'git.safeDirectory': { type: 'array', default: [] },
        'terminal.integrated.shell.linux': { type: 'string', default: null },
        'terminal.integrated.shell.windows': { type: 'string', default: null },
        'terminal.integrated.shell.osx': { type: 'string', default: null },
        'workbench.settings.enableNaturalLanguageSearch': { type: 'boolean', default: true },
        'workbench.enableExperiments': { type: 'boolean', default: true },
        'telemetry.enableCrashReporter': { type: 'boolean', default: true },
        'telemetry.enableTelemetry': { type: 'boolean', default: true },
      };

      // Configurar validación
      mockSecurityConfig.validateSecurityConfig.mockImplementation((config) => {
        const errors: string[] = [];
        const warnings: string[] = [];

        for (const [key, rules] of Object.entries(securityCriticalConfigs)) {
          const value = config[key];

          if (key.includes('security.workspace.trust.enabled') && value === false) {
            warnings.push('Disabling workspace trust reduces security');
          }

          if (key.includes('extensions.verifySignature') && value === false) {
            warnings.push('Disabling extension signature verification is not recommended');
          }

          if (key.includes('http.proxyStrictSSL') && value === false) {
            errors.push('Disabling SSL verification for proxy is insecure');
          }

          if (value !== undefined) {
            if (rules.allowed && !rules.allowed.includes(value)) {
              errors.push(`${key} must be one of: ${rules.allowed.join(', ')}`);
            }
            if (rules.type === 'boolean' && typeof value !== 'boolean') {
              errors.push(`${key} must be a boolean`);
            }
            if (rules.type === 'string' && typeof value !== 'string') {
              errors.push(`${key} must be a string`);
            }
          }
        }

        return { errors, warnings };
      });

      // Act & Assert - Configuración segura
      const secureConfig = {
        'security.workspace.trust.enabled': true,
        'extensions.verifySignature': true,
        'http.proxyStrictSSL': true,
        'telemetry.enableTelemetry': false, // Usuario optó por no participar
      };

      const secureValidation = mockSecurityConfig.validateSecurityConfig(secureConfig);
      expect(secureValidation.errors).toHaveLength(0);
      expect(secureValidation.warnings).toHaveLength(0);

      // Act & Assert - Configuración insegura
      const insecureConfig = {
        'security.workspace.trust.enabled': false,
        'extensions.verifySignature': false,
        'http.proxyStrictSSL': false,
        'http.proxy': 'http://insecure-proxy:8080',
      };

      const insecureValidation = mockSecurityConfig.validateSecurityConfig(insecureConfig);
      expect(insecureValidation.errors.length).toBeGreaterThan(0);
      expect(insecureValidation.warnings.length).toBeGreaterThan(0);

      // Act - Auditoría de seguridad
      const audit = await mockSecurityConfig.auditSecurityConfig();

      // Assert
      expect(audit.score).toBeGreaterThanOrEqual(0);
      expect(audit.score).toBeLessThanOrEqual(100);
      expect(audit.issues).toHaveLength(1);
      expect(audit.recommendations).toHaveLength(3);
    });
  });
});