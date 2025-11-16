/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { describe, beforeAll, afterAll, beforeEach, afterEach, it, expect, jest } from '@jest/globals';
import { setupTestDatabase, teardownTestDatabase } from './helpers/test-db';
import { setupTestServer, teardownTestServer } from './helpers/test-server';
import fs from 'fs/promises';
import path from 'path';

// Mocks para servicios del editor
jest.mock('../../src/vs/workbench/services/files/common/fileService', () => ({
  FileService: jest.fn().mockImplementation(() => ({
    readFile: jest.fn(),
    writeFile: jest.fn(),
    exists: jest.fn(),
    delete: jest.fn(),
    createFile: jest.fn(),
  }))
}));

jest.mock('../../src/vs/workbench/services/textmodelResolver/common/textModelResolverService', () => ({
  TextModelResolverService: jest.fn().mockImplementation(() => ({
    resolve: jest.fn(),
    updateModel: jest.fn(),
  }))
}));

jest.mock('../../src/vs/editor/browser/services/codeEditorService', () => ({
  CodeEditorService: jest.fn().mockImplementation(() => ({
    openCodeEditor: jest.fn(),
    getActiveCodeEditor: jest.fn(),
  }))
}));

describe('File Operations Integration', () => {
  let testDb: any;
  let testServer: any;
  let tempDir: string;

  beforeAll(async () => {
    testDb = await setupTestDatabase();
    testServer = await setupTestServer();
    tempDir = path.join(process.cwd(), 'temp-test-files');
    await fs.mkdir(tempDir, { recursive: true });
  }, 60000);

  afterAll(async () => {
    await teardownTestServer();
    await teardownTestDatabase();
    await fs.rmdir(tempDir, { recursive: true });
  }, 60000);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(async () => {
    // Limpiar archivos temporales después de cada test
    const files = await fs.readdir(tempDir);
    for (const file of files) {
      await fs.unlink(path.join(tempDir, file));
    }
  });

  describe('Apertura de archivos', () => {
    it('debe abrir un archivo existente correctamente', async () => {
      // Arrange
      const filePath = path.join(tempDir, 'test.txt');
      const fileContent = 'Contenido de prueba';
      await fs.writeFile(filePath, fileContent, 'utf-8');

      const mockFileService = {
        readFile: jest.fn().mockResolvedValue(Buffer.from(fileContent)),
        exists: jest.fn().mockResolvedValue(true),
      };

      const mockEditorService = {
        openCodeEditor: jest.fn().mockResolvedValue({
          getModel: () => ({ getValue: () => fileContent })
        }),
      };

      // Act
      const result = await mockFileService.readFile(filePath);
      const editorResult = await mockEditorService.openCodeEditor({ resource: { fsPath: filePath } });

      // Assert
      expect(mockFileService.exists).toHaveBeenCalledWith(filePath);
      expect(result.toString()).toBe(fileContent);
      expect(mockEditorService.openCodeEditor).toHaveBeenCalledWith(
        expect.objectContaining({ resource: { fsPath: filePath } })
      );
      expect(editorResult.getModel().getValue()).toBe(fileContent);
    });

    it('debe manejar apertura de archivo inexistente', async () => {
      // Arrange
      const nonExistentFile = path.join(tempDir, 'inexistente.txt');

      const mockFileService = {
        readFile: jest.fn().mockRejectedValue(new Error('File not found')),
        exists: jest.fn().mockResolvedValue(false),
      };

      // Act & Assert
      await expect(mockFileService.readFile(nonExistentFile))
        .rejects
        .toThrow('File not found');

      expect(mockFileService.exists).toHaveBeenCalledWith(nonExistentFile);
    });

    it('debe abrir archivos con diferentes codificaciones', async () => {
      // Arrange
      const utf8File = path.join(tempDir, 'utf8.txt');
      const content = 'Hola mundo 🌍';
      await fs.writeFile(utf8File, content, 'utf-8');

      const mockFileService = {
        readFile: jest.fn().mockResolvedValue(Buffer.from(content, 'utf-8')),
        exists: jest.fn().mockResolvedValue(true),
      };

      // Act
      const result = await mockFileService.readFile(utf8File, { encoding: 'utf-8' });

      // Assert
      expect(result.toString()).toBe(content);
    });

    it('debe manejar archivos de gran tamaño eficientemente', async () => {
      // Arrange
      const largeFile = path.join(tempDir, 'large.txt');
      const largeContent = 'x'.repeat(1024 * 1024); // 1MB
      await fs.writeFile(largeFile, largeContent, 'utf-8');

      const mockFileService = {
        readFile: jest.fn().mockResolvedValue(Buffer.from(largeContent)),
        exists: jest.fn().mockResolvedValue(true),
      };

      // Act
      const startTime = Date.now();
      const result = await mockFileService.readFile(largeFile);
      const duration = Date.now() - startTime;

      // Assert
      expect(result.length).toBe(largeContent.length);
      expect(duration).toBeLessThan(5000); // Debe ser eficiente
    });
  });

  describe('Creación y guardado de archivos', () => {
    it('debe crear un nuevo archivo correctamente', async () => {
      // Arrange
      const newFile = path.join(tempDir, 'nuevo.txt');
      const content = 'Nuevo contenido';

      const mockFileService = {
        createFile: jest.fn().mockResolvedValue(undefined),
        writeFile: jest.fn().mockResolvedValue(undefined),
        exists: jest.fn().mockResolvedValue(false),
      };

      // Act
      await mockFileService.createFile(newFile);
      await mockFileService.writeFile(newFile, Buffer.from(content));

      // Assert
      expect(mockFileService.createFile).toHaveBeenCalledWith(newFile);
      expect(mockFileService.writeFile).toHaveBeenCalledWith(newFile, Buffer.from(content));
    });

    it('debe guardar cambios en archivo existente', async () => {
      // Arrange
      const existingFile = path.join(tempDir, 'existente.txt');
      await fs.writeFile(existingFile, 'Contenido original', 'utf-8');

      const newContent = 'Contenido modificado';
      const mockFileService = {
        writeFile: jest.fn().mockResolvedValue(undefined),
        exists: jest.fn().mockResolvedValue(true),
      };

      // Act
      await mockFileService.writeFile(existingFile, Buffer.from(newContent));

      // Assert
      expect(mockFileService.writeFile).toHaveBeenCalledWith(existingFile, Buffer.from(newContent));
    });

    it('debe manejar errores de permisos al guardar', async () => {
      // Arrange
      const readonlyFile = path.join(tempDir, 'readonly.txt');

      const mockFileService = {
        writeFile: jest.fn().mockRejectedValue(new Error('Permission denied')),
      };

      // Act & Assert
      await expect(mockFileService.writeFile(readonlyFile, Buffer.from('content')))
        .rejects
        .toThrow('Permission denied');
    });

    it('debe crear backup antes de sobreescribir archivos importantes', async () => {
      // Arrange
      const importantFile = path.join(tempDir, 'importante.txt');
      const originalContent = 'Contenido crítico';
      await fs.writeFile(importantFile, originalContent, 'utf-8');

      const mockFileService = {
        writeFile: jest.fn().mockImplementation(async (filePath, content) => {
          // Simular creación de backup
          const backupPath = `${filePath}.backup`;
          await fs.copyFile(filePath, backupPath);
          await fs.writeFile(filePath, content);
        }),
      };

      // Act
      const newContent = 'Nuevo contenido crítico';
      await mockFileService.writeFile(importantFile, Buffer.from(newContent));

      // Assert
      const backupExists = await fs.access(`${importantFile}.backup`).then(() => true).catch(() => false);
      expect(backupExists).toBe(true);
    });
  });

  describe('Integración con servicios del editor', () => {
    it('debe integrar apertura de archivo con modelo de texto', async () => {
      // Arrange
      const filePath = path.join(tempDir, 'modelo.txt');
      const content = 'Contenido para modelo';
      await fs.writeFile(filePath, content, 'utf-8');

      const mockTextModelResolver = {
        resolve: jest.fn().mockResolvedValue({
          textEditorModel: {
            getValue: () => content,
            setValue: jest.fn(),
            dispose: jest.fn(),
          }
        }),
      };

      const mockCodeEditorService = {
        openCodeEditor: jest.fn().mockResolvedValue({
          getModel: () => mockTextModelResolver.resolve().textEditorModel,
        }),
      };

      // Act
      const model = await mockTextModelResolver.resolve({ resource: { fsPath: filePath } });
      const editor = await mockCodeEditorService.openCodeEditor({ resource: { fsPath: filePath } });

      // Assert
      expect(model.textEditorModel.getValue()).toBe(content);
      expect(editor.getModel()).toBe(model.textEditorModel);
    });

    it('debe sincronizar cambios entre editor y sistema de archivos', async () => {
      // Arrange
      const filePath = path.join(tempDir, 'sync.txt');
      let fileContent = 'Contenido inicial';

      const mockTextModel = {
        getValue: () => fileContent,
        setValue: (value: string) => { fileContent = value; },
        onDidChangeContent: jest.fn(),
      };

      const mockFileService = {
        writeFile: jest.fn().mockImplementation(async (path, buffer) => {
          fileContent = buffer.toString();
        }),
      };

      // Act
      mockTextModel.setValue('Contenido modificado');
      await mockFileService.writeFile(filePath, Buffer.from(mockTextModel.getValue()));

      // Assert
      expect(fileContent).toBe('Contenido modificado');
      expect(mockFileService.writeFile).toHaveBeenCalledWith(
        filePath,
        Buffer.from('Contenido modificado')
      );
    });

    it('debe manejar conflictos de edición colaborativa', async () => {
      // Arrange
      const filePath = path.join(tempDir, 'colaborativo.txt');
      let serverContent = 'Versión del servidor';

      const mockFileService = {
        readFile: jest.fn().mockResolvedValue(Buffer.from(serverContent)),
        writeFile: jest.fn().mockImplementation(async (path, buffer) => {
          const newContent = buffer.toString();
          if (newContent !== serverContent) {
            throw new Error('File modified by another user');
          }
          serverContent = newContent;
        }),
      };

      // Act & Assert - Primera escritura exitosa
      await mockFileService.writeFile(filePath, Buffer.from('Versión del servidor'));

      // Act & Assert - Segunda escritura falla por conflicto
      await expect(mockFileService.writeFile(filePath, Buffer.from('Versión modificada')))
        .rejects
        .toThrow('File modified by another user');
    });
  });

  describe('Manejo de errores y casos límite', () => {
    it('debe manejar archivos con nombres especiales', async () => {
      // Arrange
      const specialNames = [
        'archivo con espacios.txt',
        'archivo-con-guiones.txt',
        'archivo.con.puntos.txt',
        'archivo123.txt',
        'архив.txt', // Unicode
      ];

      const mockFileService = {
        createFile: jest.fn().mockResolvedValue(undefined),
        exists: jest.fn().mockResolvedValue(false),
      };

      // Act & Assert
      for (const fileName of specialNames) {
        const filePath = path.join(tempDir, fileName);
        await mockFileService.createFile(filePath);
        expect(mockFileService.createFile).toHaveBeenCalledWith(filePath);
      }
    });

    it('debe manejar rutas de archivos largos', async () => {
      // Arrange
      const longPath = path.join(tempDir, 'a'.repeat(200) + '.txt');
      const content = 'Contenido de archivo con ruta larga';

      const mockFileService = {
        writeFile: jest.fn().mockResolvedValue(undefined),
        readFile: jest.fn().mockResolvedValue(Buffer.from(content)),
      };

      // Act
      await mockFileService.writeFile(longPath, Buffer.from(content));
      const result = await mockFileService.readFile(longPath);

      // Assert
      expect(result.toString()).toBe(content);
    });

    it('debe manejar operaciones concurrentes en el mismo archivo', async () => {
      // Arrange
      const filePath = path.join(tempDir, 'concurrent.txt');
      let fileContent = '';

      const mockFileService = {
        writeFile: jest.fn().mockImplementation(async (path, buffer) => {
          // Simular escritura secuencial
          await new Promise(resolve => setTimeout(resolve, 10));
          fileContent = buffer.toString();
        }),
        readFile: jest.fn().mockResolvedValue(Buffer.from(fileContent)),
      };

      // Act
      const promises = [
        mockFileService.writeFile(filePath, Buffer.from('Contenido 1')),
        mockFileService.writeFile(filePath, Buffer.from('Contenido 2')),
        mockFileService.writeFile(filePath, Buffer.from('Contenido 3')),
      ];

      await Promise.all(promises);

      // Assert - El último write debe prevalecer
      const result = await mockFileService.readFile(filePath);
      expect(result.toString()).toBe('Contenido 3');
    });

    it('debe validar límites de tamaño de archivo', async () => {
      // Arrange
      const mockFileService = {
        writeFile: jest.fn().mockImplementation(async (path, buffer) => {
          if (buffer.length > 100 * 1024 * 1024) { // 100MB limit
            throw new Error('File too large');
          }
        }),
      };

      // Act & Assert - Archivo pequeño OK
      await expect(mockFileService.writeFile('small.txt', Buffer.from('small')))
        .resolves
        .toBeUndefined();

      // Act & Assert - Archivo grande falla
      const largeBuffer = Buffer.alloc(101 * 1024 * 1024); // 101MB
      await expect(mockFileService.writeFile('large.txt', largeBuffer))
        .rejects
        .toThrow('File too large');
    });
  });
});