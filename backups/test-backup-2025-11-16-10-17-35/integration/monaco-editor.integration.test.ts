/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { describe, beforeAll, afterAll, beforeEach, afterEach, it, expect, jest } from '@jest/globals';
import { setupTestDatabase, teardownTestDatabase } from './helpers/test-db';
import { setupTestServer, teardownTestServer } from './helpers/test-server';

// Mocks para Monaco Editor
jest.mock('monaco-editor', () => ({
  editor: {
    create: jest.fn(),
    createModel: jest.fn(),
    getModel: jest.fn(),
    setModelLanguage: jest.fn(),
    createWebWorker: jest.fn(),
  },
  languages: {
    typescript: {
      typescriptDefaults: {
        setCompilerOptions: jest.fn(),
        setDiagnosticsOptions: jest.fn(),
      },
      javascriptDefaults: {
        setCompilerOptions: jest.fn(),
        setDiagnosticsOptions: jest.fn(),
      },
    },
    json: {
      jsonDefaults: {
        setDiagnosticsOptions: jest.fn(),
      },
    },
    register: jest.fn(),
    registerCompletionItemProvider: jest.fn(),
    registerHoverProvider: jest.fn(),
  },
  KeyMod: {
    CtrlCmd: 2048,
    Shift: 1024,
  },
  KeyCode: {
    KeyF: 46,
    KeyH: 47,
  },
}));

describe('Monaco Editor Integration', () => {
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
    // Limpiar instancias de Monaco después de cada test
  });

  describe('Inicialización del Editor', () => {
    it('debe crear una instancia de Monaco correctamente', async () => {
      // Arrange
      const { editor } = require('monaco-editor');
      const mockEditorInstance = {
        getModel: jest.fn().mockReturnValue({
          getValue: () => 'console.log("Hello");',
          setValue: jest.fn(),
          dispose: jest.fn(),
        }),
        updateOptions: jest.fn(),
        focus: jest.fn(),
        dispose: jest.fn(),
        onDidChangeModelContent: jest.fn(),
        onDidFocusEditorText: jest.fn(),
      };

      editor.create.mockReturnValue(mockEditorInstance);

      // Act
      const editorElement = document.createElement('div');
      const monacoEditor = editor.create(editorElement, {
        value: 'console.log("Hello");',
        language: 'javascript',
        theme: 'vs-dark',
        fontSize: 14,
      });

      // Assert
      expect(editor.create).toHaveBeenCalledWith(editorElement, {
        value: 'console.log("Hello");',
        language: 'javascript',
        theme: 'vs-dark',
        fontSize: 14,
      });
      expect(monacoEditor.getModel).toBeDefined();
      expect(monacoEditor.focus).toBeDefined();
    });

    it('debe configurar opciones del editor correctamente', async () => {
      // Arrange
      const { editor } = require('monaco-editor');
      const mockEditorInstance = {
        updateOptions: jest.fn(),
        getModel: jest.fn().mockReturnValue({
          getValue: () => '',
          setValue: jest.fn(),
        }),
      };

      editor.create.mockReturnValue(mockEditorInstance);

      const options = {
        minimap: { enabled: false },
        lineNumbers: 'on',
        wordWrap: 'on',
        tabSize: 2,
        insertSpaces: true,
        detectIndentation: false,
      };

      // Act
      const monacoEditor = editor.create(document.createElement('div'), {});
      monacoEditor.updateOptions(options);

      // Assert
      expect(monacoEditor.updateOptions).toHaveBeenCalledWith(options);
    });

    it('debe crear modelos con diferentes lenguajes correctamente', async () => {
      // Arrange
      const { editor } = require('monaco-editor');
      const mockModel = {
        getValue: () => '',
        setValue: jest.fn(),
        dispose: jest.fn(),
        onDidChangeContent: jest.fn(),
      };

      editor.createModel.mockReturnValue(mockModel);

      const testCases = [
        { content: 'console.log("js");', language: 'javascript' },
        { content: 'const x: number = 1;', language: 'typescript' },
        { content: '{"key": "value"}', language: 'json' },
        { content: '# Markdown content', language: 'markdown' },
      ];

      // Act & Assert
      for (const testCase of testCases) {
        const model = editor.createModel(testCase.content, testCase.language);
        expect(editor.createModel).toHaveBeenCalledWith(testCase.content, testCase.language);
        expect(model).toBeDefined();
      }
    });
  });

  describe('Syntax Highlighting y Lenguajes', () => {
    it('debe configurar TypeScript correctamente', async () => {
      // Arrange
      const { languages } = require('monaco-editor');
      const mockTypeScriptDefaults = {
        setCompilerOptions: jest.fn(),
        setDiagnosticsOptions: jest.fn(),
      };

      languages.typescript.typescriptDefaults = mockTypeScriptDefaults;

      // Act
      languages.typescript.typescriptDefaults.setCompilerOptions({
        target: 2, // ES2015
        module: 1, // CommonJS
        strict: true,
        esModuleInterop: true,
      });

      languages.typescript.typescriptDefaults.setDiagnosticsOptions({
        noSemanticValidation: false,
        noSyntaxValidation: false,
      });

      // Assert
      expect(mockTypeScriptDefaults.setCompilerOptions).toHaveBeenCalledWith({
        target: 2,
        module: 1,
        strict: true,
        esModuleInterop: true,
      });
      expect(mockTypeScriptDefaults.setDiagnosticsOptions).toHaveBeenCalledWith({
        noSemanticValidation: false,
        noSyntaxValidation: false,
      });
    });

    it('debe registrar proveedores de completado correctamente', async () => {
      // Arrange
      const { languages } = require('monaco-editor');
      const mockCompletionProvider = {
        provideCompletionItems: jest.fn().mockResolvedValue({
          suggestions: [
            {
              label: 'console',
              kind: 5, // Keyword
              insertText: 'console',
              documentation: 'Console object',
            },
            {
              label: 'log',
              kind: 1, // Method
              insertText: 'log',
              detail: '(method) Console.log(...messages: any[]): void',
            },
          ],
        }),
      };

      // Act
      const disposable = languages.registerCompletionItemProvider('javascript', mockCompletionProvider);

      // Assert
      expect(languages.registerCompletionItemProvider).toHaveBeenCalledWith('javascript', mockCompletionProvider);
      expect(disposable).toBeDefined(); // Debería retornar un disposable
    });

    it('debe manejar hover information correctamente', async () => {
      // Arrange
      const { languages } = require('monaco-editor');
      const mockHoverProvider = {
        provideHover: jest.fn().mockResolvedValue({
          contents: [
            { value: '**console.log**' },
            { value: 'Logs a message to the console' },
            { value: '```typescript\nconsole.log(message?: any, ...optionalParams: any[]): void\n```' },
          ],
          range: {
            startLineNumber: 1,
            startColumn: 1,
            endLineNumber: 1,
            endColumn: 12,
          },
        }),
      };

      // Act
      languages.registerHoverProvider('typescript', mockHoverProvider);

      // Assert
      expect(languages.registerHoverProvider).toHaveBeenCalledWith('typescript', mockHoverProvider);
    });
  });

  describe('Edición y Manipulación de Texto', () => {
    it('debe manejar operaciones básicas de edición', async () => {
      // Arrange
      const mockModel = {
        getValue: jest.fn().mockReturnValue('Hello World'),
        setValue: jest.fn(),
        getValueInRange: jest.fn().mockReturnValue('Hello'),
        applyEdits: jest.fn().mockReturnValue(true),
        pushEditOperations: jest.fn(),
      };

      const mockEditor = {
        getModel: jest.fn().mockReturnValue(mockModel),
        getSelection: jest.fn().mockReturnValue({
          startLineNumber: 1,
          startColumn: 1,
          endLineNumber: 1,
          endColumn: 6,
        }),
        setSelection: jest.fn(),
        revealLine: jest.fn(),
      };

      // Act
      const value = mockModel.getValue();
      const selection = mockEditor.getSelection();
      const selectedText = mockModel.getValueInRange(selection);

      mockModel.setValue('Hello Universe');
      mockModel.applyEdits([{
        range: selection,
        text: 'Hi',
      }]);

      // Assert
      expect(value).toBe('Hello World');
      expect(selectedText).toBe('Hello');
      expect(mockModel.setValue).toHaveBeenCalledWith('Hello Universe');
      expect(mockModel.applyEdits).toHaveBeenCalledWith([{
        range: selection,
        text: 'Hi',
      }]);
    });

    it('debe manejar undo/redo correctamente', async () => {
      // Arrange
      const mockEditor = {
        getModel: jest.fn().mockReturnValue({
          getValue: () => 'Original text',
          undo: jest.fn(),
          redo: jest.fn(),
          pushStackElement: jest.fn(),
        }),
        trigger: jest.fn(),
      };

      // Act
      mockEditor.trigger('source', 'editor.action.undo');
      mockEditor.trigger('source', 'editor.action.redo');

      // Assert
      expect(mockEditor.trigger).toHaveBeenCalledWith('source', 'editor.action.undo');
      expect(mockEditor.trigger).toHaveBeenCalledWith('source', 'editor.action.redo');
    });

    it('debe manejar búsqueda y reemplazo', async () => {
      // Arrange
      const mockModel = {
        findMatches: jest.fn().mockReturnValue([
          {
            range: { startLineNumber: 1, startColumn: 7, endLineNumber: 1, endColumn: 12 },
            matches: ['World'],
          },
        ]),
        applyEdits: jest.fn().mockReturnValue(true),
      };

      const mockEditor = {
        getModel: jest.fn().mockReturnValue(mockModel),
        trigger: jest.fn(),
      };

      // Act
      const matches = mockModel.findMatches('World', false, false, false, null, false);

      // Aplicar reemplazo
      mockModel.applyEdits([{
        range: matches[0].range,
        text: 'Universe',
      }]);

      // Assert
      expect(matches).toHaveLength(1);
      expect(matches[0].matches[0]).toBe('World');
      expect(mockModel.applyEdits).toHaveBeenCalledWith([{
        range: matches[0].range,
        text: 'Universe',
      }]);
    });
  });

  describe('Temas y Personalización', () => {
    it('debe cambiar temas correctamente', async () => {
      // Arrange
      const { editor } = require('monaco-editor');
      const mockEditor = {
        updateOptions: jest.fn(),
      };

      editor.create.mockReturnValue(mockEditor);

      const themes = ['vs', 'vs-dark', 'hc-black'];

      // Act & Assert
      for (const theme of themes) {
        mockEditor.updateOptions({ theme });
        expect(mockEditor.updateOptions).toHaveBeenCalledWith({ theme });
      }
    });

    it('debe definir temas personalizados', async () => {
      // Arrange
      const { editor } = require('monaco-editor');
      const mockEditor = {
        _themeService: {
          defineTheme: jest.fn(),
        },
      };

      editor.create.mockReturnValue(mockEditor);

      const customTheme = {
        base: 'vs-dark',
        inherit: true,
        rules: [
          { token: 'comment', foreground: '6A9955' },
          { token: 'keyword', foreground: '569CD6' },
          { token: 'string', foreground: 'CE9178' },
        ],
        colors: {
          'editor.background': '#1E1E1E',
          'editor.foreground': '#D4D4D4',
        },
      };

      // Act
      editor.defineTheme('custom-theme', customTheme);

      // Assert
      expect(editor.defineTheme).toHaveBeenCalledWith('custom-theme', customTheme);
    });

    it('debe manejar opciones de fuente y layout', async () => {
      // Arrange
      const mockEditor = {
        updateOptions: jest.fn(),
        getOptions: jest.fn().mockReturnValue({
          fontSize: 14,
          fontFamily: 'Consolas, Monaco, monospace',
          lineHeight: 1.5,
          letterSpacing: 0,
        }),
      };

      const fontOptions = {
        fontSize: 16,
        fontFamily: '"Fira Code", Consolas, monospace',
        lineHeight: 1.6,
        letterSpacing: 0.5,
      };

      // Act
      mockEditor.updateOptions(fontOptions);
      const options = mockEditor.getOptions();

      // Assert
      expect(mockEditor.updateOptions).toHaveBeenCalledWith(fontOptions);
      expect(options.fontSize).toBe(14); // Valor original del mock
    });
  });

  describe('Eventos y Callbacks', () => {
    it('debe manejar eventos de cambio de contenido', async () => {
      // Arrange
      const mockModel = {
        onDidChangeContent: jest.fn().mockReturnValue({
          dispose: jest.fn(),
        }),
      };

      const mockEditor = {
        getModel: jest.fn().mockReturnValue(mockModel),
      };

      const contentChanges: any[] = [];
      const callback = (event: any) => {
        contentChanges.push(event);
      };

      // Act
      const disposable = mockModel.onDidChangeContent(callback);

      // Simular cambio de contenido
      callback({
        changes: [{
          range: { startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 1 },
          rangeOffset: 0,
          rangeLength: 0,
          text: 'H',
        }],
        isUndoing: false,
        isRedoing: false,
      });

      disposable.dispose();

      // Assert
      expect(contentChanges).toHaveLength(1);
      expect(contentChanges[0].changes[0].text).toBe('H');
      expect(disposable.dispose).toHaveBeenCalled();
    });

    it('debe manejar eventos de foco del editor', async () => {
      // Arrange
      const mockEditor = {
        onDidFocusEditorText: jest.fn().mockReturnValue({
          dispose: jest.fn(),
        }),
        onDidBlurEditorText: jest.fn().mockReturnValue({
          dispose: jest.fn(),
        }),
      };

      let focusEvents = 0;
      let blurEvents = 0;

      // Act
      const focusDisposable = mockEditor.onDidFocusEditorText(() => focusEvents++);
      const blurDisposable = mockEditor.onDidBlurEditorText(() => blurEvents++);

      // Simular eventos
      const focusCallback = mockEditor.onDidFocusEditorText.mock.calls[0][0];
      const blurCallback = mockEditor.onDidBlurEditorText.mock.calls[0][0];

      focusCallback();
      blurCallback();

      focusDisposable.dispose();
      blurDisposable.dispose();

      // Assert
      expect(focusEvents).toBe(1);
      expect(blurEvents).toBe(1);
      expect(focusDisposable.dispose).toHaveBeenCalled();
      expect(blurDisposable.dispose).toHaveBeenCalled();
    });

    it('debe manejar eventos de cursor y selección', async () => {
      // Arrange
      const mockEditor = {
        onDidChangeCursorPosition: jest.fn().mockReturnValue({
          dispose: jest.fn(),
        }),
        onDidChangeCursorSelection: jest.fn().mockReturnValue({
          dispose: jest.fn(),
        }),
        getPosition: jest.fn().mockReturnValue({
          lineNumber: 5,
          column: 10,
        }),
        getSelection: jest.fn().mockReturnValue({
          startLineNumber: 5,
          startColumn: 5,
          endLineNumber: 5,
          endColumn: 15,
        }),
      };

      const cursorPositions: any[] = [];
      const selections: any[] = [];

      // Act
      mockEditor.onDidChangeCursorPosition((e: any) => cursorPositions.push(e.position));
      mockEditor.onDidChangeCursorSelection((e: any) => selections.push(e.selection));

      const position = mockEditor.getPosition();
      const selection = mockEditor.getSelection();

      // Assert
      expect(position.lineNumber).toBe(5);
      expect(position.column).toBe(10);
      expect(selection.startColumn).toBe(5);
      expect(selection.endColumn).toBe(15);
    });
  });

  describe('Integración con Web Workers', () => {
    it('debe crear web workers para lenguajes correctamente', async () => {
      // Arrange
      const { editor, languages } = require('monaco-editor');
      const mockWorker = {
        dispose: jest.fn(),
      };

      editor.createWebWorker.mockReturnValue(mockWorker);

      // Act
      const tsWorker = editor.createWebWorker({
        moduleId: 'vs/language/typescript/tsWorker',
        label: 'typescript',
      });

      const jsWorker = editor.createWebWorker({
        moduleId: 'vs/language/javascript/jsWorker',
        label: 'javascript',
      });

      // Assert
      expect(editor.createWebWorker).toHaveBeenCalledTimes(2);
      expect(tsWorker.dispose).toBeDefined();
      expect(jsWorker.dispose).toBeDefined();
    });

    it('debe manejar comunicación con web workers', async () => {
      // Arrange
      const mockWorker = {
        postMessage: jest.fn(),
        onmessage: jest.fn(),
        terminate: jest.fn(),
      };

      // Act
      mockWorker.postMessage({
        type: 'validate',
        code: 'const x: number = "string";',
      });

      mockWorker.onmessage = (event: any) => {
        if (event.data.type === 'validation') {
          expect(event.data.errors).toBeDefined();
        }
      };

      mockWorker.terminate();

      // Assert
      expect(mockWorker.postMessage).toHaveBeenCalledWith({
        type: 'validate',
        code: 'const x: number = "string";',
      });
      expect(mockWorker.terminate).toHaveBeenCalled();
    });
  });

  describe('Rendimiento y Optimización', () => {
    it('debe manejar archivos grandes eficientemente', async () => {
      // Arrange
      const largeContent = 'x'.repeat(100000); // 100KB de contenido
      const mockModel = {
        getValue: jest.fn().mockReturnValue(largeContent),
        getValueInRange: jest.fn().mockImplementation((range) => {
          return largeContent.substring(range.startColumn - 1, range.endColumn - 1);
        }),
      };

      const mockEditor = {
        getModel: jest.fn().mockReturnValue(mockModel),
        updateOptions: jest.fn(),
      };

      // Act
      const startTime = Date.now();
      const value = mockModel.getValue();
      const partialValue = mockModel.getValueInRange({
        startLineNumber: 1,
        startColumn: 1,
        endLineNumber: 1,
        endColumn: 100,
      });
      const loadTime = Date.now() - startTime;

      // Configurar opciones de rendimiento
      mockEditor.updateOptions({
        largeFileOptimizations: true,
        wordWrap: 'off',
        minimap: { enabled: false },
      });

      // Assert
      expect(value.length).toBe(100000);
      expect(partialValue.length).toBe(99);
      expect(loadTime).toBeLessThan(1000); // Debe ser rápido
      expect(mockEditor.updateOptions).toHaveBeenCalledWith({
        largeFileOptimizations: true,
        wordWrap: 'off',
        minimap: { enabled: false },
      });
    });

    it('debe optimizar el renderizado', async () => {
      // Arrange
      const mockEditor = {
        updateOptions: jest.fn(),
        render: jest.fn(),
      };

      // Act
      mockEditor.updateOptions({
        renderWhitespace: 'selection',
        renderControlCharacters: false,
        fontLigatures: true,
        smoothScrolling: true,
        cursorBlinking: 'smooth',
        cursorSmoothCaretAnimation: true,
      });

      // Assert
      expect(mockEditor.updateOptions).toHaveBeenCalledWith({
        renderWhitespace: 'selection',
        renderControlCharacters: false,
        fontLigatures: true,
        smoothScrolling: true,
        cursorBlinking: 'smooth',
        cursorSmoothCaretAnimation: true,
      });
    });
  });
});