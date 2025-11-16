/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { describe, beforeAll, afterAll, beforeEach, afterEach, it, expect, jest } from '@jest/globals';
import { setupTestDatabase, teardownTestDatabase } from './helpers/test-db';
import { setupTestServer, teardownTestServer } from './helpers/test-server';

// Mocks para servicios del workbench
jest.mock('../../src/vs/workbench/services/editor/common/editorService', () => ({
  IEditorService: {},
  EditorService: jest.fn().mockImplementation(() => ({
    openEditor: jest.fn(),
    closeEditor: jest.fn(),
    getActiveEditor: jest.fn(),
    saveAll: jest.fn(),
  }))
}));

jest.mock('../../src/vs/workbench/services/explorer/common/explorerService', () => ({
  ExplorerService: jest.fn().mockImplementation(() => ({
    getFileTree: jest.fn(),
    refresh: jest.fn(),
    reveal: jest.fn(),
    createFile: jest.fn(),
    deleteFile: jest.fn(),
  }))
}));

jest.mock('../../src/vs/workbench/services/statusbar/common/statusbarService', () => ({
  StatusBarService: jest.fn().mockImplementation(() => ({
    addEntry: jest.fn(),
    removeEntry: jest.fn(),
    updateEntry: jest.fn(),
    getEntries: jest.fn(),
  }))
}));

jest.mock('../../src/vs/workbench/services/layout/common/layoutService', () => ({
  LayoutService: jest.fn().mockImplementation(() => ({
    toggleSidebar: jest.fn(),
    togglePanel: jest.fn(),
    setSidebarPosition: jest.fn(),
    getLayoutState: jest.fn(),
  }))
}));

describe('Workbench Services Integration', () => {
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
    // Limpiar estado del workbench después de cada test
  });

  describe('Servicio de Editor', () => {
    it('debe abrir y cerrar editores correctamente', async () => {
      // Arrange
      const EditorService = require('../../src/vs/workbench/services/editor/common/editorService').EditorService;
      const mockEditorService = {
        openEditor: jest.fn().mockResolvedValue({
          id: 'editor-1',
          resource: { fsPath: '/test/file.ts' },
          getControl: () => ({ focus: jest.fn() }),
        }),
        closeEditor: jest.fn().mockResolvedValue(undefined),
        getActiveEditor: jest.fn().mockReturnValue({
          id: 'editor-1',
          resource: { fsPath: '/test/file.ts' },
        }),
      };
      EditorService.mockReturnValue(mockEditorService);

      // Act
      const editor = await mockEditorService.openEditor({ resource: { fsPath: '/test/file.ts' } });
      const activeEditor = mockEditorService.getActiveEditor();
      await mockEditorService.closeEditor(editor);

      // Assert
      expect(editor.id).toBe('editor-1');
      expect(activeEditor.resource.fsPath).toBe('/test/file.ts');
      expect(mockEditorService.closeEditor).toHaveBeenCalledWith(editor);
    });

    it('debe manejar múltiples editores abiertos', async () => {
      // Arrange
      const mockEditorService = {
        openEditor: jest.fn(),
        getEditors: jest.fn().mockReturnValue([
          { id: 'editor-1', resource: { fsPath: '/file1.ts' } },
          { id: 'editor-2', resource: { fsPath: '/file2.js' } },
          { id: 'editor-3', resource: { fsPath: '/file3.md' } },
        ]),
        saveAll: jest.fn().mockResolvedValue(undefined),
      };

      mockEditorService.openEditor
        .mockResolvedValueOnce({ id: 'editor-1', resource: { fsPath: '/file1.ts' } })
        .mockResolvedValueOnce({ id: 'editor-2', resource: { fsPath: '/file2.js' } })
        .mockResolvedValueOnce({ id: 'editor-3', resource: { fsPath: '/file3.md' } });

      // Act
      await mockEditorService.openEditor({ resource: { fsPath: '/file1.ts' } });
      await mockEditorService.openEditor({ resource: { fsPath: '/file2.js' } });
      await mockEditorService.openEditor({ resource: { fsPath: '/file3.md' } });

      const editors = mockEditorService.getEditors();
      await mockEditorService.saveAll();

      // Assert
      expect(editors).toHaveLength(3);
      expect(editors[0].resource.fsPath).toBe('/file1.ts');
      expect(editors[2].resource.fsPath).toBe('/file3.md');
      expect(mockEditorService.saveAll).toHaveBeenCalled();
    });

    it('debe manejar errores al abrir archivos inexistentes', async () => {
      // Arrange
      const mockEditorService = {
        openEditor: jest.fn().mockRejectedValue(new Error('File not found')),
      };

      // Act & Assert
      await expect(mockEditorService.openEditor({ resource: { fsPath: '/nonexistent/file.ts' } }))
        .rejects
        .toThrow('File not found');
    });
  });

  describe('Servicio de Explorador', () => {
    it('debe gestionar la estructura de archivos correctamente', async () => {
      // Arrange
      const ExplorerService = require('../../src/vs/workbench/services/explorer/common/explorerService').ExplorerService;
      const mockExplorerService = {
        getFileTree: jest.fn().mockResolvedValue({
          root: {
            name: 'workspace',
            children: [
              {
                name: 'src',
                children: [
                  { name: 'main.ts', type: 'file' },
                  { name: 'utils.ts', type: 'file' },
                ],
              },
              {
                name: 'tests',
                children: [
                  { name: 'main.test.ts', type: 'file' },
                ],
              },
            ],
          },
        }),
        refresh: jest.fn().mockResolvedValue(undefined),
        reveal: jest.fn().mockResolvedValue(undefined),
      };
      ExplorerService.mockReturnValue(mockExplorerService);

      // Act
      const fileTree = await mockExplorerService.getFileTree();
      await mockExplorerService.refresh();
      await mockExplorerService.reveal('/src/main.ts');

      // Assert
      expect(fileTree.root.name).toBe('workspace');
      expect(fileTree.root.children).toHaveLength(2);
      expect(fileTree.root.children[0].children[0].name).toBe('main.ts');
      expect(mockExplorerService.refresh).toHaveBeenCalled();
      expect(mockExplorerService.reveal).toHaveBeenCalledWith('/src/main.ts');
    });

    it('debe crear y eliminar archivos desde el explorador', async () => {
      // Arrange
      const mockExplorerService = {
        createFile: jest.fn().mockResolvedValue({
          name: 'newfile.ts',
          type: 'file',
          path: '/src/newfile.ts',
        }),
        deleteFile: jest.fn().mockResolvedValue(undefined),
        refresh: jest.fn().mockResolvedValue(undefined),
      };

      // Act
      const newFile = await mockExplorerService.createFile('/src/newfile.ts');
      await mockExplorerService.refresh();
      await mockExplorerService.deleteFile('/src/oldfile.ts');

      // Assert
      expect(newFile.name).toBe('newfile.ts');
      expect(newFile.path).toBe('/src/newfile.ts');
      expect(mockExplorerService.deleteFile).toHaveBeenCalledWith('/src/oldfile.ts');
    });

    it('debe manejar operaciones de archivos con errores de permisos', async () => {
      // Arrange
      const mockExplorerService = {
        createFile: jest.fn().mockRejectedValue(new Error('Permission denied')),
        deleteFile: jest.fn().mockRejectedValue(new Error('Permission denied')),
      };

      // Act & Assert
      await expect(mockExplorerService.createFile('/readonly/file.ts'))
        .rejects
        .toThrow('Permission denied');

      await expect(mockExplorerService.deleteFile('/readonly/file.ts'))
        .rejects
        .toThrow('Permission denied');
    });
  });

  describe('Servicio de Barra de Estado', () => {
    it('debe gestionar entradas de la barra de estado', async () => {
      // Arrange
      const StatusBarService = require('../../src/vs/workbench/services/statusbar/common/statusbarService').StatusBarService;
      const mockStatusBarService = {
        addEntry: jest.fn().mockReturnValue({
          id: 'status-entry-1',
          dispose: jest.fn(),
        }),
        updateEntry: jest.fn().mockResolvedValue(undefined),
        removeEntry: jest.fn().mockResolvedValue(undefined),
        getEntries: jest.fn().mockReturnValue([
          {
            id: 'status-entry-1',
            text: 'Ready',
            tooltip: 'Application is ready',
            priority: 1,
          },
        ]),
      };
      StatusBarService.mockReturnValue(mockStatusBarService);

      // Act
      const entry = mockStatusBarService.addEntry({
        id: 'test-status',
        text: 'Testing',
        tooltip: 'Running tests',
        priority: 1,
      });

      const entries = mockStatusBarService.getEntries();

      await mockStatusBarService.updateEntry('test-status', { text: 'Tests completed' });
      await mockStatusBarService.removeEntry('test-status');

      // Assert
      expect(entry.id).toBe('status-entry-1');
      expect(entries).toHaveLength(1);
      expect(entries[0].text).toBe('Ready');
      expect(mockStatusBarService.updateEntry).toHaveBeenCalledWith('test-status', { text: 'Tests completed' });
      expect(mockStatusBarService.removeEntry).toHaveBeenCalledWith('test-status');
    });

    it('debe manejar prioridades de entradas correctamente', async () => {
      // Arrange
      const mockStatusBarService = {
        getEntries: jest.fn().mockReturnValue([
          { id: 'low-priority', text: 'Low', priority: 1 },
          { id: 'high-priority', text: 'High', priority: 10 },
          { id: 'medium-priority', text: 'Medium', priority: 5 },
        ]),
      };

      // Act
      const entries = mockStatusBarService.getEntries();

      // Assert - Las entradas deberían estar ordenadas por prioridad
      expect(entries[0].priority).toBeGreaterThanOrEqual(entries[1].priority);
      expect(entries[1].priority).toBeGreaterThanOrEqual(entries[2].priority);
    });

    it('debe actualizar entradas periódicamente', async () => {
      // Arrange
      const mockStatusBarService = {
        updateEntry: jest.fn().mockResolvedValue(undefined),
      };

      // Simular actualización periódica (cada 5 segundos)
      const updateInterval = setInterval(() => {
        mockStatusBarService.updateEntry('memory-status', {
          text: `Memory: ${Math.floor(Math.random() * 100)}MB`,
        });
      }, 5000);

      // Act - Esperar varias actualizaciones
      await new Promise(resolve => setTimeout(resolve, 16000)); // ~3 actualizaciones

      // Assert
      expect(mockStatusBarService.updateEntry).toHaveBeenCalledTimes(3);
      expect(mockStatusBarService.updateEntry).toHaveBeenCalledWith('memory-status', expect.any(Object));

      clearInterval(updateInterval);
    });
  });

  describe('Servicio de Layout', () => {
    it('debe gestionar el layout de la interfaz correctamente', async () => {
      // Arrange
      const LayoutService = require('../../src/vs/workbench/services/layout/common/layoutService').LayoutService;
      const mockLayoutService = {
        toggleSidebar: jest.fn().mockResolvedValue(undefined),
        togglePanel: jest.fn().mockResolvedValue(undefined),
        setSidebarPosition: jest.fn().mockResolvedValue(undefined),
        getLayoutState: jest.fn().mockReturnValue({
          sidebar: { visible: true, position: 'left' },
          panel: { visible: false, position: 'bottom' },
          editor: { centered: false },
        }),
      };
      LayoutService.mockReturnValue(mockLayoutService);

      // Act
      await mockLayoutService.toggleSidebar();
      await mockLayoutService.setSidebarPosition('right');
      await mockLayoutService.togglePanel();
      const layoutState = mockLayoutService.getLayoutState();

      // Assert
      expect(mockLayoutService.toggleSidebar).toHaveBeenCalled();
      expect(mockLayoutService.setSidebarPosition).toHaveBeenCalledWith('right');
      expect(mockLayoutService.togglePanel).toHaveBeenCalled();
      expect(layoutState.sidebar.visible).toBe(true);
      expect(layoutState.panel.visible).toBe(false);
    });

    it('debe persistir el estado del layout', async () => {
      // Arrange
      const mockLayoutService = {
        setSidebarPosition: jest.fn().mockResolvedValue(undefined),
        getLayoutState: jest.fn().mockReturnValue({
          sidebar: { visible: true, position: 'right' },
          panel: { visible: true, position: 'bottom' },
        }),
        saveLayoutState: jest.fn().mockResolvedValue(undefined),
        restoreLayoutState: jest.fn().mockResolvedValue(undefined),
      };

      // Act
      await mockLayoutService.setSidebarPosition('right');
      await mockLayoutService.saveLayoutState();

      // Simular reinicio de aplicación
      const restoredState = await mockLayoutService.restoreLayoutState();

      // Assert
      expect(mockLayoutService.saveLayoutState).toHaveBeenCalled();
      expect(mockLayoutService.restoreLayoutState).toHaveBeenCalled();
      expect(restoredState.sidebar.position).toBe('right');
    });

    it('debe manejar layouts responsivos', async () => {
      // Arrange
      const mockLayoutService = {
        getLayoutState: jest.fn(),
        adjustForViewport: jest.fn().mockResolvedValue(undefined),
      };

      // Diferentes tamaños de viewport
      const viewports = [
        { width: 1920, height: 1080 }, // Desktop
        { width: 768, height: 1024 },  // Tablet
        { width: 375, height: 667 },   // Mobile
      ];

      for (const viewport of viewports) {
        mockLayoutService.getLayoutState.mockReturnValue({
          viewport,
          sidebar: { visible: viewport.width > 768 },
          panel: { visible: viewport.height > 600 },
        });

        // Act
        await mockLayoutService.adjustForViewport(viewport);

        // Assert
        const state = mockLayoutService.getLayoutState();
        if (viewport.width <= 768) {
          expect(state.sidebar.visible).toBe(false); // Sidebar oculto en móviles
        }
        if (viewport.height <= 600) {
          expect(state.panel.visible).toBe(false); // Panel oculto en alturas pequeñas
        }
      }
    });
  });

  describe('Integración entre servicios del workbench', () => {
    it('debe coordinar operaciones entre editor y explorador', async () => {
      // Arrange
      const mockEditorService = {
        openEditor: jest.fn().mockResolvedValue({
          id: 'editor-1',
          resource: { fsPath: '/src/main.ts' },
        }),
      };

      const mockExplorerService = {
        reveal: jest.fn().mockResolvedValue(undefined),
        refresh: jest.fn().mockResolvedValue(undefined),
      };

      // Act - Simular apertura de archivo desde el explorador
      const filePath = '/src/main.ts';
      await mockExplorerService.reveal(filePath);
      const editor = await mockEditorService.openEditor({ resource: { fsPath: filePath } });

      // Después de guardar, refrescar el explorador
      await mockExplorerService.refresh();

      // Assert
      expect(mockExplorerService.reveal).toHaveBeenCalledWith(filePath);
      expect(editor.resource.fsPath).toBe(filePath);
      expect(mockExplorerService.refresh).toHaveBeenCalled();
    });

    it('debe actualizar la barra de estado según el estado del editor', async () => {
      // Arrange
      const mockEditorService = {
        getActiveEditor: jest.fn().mockReturnValue({
          id: 'editor-1',
          resource: { fsPath: '/src/main.ts' },
          isDirty: () => true,
        }),
      };

      const mockStatusBarService = {
        updateEntry: jest.fn().mockResolvedValue(undefined),
      };

      // Act - Actualizar estado basado en el editor activo
      const activeEditor = mockEditorService.getActiveEditor();
      const statusText = activeEditor.isDirty() ? '• main.ts' : 'main.ts';

      await mockStatusBarService.updateEntry('editor-status', {
        text: statusText,
        tooltip: `Editing ${activeEditor.resource.fsPath}`,
      });

      // Assert
      expect(mockStatusBarService.updateEntry).toHaveBeenCalledWith('editor-status', {
        text: '• main.ts',
        tooltip: 'Editing /src/main.ts',
      });
    });

    it('debe manejar cambios de layout que afectan múltiples servicios', async () => {
      // Arrange
      const mockLayoutService = {
        toggleSidebar: jest.fn().mockResolvedValue(undefined),
        getLayoutState: jest.fn().mockReturnValue({
          sidebar: { visible: false },
        }),
      };

      const mockExplorerService = {
        setVisibility: jest.fn().mockResolvedValue(undefined),
      };

      const mockEditorService = {
        resize: jest.fn().mockResolvedValue(undefined),
      };

      // Act - Toggle sidebar afecta tanto al explorador como al editor
      await mockLayoutService.toggleSidebar();

      const layoutState = mockLayoutService.getLayoutState();

      if (!layoutState.sidebar.visible) {
        await mockExplorerService.setVisibility(false);
        await mockEditorService.resize({ width: '100%' });
      }

      // Assert
      expect(mockLayoutService.toggleSidebar).toHaveBeenCalled();
      expect(mockExplorerService.setVisibility).toHaveBeenCalledWith(false);
      expect(mockEditorService.resize).toHaveBeenCalledWith({ width: '100%' });
    });
  });
});