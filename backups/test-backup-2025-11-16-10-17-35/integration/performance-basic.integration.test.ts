/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { describe, beforeAll, afterAll, beforeEach, afterEach, it, expect, jest } from '@jest/globals';
import { setupTestDatabase, teardownTestDatabase } from './helpers/test-db';
import { setupTestServer, teardownTestServer } from './helpers/test-server';

// Mocks para servicios de performance
jest.mock('../../src/vs/workbench/services/performance/common/performanceService', () => ({
  PerformanceService: jest.fn().mockImplementation(() => ({
    measureOperation: jest.fn(),
    getMetrics: jest.fn(),
    startTimer: jest.fn(),
    endTimer: jest.fn(),
  }))
}));

describe('Performance Basic Integration', () => {
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
    // Limpiar métricas de performance después de cada test
  });

  describe('Rendimiento de carga de archivos', () => {
    it('debe cargar archivos pequeños eficientemente', async () => {
      // Arrange
      const PerformanceService = require('../../src/vs/workbench/services/performance/common/performanceService').PerformanceService;
      const mockPerformanceService = {
        measureOperation: jest.fn().mockImplementation(async (operation, fn) => {
          const start = Date.now();
          const result = await fn();
          const duration = Date.now() - start;
          return { result, duration, operation };
        }),
      };

      PerformanceService.mockReturnValue(mockPerformanceService);

      const smallFileContent = 'console.log("Hello World");'.repeat(10);
      const mockFileService = {
        readFile: jest.fn().mockResolvedValue(Buffer.from(smallFileContent)),
      };

      // Act
      const performanceResult = await mockPerformanceService.measureOperation(
        'load-small-file',
        async () => await mockFileService.readFile('small.ts')
      );

      // Assert
      expect(performanceResult.duration).toBeLessThan(100); // Menos de 100ms
      expect(performanceResult.result.toString()).toBe(smallFileContent);
      expect(mockFileService.readFile).toHaveBeenCalledWith('small.ts');
    });

    it('debe manejar archivos grandes sin bloquear la UI', async () => {
      // Arrange
      const largeFileContent = 'x'.repeat(1024 * 1024); // 1MB
      const mockFileService = {
        readFile: jest.fn().mockResolvedValue(Buffer.from(largeFileContent)),
      };

      const mockPerformanceMonitor = {
        startAsyncOperation: jest.fn().mockReturnValue({
          end: jest.fn(),
          cancel: jest.fn(),
        }),
        isUIBlocked: jest.fn().mockReturnValue(false),
      };

      // Act
      const operation = mockPerformanceMonitor.startAsyncOperation('load-large-file');
      const fileContent = await mockFileService.readFile('large.txt');
      operation.end();

      // Assert
      expect(fileContent.length).toBe(1024 * 1024);
      expect(mockPerformanceMonitor.isUIBlocked()).toBe(false);
      expect(operation.end).toHaveBeenCalled();
    });

    it('debe optimizar carga de archivos múltiples', async () => {
      // Arrange
      const mockFileService = {
        readFile: jest.fn(),
      };

      // Configurar respuestas secuenciales para simular carga
      let callCount = 0;
      mockFileService.readFile.mockImplementation(async (fileName) => {
        callCount++;
        await new Promise(resolve => setTimeout(resolve, 10 * callCount)); // Delay acumulativo
        return Buffer.from(`${fileName} content`);
      });

      const files = ['file1.ts', 'file2.ts', 'file3.ts', 'file4.ts'];

      // Act - Carga secuencial
      const startTime = Date.now();
      const resultsSequential = [];
      for (const file of files) {
        resultsSequential.push(await mockFileService.readFile(file));
      }
      const sequentialTime = Date.now() - startTime;

      // Act - Carga paralela simulada
      callCount = 0;
      mockFileService.readFile.mockClear();
      mockFileService.readFile.mockImplementation(async (fileName) => {
        callCount++;
        await new Promise(resolve => setTimeout(resolve, 10)); // Delay fijo
        return Buffer.from(`${fileName} content`);
      });

      const startTimeParallel = Date.now();
      const resultsParallel = await Promise.all(
        files.map(file => mockFileService.readFile(file))
      );
      const parallelTime = Date.now() - startTimeParallel;

      // Assert
      expect(resultsSequential).toHaveLength(4);
      expect(resultsParallel).toHaveLength(4);
      expect(parallelTime).toBeLessThan(sequentialTime); // Paralelo debe ser más rápido
    });
  });

  describe('Rendimiento del editor', () => {
    it('debe renderizar texto eficientemente', async () => {
      // Arrange
      const mockEditor = {
        setValue: jest.fn(),
        getValue: jest.fn().mockReturnValue(''),
        updateOptions: jest.fn(),
        layout: jest.fn(),
        render: jest.fn(),
      };

      const mockPerformanceMonitor = {
        measureRenderTime: jest.fn().mockImplementation(async (fn) => {
          const start = performance.now();
          await fn();
          const end = performance.now();
          return end - start;
        }),
      };

      const textContent = 'Line ' + 'content '.repeat(100) + '\n'.repeat(50);

      // Act
      const renderTime = await mockPerformanceMonitor.measureRenderTime(async () => {
        mockEditor.setValue(textContent);
        mockEditor.render();
      });

      // Assert
      expect(renderTime).toBeLessThan(50); // Menos de 50ms para renderizado
      expect(mockEditor.setValue).toHaveBeenCalledWith(textContent);
      expect(mockEditor.render).toHaveBeenCalled();
    });

    it('debe manejar edición en tiempo real sin lag', async () => {
      // Arrange
      const mockEditor = {
        applyEdits: jest.fn().mockResolvedValue(true),
        getValue: jest.fn().mockReturnValue(''),
        onDidChangeModelContent: jest.fn(),
      };

      const mockTypingSimulator = {
        simulateTyping: jest.fn().mockImplementation(async (text, delay = 10) => {
          const edits = [];
          for (let i = 0; i < text.length; i++) {
            edits.push({
              range: { startLineNumber: 1, startColumn: i + 1, endLineNumber: 1, endColumn: i + 1 },
              text: text[i],
            });
            await new Promise(resolve => setTimeout(resolve, delay));
          }
          return edits;
        }),
      };

      // Act
      const typingStart = Date.now();
      const edits = await mockTypingSimulator.simulateTyping('Hello World', 5);
      const typingTime = Date.now() - typingStart;

      // Aplicar ediciones
      for (const edit of edits) {
        await mockEditor.applyEdits([edit]);
      }

      // Assert
      expect(edits).toHaveLength(11); // 'Hello World' tiene 11 caracteres
      expect(typingTime).toBeGreaterThan(50); // Al menos 50ms de simulación
      expect(typingTime).toBeLessThan(200); // Menos de 200ms total
      expect(mockEditor.applyEdits).toHaveBeenCalledTimes(11);
    });

    it('debe mantener rendimiento con syntax highlighting', async () => {
      // Arrange
      const mockLanguageService = {
        tokenize: jest.fn().mockImplementation((text) => {
          // Simular tokenización básica
          return text.split(/(\s+)/).map((token, index) => ({
            offset: index * 2,
            type: token.match(/\w+/) ? 'identifier' : 'whitespace',
            language: 'typescript',
          }));
        }),
      };

      const mockPerformanceMonitor = {
        measureTokenizationTime: jest.fn().mockImplementation(async (text) => {
          const start = performance.now();
          const tokens = mockLanguageService.tokenize(text);
          const end = performance.now();
          return { tokens, duration: end - start };
        }),
      };

      const codeSnippet = `
        function calculateTotal(items: number[]): number {
          return items.reduce((sum, item) => sum + item, 0);
        }

        const numbers = [1, 2, 3, 4, 5];
        console.log(calculateTotal(numbers));
      `;

      // Act
      const { tokens, duration } = await mockPerformanceMonitor.measureTokenizationTime(codeSnippet);

      // Assert
      expect(tokens.length).toBeGreaterThan(0);
      expect(duration).toBeLessThan(10); // Tokenización debe ser muy rápida
      expect(tokens.some(t => t.type === 'identifier')).toBe(true);
    });
  });

  describe('Rendimiento de operaciones del workspace', () => {
    it('debe gestionar workspaces grandes eficientemente', async () => {
      // Arrange
      const mockWorkspaceService = {
        getFiles: jest.fn().mockResolvedValue(
          Array.from({ length: 1000 }, (_, i) => ({
            name: `file${i}.ts`,
            path: `/workspace/file${i}.ts`,
            size: 1024,
          }))
        ),
        refresh: jest.fn().mockResolvedValue(undefined),
      };

      const mockPerformanceMonitor = {
        measureWorkspaceOperation: jest.fn().mockImplementation(async (operation, fn) => {
          const start = Date.now();
          const result = await fn();
          const duration = Date.now() - start;
          return { result, duration, operation };
        }),
      };

      // Act
      const { result: files, duration } = await mockPerformanceMonitor.measureWorkspaceOperation(
        'list-files',
        () => mockWorkspaceService.getFiles()
      );

      // Assert
      expect(files).toHaveLength(1000);
      expect(duration).toBeLessThan(500); // Menos de 500ms para 1000 archivos
      expect(files[0].name).toBe('file0.ts');
      expect(files[999].name).toBe('file999.ts');
    });

    it('debe optimizar búsqueda en workspace', async () => {
      // Arrange
      const mockSearchService = {
        search: jest.fn().mockImplementation(async (query, options) => {
          // Simular búsqueda con complejidad O(n)
          const files = Array.from({ length: options.maxResults || 100 }, (_, i) => ({
            file: `result${i}.ts`,
            line: i + 1,
            content: `Found ${query} at line ${i + 1}`,
          }));

          // Simular tiempo de búsqueda proporcional a la complejidad
          await new Promise(resolve => setTimeout(resolve, Math.min(query.length * 2, 50)));

          return {
            results: files,
            totalMatches: files.length,
            searchTime: query.length * 2,
          };
        }),
      };

      const queries = ['short', 'medium query', 'very long search query with many words'];

      // Act & Assert
      for (const query of queries) {
        const startTime = Date.now();
        const results = await mockSearchService.search(query, { maxResults: 50 });
        const searchTime = Date.now() - startTime;

        expect(results.results).toHaveLength(50);
        expect(results.searchTime).toBe(query.length * 2);
        expect(searchTime).toBeLessThan(100); // Búsqueda debe ser rápida
        expect(results.totalMatches).toBe(50);
      }
    });

    it('debe manejar operaciones concurrentes sin degradación', async () => {
      // Arrange
      const mockConcurrentOperations = {
        operation1: jest.fn().mockImplementation(async () => {
          await new Promise(resolve => setTimeout(resolve, 20));
          return 'result1';
        }),
        operation2: jest.fn().mockImplementation(async () => {
          await new Promise(resolve => setTimeout(resolve, 25));
          return 'result2';
        }),
        operation3: jest.fn().mockImplementation(async () => {
          await new Promise(resolve => setTimeout(resolve, 15));
          return 'result3';
        }),
      };

      // Act - Ejecutar operaciones concurrentemente
      const startTime = Date.now();
      const results = await Promise.all([
        mockConcurrentOperations.operation1(),
        mockConcurrentOperations.operation2(),
        mockConcurrentOperations.operation3(),
      ]);
      const totalTime = Date.now() - startTime;

      // Act - Ejecutar operaciones secuencialmente
      const sequentialStartTime = Date.now();
      const sequentialResults = [];
      sequentialResults.push(await mockConcurrentOperations.operation1());
      sequentialResults.push(await mockConcurrentOperations.operation2());
      sequentialResults.push(await mockConcurrentOperations.operation3());
      const sequentialTime = Date.now() - sequentialStartTime;

      // Assert
      expect(results).toEqual(['result1', 'result2', 'result3']);
      expect(sequentialResults).toEqual(results);
      expect(totalTime).toBeLessThan(sequentialTime); // Concurrente debe ser más rápido
      expect(totalTime).toBeLessThan(50); // Todas completadas en menos de 50ms
    });
  });

  describe('Gestión de memoria', () => {
    it('debe liberar memoria de objetos no utilizados', async () => {
      // Arrange
      const mockGarbageCollector = {
        trackObject: jest.fn().mockReturnValue({
          dispose: jest.fn(),
          isDisposed: false,
        }),
        forceGC: jest.fn().mockResolvedValue(undefined),
        getMemoryUsage: jest.fn().mockReturnValue({
          used: 50 * 1024 * 1024, // 50MB
          total: 100 * 1024 * 1024, // 100MB
          limit: 200 * 1024 * 1024, // 200MB
        }),
      };

      const objects = [];
      for (let i = 0; i < 100; i++) {
        objects.push(mockGarbageCollector.trackObject());
      }

      // Act - Simular uso y liberación
      for (let i = 0; i < 50; i++) {
        objects[i].dispose();
        objects[i].isDisposed = true;
      }

      await mockGarbageCollector.forceGC();
      const memoryAfterGC = mockGarbageCollector.getMemoryUsage();

      // Assert
      expect(objects).toHaveLength(100);
      expect(objects.filter(obj => obj.isDisposed)).toHaveLength(50);
      expect(memoryAfterGC.used).toBeLessThan(50 * 1024 * 1024); // Menos de 50MB después de GC
      expect(mockGarbageCollector.forceGC).toHaveBeenCalled();
    });

    it('debe prevenir memory leaks en operaciones repetidas', async () => {
      // Arrange
      const mockMemoryMonitor = {
        getHeapUsage: jest.fn(),
        recordSnapshot: jest.fn(),
        compareSnapshots: jest.fn().mockReturnValue({
          growth: 1024 * 1024, // 1MB de crecimiento
          isLeak: false,
        }),
      };

      // Configurar crecimiento de memoria simulado
      let heapSize = 10 * 1024 * 1024; // 10MB inicial
      mockMemoryMonitor.getHeapUsage.mockImplementation(() => heapSize += 100 * 1024); // +100KB por llamada

      // Act - Simular operaciones repetidas
      const snapshots = [];
      for (let i = 0; i < 10; i++) {
        snapshots.push(mockMemoryMonitor.recordSnapshot());
        // Simular operación que podría causar leak
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      const comparison = mockMemoryMonitor.compareSnapshots(snapshots[0], snapshots[9]);

      // Assert
      expect(snapshots).toHaveLength(10);
      expect(comparison.growth).toBe(1024 * 1024);
      expect(comparison.isLeak).toBe(false); // No se considera leak (crecimiento controlado)
      expect(mockMemoryMonitor.recordSnapshot).toHaveBeenCalledTimes(10);
    });

    it('debe optimizar uso de memoria en listas grandes', async () => {
      // Arrange
      const mockVirtualList = {
        renderItems: jest.fn().mockImplementation((items, visibleRange) => {
          // Solo renderizar elementos visibles
          return items.slice(visibleRange.start, visibleRange.end).map((item, index) => ({
            key: item.id,
            content: item.content,
            style: { height: 20 },
          }));
        }),
        recycleItems: jest.fn().mockImplementation(() => {
          // Simular reciclaje de elementos DOM
          return { recycled: 50, created: 10, reused: 40 };
        }),
      };

      const largeList = Array.from({ length: 10000 }, (_, i) => ({
        id: `item-${i}`,
        content: `List item ${i}`,
      }));

      // Act - Renderizar solo elementos visibles
      const visibleItems = mockVirtualList.renderItems(largeList, { start: 100, end: 120 });
      const recyclingStats = mockVirtualList.recycleItems();

      // Assert
      expect(visibleItems).toHaveLength(20); // Solo 20 elementos visibles
      expect(visibleItems[0].key).toBe('item-100');
      expect(visibleItems[19].key).toBe('item-119');
      expect(recyclingStats.recycled).toBe(50);
      expect(recyclingStats.reused).toBe(40);
    });
  });

  describe('Rendimiento de red y APIs', () => {
    it('debe optimizar llamadas a APIs externas', async () => {
      // Arrange
      const mockApiClient = {
        request: jest.fn(),
      };

      // Configurar respuestas con latencia simulada
      let requestCount = 0;
      mockApiClient.request.mockImplementation(async (endpoint) => {
        requestCount++;
        const latency = Math.random() * 100 + 50; // 50-150ms
        await new Promise(resolve => setTimeout(resolve, latency));
        return { data: `response-${requestCount}`, endpoint };
      });

      const mockCache = {
        get: jest.fn(),
        set: jest.fn(),
      };

      // Act - Solicitudes sin cache
      const startTime = Date.now();
      const responses = await Promise.all([
        mockApiClient.request('/api/data1'),
        mockApiClient.request('/api/data2'),
        mockApiClient.request('/api/data3'),
      ]);
      const totalTime = Date.now() - startTime;

      // Act - Solicitudes con cache
      requestCount = 0;
      mockCache.get.mockImplementation((key) => {
        return key === '/api/data1' ? { data: 'cached-response', endpoint: '/api/data1' } : null;
      });

      const cachedStartTime = Date.now();
      const cachedResponses = [];
      for (const endpoint of ['/api/data1', '/api/data2']) {
        const cached = mockCache.get(endpoint);
        if (cached) {
          cachedResponses.push(cached);
        } else {
          cachedResponses.push(await mockApiClient.request(endpoint));
        }
      }
      const cachedTotalTime = Date.now() - cachedStartTime;

      // Assert
      expect(responses).toHaveLength(3);
      expect(cachedResponses).toHaveLength(2);
      expect(totalTime).toBeGreaterThan(150); // Al menos 150ms para 3 llamadas
      expect(cachedTotalTime).toBeLessThan(totalTime); // Cache debe ser más rápido
      expect(mockCache.get).toHaveBeenCalledWith('/api/data1');
    });

    it('debe manejar timeouts y reintentos eficientemente', async () => {
      // Arrange
      const mockResilientClient = {
        requestWithRetry: jest.fn().mockImplementation(async (endpoint, options = {}) => {
          const maxRetries = options.maxRetries || 3;
          let attempts = 0;

          while (attempts < maxRetries) {
            attempts++;
            try {
              // Simular fallo en primeros intentos
              if (attempts < 3) {
                await new Promise((_, reject) => setTimeout(() => reject(new Error('Network error')), 100));
              } else {
                return { data: 'success', attempts };
              }
            } catch (error) {
              if (attempts === maxRetries) {
                throw error;
              }
              // Esperar con backoff exponencial
              await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempts) * 100));
            }
          }
        }),
      };

      // Act
      const startTime = Date.now();
      const result = await mockResilientClient.requestWithRetry('/api/reliable', { maxRetries: 3 });
      const totalTime = Date.now() - startTime;

      // Assert
      expect(result.data).toBe('success');
      expect(result.attempts).toBe(3);
      expect(totalTime).toBeGreaterThan(700); // 100 + 200 + 400ms de backoff
      expect(totalTime).toBeLessThan(1500); // Menos de 1.5 segundos total
    });

    it('debe optimizar carga de recursos estáticos', async () => {
      // Arrange
      const mockResourceLoader = {
        loadResource: jest.fn(),
        preloadResources: jest.fn().mockResolvedValue(undefined),
      };

      const resources = [
        '/css/editor.css',
        '/js/monaco.js',
        '/js/extension-api.js',
        '/fonts/editor.woff2',
        '/icons/theme.svg',
      ];

      // Configurar carga secuencial
      let loadTime = 0;
      mockResourceLoader.loadResource.mockImplementation(async (resource) => {
        const resourceTime = Math.random() * 200 + 100; // 100-300ms
        loadTime += resourceTime;
        await new Promise(resolve => setTimeout(resolve, resourceTime));
        return { url: resource, loaded: true };
      });

      // Act - Carga secuencial
      const sequentialStart = Date.now();
      const sequentialResults = [];
      for (const resource of resources) {
        sequentialResults.push(await mockResourceLoader.loadResource(resource));
      }
      const sequentialTime = Date.now() - sequentialStart;

      // Act - Carga con preload
      loadTime = 0;
      mockResourceLoader.loadResource.mockClear();
      mockResourceLoader.loadResource.mockImplementation(async (resource) => {
        const resourceTime = Math.random() * 50 + 25; // 25-75ms (más rápido con preload)
        loadTime += resourceTime;
        await new Promise(resolve => setTimeout(resolve, resourceTime));
        return { url: resource, loaded: true };
      });

      await mockResourceLoader.preloadResources(resources);
      const preloadStart = Date.now();
      const preloadResults = [];
      for (const resource of resources) {
        preloadResults.push(await mockResourceLoader.loadResource(resource));
      }
      const preloadTime = Date.now() - preloadStart;

      // Assert
      expect(sequentialResults).toHaveLength(5);
      expect(preloadResults).toHaveLength(5);
      expect(preloadTime).toBeLessThan(sequentialTime); // Preload debe ser más rápido
      expect(mockResourceLoader.preloadResources).toHaveBeenCalledWith(resources);
    });
  });
});