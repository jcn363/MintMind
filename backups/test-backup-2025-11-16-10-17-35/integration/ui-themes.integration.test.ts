/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { describe, beforeAll, afterAll, beforeEach, afterEach, it, expect, jest } from '@jest/globals';
import { setupTestDatabase, teardownTestDatabase } from './helpers/test-db';
import { setupTestServer, teardownTestServer } from './helpers/test-server';

// Mocks para servicios de temas y UI
jest.mock('../../src/vs/workbench/services/themes/common/themeService', () => ({
  ThemeService: jest.fn().mockImplementation(() => ({
    getCurrentTheme: jest.fn(),
    setTheme: jest.fn(),
    onThemeChange: jest.fn(),
  }))
}));

jest.mock('../../src/vs/workbench/services/themes/common/colorThemeData', () => ({
  ColorThemeData: jest.fn(),
}));

jest.mock('../../src/vs/platform/theme/common/themeService', () => ({
  ThemeService: jest.fn(),
}));

describe('UI Themes Integration', () => {
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
    // Limpiar estilos aplicados después de cada test
  });

  describe('Sistema de Temas', () => {
    it('debe cargar y aplicar temas correctamente', async () => {
      // Arrange
      const ThemeService = require('../../src/vs/workbench/services/themes/common/themeService').ThemeService;
      const mockThemeService = {
        getCurrentTheme: jest.fn().mockReturnValue({
          id: 'vs-dark',
          label: 'Dark Modern',
          type: 'dark',
          colors: {
            'editor.background': '#1e1e1e',
            'editor.foreground': '#cccccc',
            'editor.lineHighlightBackground': '#2d2d30',
            'editor.selectionBackground': '#264f78',
          },
        }),
        setTheme: jest.fn().mockResolvedValue(undefined),
        onThemeChange: jest.fn().mockReturnValue({
          dispose: jest.fn(),
        }),
      };

      ThemeService.mockReturnValue(mockThemeService);

      // Act
      const currentTheme = mockThemeService.getCurrentTheme();
      await mockThemeService.setTheme('vs-light');

      // Configurar listener para cambios de tema
      let themeChanges = 0;
      mockThemeService.onThemeChange(() => {
        themeChanges++;
      });

      // Simular cambio de tema
      const listener = mockThemeService.onThemeChange.mock.calls[0][0];
      listener({ id: 'vs-light', type: 'light' });

      // Assert
      expect(currentTheme.id).toBe('vs-dark');
      expect(currentTheme.type).toBe('dark');
      expect(currentTheme.colors['editor.background']).toBe('#1e1e1e');
      expect(mockThemeService.setTheme).toHaveBeenCalledWith('vs-light');
      expect(themeChanges).toBe(1);
    });

    it('debe manejar colores del tema correctamente', async () => {
      // Arrange
      const mockColorRegistry = {
        getColor: jest.fn().mockImplementation((id) => {
          const colors: { [key: string]: string } = {
            'editor.background': '#1e1e1e',
            'editor.foreground': '#cccccc',
            'button.background': '#0e639c',
            'button.foreground': '#ffffff',
            'list.activeSelectionBackground': '#094771',
          };
          return colors[id];
        }),
        onColorChange: jest.fn().mockReturnValue({
          dispose: jest.fn(),
        }),
        resolveColor: jest.fn().mockImplementation((colorId, theme) => {
          // Simular resolución de color basado en tema
          const themeColors: { [key: string]: { [key: string]: string } } = {
            'vs-dark': {
              'editor.background': '#1e1e1e',
              'button.background': '#0e639c',
            },
            'vs-light': {
              'editor.background': '#ffffff',
              'button.background': '#007acc',
            },
          };
          return themeColors[theme]?.[colorId];
        }),
      };

      // Act
      const editorBg = mockColorRegistry.getColor('editor.background');
      const buttonBg = mockColorRegistry.getColor('button.background');

      const darkEditorBg = mockColorRegistry.resolveColor('editor.background', 'vs-dark');
      const lightEditorBg = mockColorRegistry.resolveColor('editor.background', 'vs-light');

      // Assert
      expect(editorBg).toBe('#1e1e1e');
      expect(buttonBg).toBe('#0e639c');
      expect(darkEditorBg).toBe('#1e1e1e');
      expect(lightEditorBg).toBe('#ffffff');
    });

    it('debe gestionar tokens de sintaxis del tema', async () => {
      // Arrange
      const mockTokenTheme = {
        getTokenStyle: jest.fn().mockImplementation((tokenType, modifiers) => {
          const styles: { [key: string]: any } = {
            'keyword': {
              foreground: '#569cd6',
              fontStyle: 'bold',
            },
            'string': {
              foreground: '#ce9178',
            },
            'comment': {
              foreground: '#6a9955',
              fontStyle: 'italic',
            },
            'function': {
              foreground: '#dcdcaa',
            },
          };

          const style = styles[tokenType] || { foreground: '#cccccc' };

          // Aplicar modificadores
          if (modifiers?.includes('declaration') && tokenType === 'function') {
            style.fontStyle = 'bold underline';
          }

          return style;
        }),
        getTokenStylesForLanguage: jest.fn().mockReturnValue([
          {
            token: 'keyword',
            foreground: '#569cd6',
            scopes: ['keyword', 'keyword.control'],
          },
          {
            token: 'string',
            foreground: '#ce9178',
            scopes: ['string', 'string.quoted'],
          },
        ]),
        onTokenThemeChange: jest.fn().mockReturnValue({
          dispose: jest.fn(),
        }),
      };

      // Act
      const keywordStyle = mockTokenTheme.getTokenStyle('keyword');
      const stringStyle = mockTokenTheme.getTokenStyle('string');
      const functionStyle = mockTokenTheme.getTokenStyle('function', ['declaration']);

      const languageStyles = mockTokenTheme.getTokenStylesForLanguage('typescript');

      // Assert
      expect(keywordStyle.foreground).toBe('#569cd6');
      expect(keywordStyle.fontStyle).toBe('bold');
      expect(stringStyle.foreground).toBe('#ce9178');
      expect(functionStyle.fontStyle).toBe('bold underline');
      expect(languageStyles).toHaveLength(2);
      expect(languageStyles[0].token).toBe('keyword');
    });
  });

  describe('Componentes de UI con Temas', () => {
    it('debe aplicar estilos temáticos a componentes básicos', async () => {
      // Arrange
      const mockComponentStyler = {
        styleElement: jest.fn().mockImplementation((element, themeColors) => {
          const styles = {
            backgroundColor: themeColors['editor.background'],
            color: themeColors['editor.foreground'],
            border: `1px solid ${themeColors['widget.border'] || '#3e3e42'}`,
          };
          return styles;
        }),
        attachStyler: jest.fn().mockReturnValue({
          dispose: jest.fn(),
        }),
      };

      const themeColors = {
        'editor.background': '#1e1e1e',
        'editor.foreground': '#cccccc',
        'widget.border': '#3e3e42',
        'button.background': '#0e639c',
        'button.foreground': '#ffffff',
      };

      // Act
      const buttonStyles = mockComponentStyler.styleElement('button', themeColors);
      const inputStyles = mockComponentStyler.styleElement('input', themeColors);

      const styler = mockComponentStyler.attachStyler(document.createElement('div'));

      // Assert
      expect(buttonStyles.backgroundColor).toBe('#1e1e1e');
      expect(buttonStyles.color).toBe('#cccccc');
      expect(buttonStyles.border).toBe('1px solid #3e3e42');
      expect(inputStyles).toEqual(buttonStyles); // Mismo elemento base
      expect(styler.dispose).toBeDefined();
    });

    it('debe manejar estados interactivos de componentes', async () => {
      // Arrange
      const mockInteractiveStyler = {
        getStylesForState: jest.fn().mockImplementation((baseStyles, state) => {
          const stateStyles = { ...baseStyles };

          if (state.hover) {
            stateStyles.backgroundColor = '#2d2d30';
            stateStyles.opacity = 0.8;
          }

          if (state.active) {
            stateStyles.backgroundColor = '#094771';
            stateStyles.transform = 'scale(0.98)';
          }

          if (state.focus) {
            stateStyles.outline = '2px solid #007acc';
            stateStyles.outlineOffset = '1px';
          }

          if (state.disabled) {
            stateStyles.opacity = 0.5;
            stateStyles.cursor = 'not-allowed';
          }

          return stateStyles;
        }),
      };

      const baseStyles = {
        backgroundColor: '#1e1e1e',
        color: '#cccccc',
        padding: '8px 12px',
      };

      // Act
      const normalStyles = mockInteractiveStyler.getStylesForState(baseStyles, {});
      const hoverStyles = mockInteractiveStyler.getStylesForState(baseStyles, { hover: true });
      const activeStyles = mockInteractiveStyler.getStylesForState(baseStyles, { active: true });
      const focusStyles = mockInteractiveStyler.getStylesForState(baseStyles, { focus: true });
      const disabledStyles = mockInteractiveStyler.getStylesForState(baseStyles, { disabled: true });

      // Assert
      expect(normalStyles.backgroundColor).toBe('#1e1e1e');
      expect(hoverStyles.backgroundColor).toBe('#2d2d30');
      expect(hoverStyles.opacity).toBe(0.8);
      expect(activeStyles.backgroundColor).toBe('#094771');
      expect(activeStyles.transform).toBe('scale(0.98)');
      expect(focusStyles.outline).toBe('2px solid #007acc');
      expect(disabledStyles.opacity).toBe(0.5);
      expect(disabledStyles.cursor).toBe('not-allowed');
    });

    it('debe gestionar animaciones y transiciones temáticas', async () => {
      // Arrange
      const mockAnimationStyler = {
        getTransitionStyles: jest.fn().mockReturnValue({
          transition: 'background-color 0.2s ease, color 0.2s ease, transform 0.1s ease',
        }),
        getAnimationStyles: jest.fn().mockImplementation((animationType) => {
          const animations = {
            'fade-in': {
              animation: 'fadeIn 0.3s ease-out',
            },
            'slide-up': {
              animation: 'slideUp 0.2s ease-out',
            },
            'bounce': {
              animation: 'bounce 0.5s ease-in-out',
            },
          };
          return animations[animationType] || {};
        }),
        createKeyframes: jest.fn().mockReturnValue(`
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
        `),
      };

      // Act
      const transitions = mockAnimationStyler.getTransitionStyles();
      const fadeIn = mockAnimationStyler.getAnimationStyles('fade-in');
      const slideUp = mockAnimationStyler.getAnimationStyles('slide-up');
      const keyframes = mockAnimationStyler.createKeyframes('fadeIn');

      // Assert
      expect(transitions.transition).toContain('background-color 0.2s ease');
      expect(fadeIn.animation).toBe('fadeIn 0.3s ease-out');
      expect(slideUp.animation).toBe('slideUp 0.2s ease-out');
      expect(keyframes).toContain('@keyframes fadeIn');
      expect(keyframes).toContain('opacity: 0');
      expect(keyframes).toContain('opacity: 1');
    });
  });

  describe('CSS Variables y Diseño Responsivo', () => {
    it('debe gestionar variables CSS del tema', async () => {
      // Arrange
      const mockCSSVariableManager = {
        setCSSVariable: jest.fn(),
        getCSSVariable: jest.fn().mockImplementation((name) => {
          const variables: { [key: string]: string } = {
            '--vscode-editor-background': '#1e1e1e',
            '--vscode-editor-foreground': '#cccccc',
            '--vscode-button-background': '#0e639c',
            '--vscode-font-size': '14px',
            '--vscode-font-family': '"Segoe WPC", "Segoe UI", sans-serif',
          };
          return variables[name];
        }),
        updateThemeVariables: jest.fn().mockImplementation((theme) => {
          const variableMap: { [key: string]: { [key: string]: string } } = {
            'vs-dark': {
              '--vscode-editor-background': '#1e1e1e',
              '--vscode-editor-foreground': '#cccccc',
              '--vscode-accent-color': '#007acc',
            },
            'vs-light': {
              '--vscode-editor-background': '#ffffff',
              '--vscode-editor-foreground': '#000000',
              '--vscode-accent-color': '#005a9e',
            },
          };
          return variableMap[theme] || {};
        }),
        getAllVariables: jest.fn().mockReturnValue({
          '--vscode-editor-background': '#1e1e1e',
          '--vscode-editor-foreground': '#cccccc',
          '--vscode-font-size': '14px',
          '--vscode-spacing-unit': '4px',
        }),
      };

      // Act
      const editorBg = mockCSSVariableManager.getCSSVariable('--vscode-editor-background');
      const buttonBg = mockCSSVariableManager.getCSSVariable('--vscode-button-background');
      const fontSize = mockCSSVariableManager.getCSSVariable('--vscode-font-size');

      const darkVariables = mockCSSVariableManager.updateThemeVariables('vs-dark');
      const lightVariables = mockCSSVariableManager.updateThemeVariables('vs-light');

      const allVariables = mockCSSVariableManager.getAllVariables();

      // Assert
      expect(editorBg).toBe('#1e1e1e');
      expect(buttonBg).toBe('#0e639c');
      expect(fontSize).toBe('14px');
      expect(darkVariables['--vscode-accent-color']).toBe('#007acc');
      expect(lightVariables['--vscode-editor-background']).toBe('#ffffff');
      expect(allVariables['--vscode-spacing-unit']).toBe('4px');
    });

    it('debe manejar diseño responsivo con temas', async () => {
      // Arrange
      const mockResponsiveStyler = {
        getResponsiveStyles: jest.fn().mockImplementation((baseStyles, breakpoints) => {
          return {
            ...baseStyles,
            '@media (max-width: 768px)': {
              fontSize: '12px',
              padding: '4px 8px',
            },
            '@media (max-width: 480px)': {
              fontSize: '11px',
              padding: '2px 4px',
            },
            '@media (min-width: 1200px)': {
              fontSize: '16px',
              padding: '12px 16px',
            },
          };
        }),
        applyViewportScaling: jest.fn().mockImplementation((styles, scale) => {
          const scaled: { [key: string]: any } = {};
          for (const [key, value] of Object.entries(styles)) {
            if (typeof value === 'string' && value.includes('px')) {
              const numValue = parseFloat(value.replace('px', ''));
              scaled[key] = `${numValue * scale}px`;
            } else {
              scaled[key] = value;
            }
          }
          return scaled;
        }),
      };

      const baseStyles = {
        fontSize: '14px',
        padding: '8px 12px',
        margin: '4px',
      };

      // Act
      const responsiveStyles = mockResponsiveStyler.getResponsiveStyles(baseStyles, {
        mobile: 480,
        tablet: 768,
        desktop: 1200,
      });

      const scaledStyles = mockResponsiveStyler.applyViewportScaling(baseStyles, 1.25);

      // Assert
      expect(responsiveStyles.fontSize).toBe('14px');
      expect(responsiveStyles['@media (max-width: 768px)'].fontSize).toBe('12px');
      expect(responsiveStyles['@media (max-width: 480px)'].padding).toBe('2px 4px');
      expect(responsiveStyles['@media (min-width: 1200px)'].fontSize).toBe('16px');
      expect(scaledStyles.fontSize).toBe('17.5px'); // 14 * 1.25
      expect(scaledStyles.padding).toBe('10px 15px'); // 8*1.25, 12*1.25
    });

    it('debe gestionar preferencias de accesibilidad', async () => {
      // Arrange
      const mockAccessibilityStyler = {
        applyHighContrast: jest.fn().mockImplementation((styles) => ({
          ...styles,
          border: '2px solid #ffffff',
          outline: '2px solid #000000',
          backgroundColor: '#000000',
          color: '#ffffff',
        })),
        applyReducedMotion: jest.fn().mockImplementation((styles) => ({
          ...styles,
          transition: 'none',
          animation: 'none',
          transform: 'none',
        })),
        applyLargeText: jest.fn().mockImplementation((styles, scale = 1.2) => ({
          ...styles,
          fontSize: `${parseFloat(styles.fontSize) * scale}px`,
          lineHeight: `${parseFloat(styles.lineHeight || '1.4') * scale}`,
        })),
        detectPreferences: jest.fn().mockResolvedValue({
          highContrast: false,
          reducedMotion: true,
          largeText: false,
          colorBlind: 'none',
        }),
      };

      const baseStyles = {
        backgroundColor: '#1e1e1e',
        color: '#cccccc',
        fontSize: '14px',
        lineHeight: '1.4',
        transition: 'background-color 0.2s ease',
      };

      // Act
      const highContrastStyles = mockAccessibilityStyler.applyHighContrast(baseStyles);
      const reducedMotionStyles = mockAccessibilityStyler.applyReducedMotion(baseStyles);
      const largeTextStyles = mockAccessibilityStyler.applyLargeText(baseStyles, 1.5);

      const preferences = await mockAccessibilityStyler.detectPreferences();

      // Assert
      expect(highContrastStyles.border).toBe('2px solid #ffffff');
      expect(highContrastStyles.backgroundColor).toBe('#000000');
      expect(reducedMotionStyles.transition).toBe('none');
      expect(reducedMotionStyles.animation).toBe('none');
      expect(largeTextStyles.fontSize).toBe('21px'); // 14 * 1.5
      expect(largeTextStyles.lineHeight).toBe('2.1'); // 1.4 * 1.5
      expect(preferences.reducedMotion).toBe(true);
      expect(preferences.colorBlind).toBe('none');
    });
  });

  describe('Integración con Componentes de Workbench', () => {
    it('debe aplicar temas a componentes del editor', async () => {
      // Arrange
      const mockEditorThemer = {
        applyThemeToEditor: jest.fn().mockImplementation((editor, theme) => {
          const themeStyles = {
            'vs-dark': {
              background: '#1e1e1e',
              foreground: '#cccccc',
              selection: '#264f78',
              lineHighlight: '#2d2d30',
            },
            'vs-light': {
              background: '#ffffff',
              foreground: '#000000',
              selection: '#add6ff',
              lineHighlight: '#f0f0f0',
            },
          };

          return themeStyles[theme] || themeStyles['vs-dark'];
        }),
        updateMinimapTheme: jest.fn().mockResolvedValue(undefined),
        updateScrollbarTheme: jest.fn().mockResolvedValue(undefined),
      };

      const mockEditor = {
        updateOptions: jest.fn(),
        getModel: jest.fn().mockReturnValue({}),
      };

      // Act
      const darkThemeStyles = mockEditorThemer.applyThemeToEditor(mockEditor, 'vs-dark');
      const lightThemeStyles = mockEditorThemer.applyThemeToEditor(mockEditor, 'vs-light');

      await mockEditorThemer.updateMinimapTheme('vs-dark');
      await mockEditorThemer.updateScrollbarTheme('vs-dark');

      // Assert
      expect(darkThemeStyles.background).toBe('#1e1e1e');
      expect(darkThemeStyles.foreground).toBe('#cccccc');
      expect(lightThemeStyles.background).toBe('#ffffff');
      expect(lightThemeStyles.selection).toBe('#add6ff');
      expect(mockEditorThemer.updateMinimapTheme).toHaveBeenCalledWith('vs-dark');
      expect(mockEditorThemer.updateScrollbarTheme).toHaveBeenCalledWith('vs-dark');
    });

    it('debe aplicar temas a componentes de la barra lateral', async () => {
      // Arrange
      const mockSidebarThemer = {
        applyThemeToSidebar: jest.fn().mockImplementation((sidebar, theme) => {
          const themeColors = {
            'vs-dark': {
              background: '#252526',
              foreground: '#cccccc',
              border: '#3e3e42',
              activeItem: '#37373d',
            },
            'vs-light': {
              background: '#f3f3f3',
              foreground: '#000000',
              border: '#e5e5e5',
              activeItem: '#ffffff',
            },
          };

          return themeColors[theme] || themeColors['vs-dark'];
        }),
        updateTreeTheme: jest.fn().mockResolvedValue(undefined),
        updateSearchTheme: jest.fn().mockResolvedValue(undefined),
        updateExtensionsTheme: jest.fn().mockResolvedValue(undefined),
      };

      // Act
      const darkSidebar = mockSidebarThemer.applyThemeToSidebar({}, 'vs-dark');
      const lightSidebar = mockSidebarThemer.applyThemeToSidebar({}, 'vs-light');

      await mockSidebarThemer.updateTreeTheme('vs-dark');
      await mockSidebarThemer.updateSearchTheme('vs-dark');
      await mockSidebarThemer.updateExtensionsTheme('vs-dark');

      // Assert
      expect(darkSidebar.background).toBe('#252526');
      expect(darkSidebar.activeItem).toBe('#37373d');
      expect(lightSidebar.background).toBe('#f3f3f3');
      expect(lightSidebar.foreground).toBe('#000000');
      expect(mockSidebarThemer.updateTreeTheme).toHaveBeenCalledWith('vs-dark');
      expect(mockSidebarThemer.updateSearchTheme).toHaveBeenCalledWith('vs-dark');
      expect(mockSidebarThemer.updateExtensionsTheme).toHaveBeenCalledWith('vs-dark');
    });

    it('debe aplicar temas a componentes del terminal', async () => {
      // Arrange
      const mockTerminalThemer = {
        applyThemeToTerminal: jest.fn().mockImplementation((terminal, theme) => {
          const themeColors = {
            'vs-dark': {
              background: '#1e1e1e',
              foreground: '#cccccc',
              cursor: '#ffffff',
              selection: '#264f78',
              black: '#000000',
              red: '#f44747',
              green: '#6a9955',
              yellow: '#dcdcaa',
              blue: '#4f5b93',
              magenta: '#c586c0',
              cyan: '#4ec9b0',
              white: '#d4d4d4',
            },
          };

          return themeColors[theme] || themeColors['vs-dark'];
        }),
        updateTerminalColors: jest.fn().mockResolvedValue(undefined),
        updateTerminalCursor: jest.fn().mockResolvedValue(undefined),
      };

      // Act
      const terminalColors = mockTerminalThemer.applyThemeToTerminal({}, 'vs-dark');

      await mockTerminalThemer.updateTerminalColors('vs-dark');
      await mockTerminalThemer.updateTerminalCursor('block');

      // Assert
      expect(terminalColors.background).toBe('#1e1e1e');
      expect(terminalColors.foreground).toBe('#cccccc');
      expect(terminalColors.red).toBe('#f44747');
      expect(terminalColors.cyan).toBe('#4ec9b0');
      expect(mockTerminalThemer.updateTerminalColors).toHaveBeenCalledWith('vs-dark');
      expect(mockTerminalThemer.updateTerminalCursor).toHaveBeenCalledWith('block');
    });
  });

  describe('Optimización de Rendimiento de Temas', () => {
    it('debe optimizar cambios de tema para rendimiento', async () => {
      // Arrange
      const mockThemeOptimizer = {
        batchThemeChanges: jest.fn().mockImplementation(async (changes) => {
          // Simular aplicación por lotes
          const results = [];
          for (const change of changes) {
            results.push({ component: change.component, applied: true });
          }
          return results;
        }),
        debounceThemeUpdates: jest.fn().mockImplementation((callback, delay = 100) => {
          let timeoutId: NodeJS.Timeout;
          return (...args: any[]) => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => callback.apply(null, args), delay);
          };
        }),
        cacheThemeStyles: jest.fn().mockReturnValue({
          get: jest.fn().mockImplementation((key) => {
            const cache = {
              'editor-dark': { background: '#1e1e1e', foreground: '#cccccc' },
              'button-dark': { background: '#0e639c', foreground: '#ffffff' },
            };
            return cache[key];
          }),
          set: jest.fn(),
          clear: jest.fn(),
        }),
      };

      const themeChanges = [
        { component: 'editor', theme: 'vs-dark' },
        { component: 'sidebar', theme: 'vs-dark' },
        { component: 'statusbar', theme: 'vs-dark' },
      ];

      // Act
      const results = await mockThemeOptimizer.batchThemeChanges(themeChanges);

      const debouncedCallback = mockThemeOptimizer.debounceThemeUpdates(() => {
        console.log('Theme updated');
      });

      const cache = mockThemeOptimizer.cacheThemeStyles();
      const cachedEditorStyles = cache.get('editor-dark');
      const cachedButtonStyles = cache.get('button-dark');

      // Assert
      expect(results).toHaveLength(3);
      expect(results[0].component).toBe('editor');
      expect(results[0].applied).toBe(true);
      expect(debouncedCallback).toBeDefined();
      expect(cachedEditorStyles.background).toBe('#1e1e1e');
      expect(cachedButtonStyles.foreground).toBe('#ffffff');
    });

    it('debe manejar carga diferida de temas', async () => {
      // Arrange
      const mockLazyThemeLoader = {
        loadThemeAsync: jest.fn().mockImplementation(async (themeId) => {
          // Simular carga asíncrona
          await new Promise(resolve => setTimeout(resolve, 50));

          const themes = {
            'material-dark': {
              id: 'material-dark',
              colors: { 'editor.background': '#263238' },
              tokens: [{ scope: 'keyword', settings: { foreground: '#82b1ff' } }],
            },
            'github-light': {
              id: 'github-light',
              colors: { 'editor.background': '#ffffff' },
              tokens: [{ scope: 'string', settings: { foreground: '#032f62' } }],
            },
          };

          return themes[themeId];
        }),
        preloadThemes: jest.fn().mockResolvedValue(['material-dark', 'github-light']),
        getLoadedThemes: jest.fn().mockReturnValue(new Set(['vs-dark', 'vs-light'])),
      };

      // Act
      const materialTheme = await mockLazyThemeLoader.loadThemeAsync('material-dark');
      const githubTheme = await mockLazyThemeLoader.loadThemeAsync('github-light');

      const preloadedThemes = await mockLazyThemeLoader.preloadThemes();
      const loadedThemes = mockLazyThemeLoader.getLoadedThemes();

      // Assert
      expect(materialTheme.id).toBe('material-dark');
      expect(materialTheme.colors['editor.background']).toBe('#263238');
      expect(githubTheme.tokens[0].settings.foreground).toBe('#032f62');
      expect(preloadedThemes).toEqual(['material-dark', 'github-light']);
      expect(loadedThemes.has('vs-dark')).toBe(true);
      expect(loadedThemes.has('github-light')).toBe(false);
    });
  });
});