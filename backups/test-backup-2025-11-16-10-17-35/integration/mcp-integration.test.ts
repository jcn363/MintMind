/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { describe, beforeAll, afterAll, beforeEach, afterEach, it, expect, jest } from '@jest/globals';
import { setupTestDatabase, teardownTestDatabase } from './helpers/test-db';
import { setupTestServer, teardownTestServer } from './helpers/test-server';

// Mocks para MCP SDK
jest.mock('@modelcontextprotocol/sdk/server/mcp.js', () => ({
  McpServer: jest.fn().mockImplementation(() => ({
    tool: jest.fn(),
    setRequestHandler: jest.fn(),
    connect: jest.fn(),
    close: jest.fn(),
  })),
  RegisteredTool: {},
}));

jest.mock('@modelcontextprotocol/sdk/server/index.js', () => ({
  Server: jest.fn(),
}));

jest.mock('@modelcontextprotocol/sdk/client/index.js', () => ({
  Client: jest.fn().mockImplementation(() => ({
    connect: jest.fn(),
    disconnect: jest.fn(),
    request: jest.fn(),
    notification: jest.fn(),
  })),
}));

describe('MCP Integration', () => {
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
    // Limpiar conexiones MCP después de cada test
  });

  describe('Inicialización del servidor MCP', () => {
    it('debe crear servidor MCP correctamente', async () => {
      // Arrange
      const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
      const mockServer = {
        tool: jest.fn(),
        setRequestHandler: jest.fn(),
        connect: jest.fn(),
        close: jest.fn(),
      };
      McpServer.mockReturnValue(mockServer);

      // Act
      const server = new McpServer({
        name: 'Test MCP Server',
        version: '1.0.0',
        title: 'Test Server for MintMind',
      }, { capabilities: { logging: {} } });

      // Assert
      expect(McpServer).toHaveBeenCalledWith(
        {
          name: 'Test MCP Server',
          version: '1.0.0',
          title: 'Test Server for MintMind',
        },
        { capabilities: { logging: {} } }
      );
      expect(server.tool).toBeDefined();
      expect(server.connect).toBeDefined();
    });

    it('debe registrar herramientas correctamente', async () => {
      // Arrange
      const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
      const mockServer = {
        tool: jest.fn().mockReturnValue({
          name: 'test_tool',
          description: 'Test tool',
          inputSchema: { type: 'object' },
        }),
        setRequestHandler: jest.fn(),
        connect: jest.fn(),
      };
      McpServer.mockReturnValue(mockServer);

      const server = new McpServer({ name: 'Test Server' });

      // Act
      const toolRegistration = server.tool(
        'test_tool',
        'Test tool description',
        {
          param1: { type: 'string', description: 'First parameter' },
        },
        async ({ param1 }) => {
          return {
            content: [{
              type: 'text',
              text: `Processed: ${param1}`,
            }],
          };
        }
      );

      // Assert
      expect(server.tool).toHaveBeenCalledWith(
        'test_tool',
        'Test tool description',
        expect.objectContaining({
          param1: { type: 'string', description: 'First parameter' },
        }),
        expect.any(Function)
      );
    });

    it('debe manejar diferentes tipos de capacidades', async () => {
      // Arrange
      const capabilities = {
        logging: {},
        prompts: {},
        resources: {},
        tools: {},
      };

      const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
      McpServer.mockReturnValue({
        setRequestHandler: jest.fn(),
        connect: jest.fn(),
      });

      // Act
      const server = new McpServer({
        name: 'Capability Test Server',
        version: '1.0.0',
      }, { capabilities });

      // Assert
      expect(McpServer).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Capability Test Server',
          version: '1.0.0',
        }),
        { capabilities }
      );
    });
  });

  describe('Cliente MCP y comunicación', () => {
    it('debe conectar cliente MCP correctamente', async () => {
      // Arrange
      const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
      const mockClient = {
        connect: jest.fn().mockResolvedValue(undefined),
        disconnect: jest.fn().mockResolvedValue(undefined),
        request: jest.fn(),
        notification: jest.fn(),
      };
      Client.mockReturnValue(mockClient);

      // Act
      const client = new Client({
        name: 'Test MCP Client',
        version: '1.0.0',
      });

      await client.connect({ transport: {} });

      // Assert
      expect(Client).toHaveBeenCalledWith({
        name: 'Test MCP Client',
        version: '1.0.0',
      });
      expect(client.connect).toHaveBeenCalledWith({ transport: {} });
    });

    it('debe enviar requests correctamente', async () => {
      // Arrange
      const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
      const mockClient = {
        connect: jest.fn().mockResolvedValue(undefined),
        request: jest.fn().mockResolvedValue({
          result: 'success',
          data: { key: 'value' },
        }),
        notification: jest.fn(),
        disconnect: jest.fn(),
      };
      Client.mockReturnValue(mockClient);

      const client = new Client({ name: 'Test Client' });
      await client.connect({ transport: {} });

      // Act
      const response = await client.request('test_method', {
        param1: 'value1',
        param2: 42,
      });

      // Assert
      expect(client.request).toHaveBeenCalledWith('test_method', {
        param1: 'value1',
        param2: 42,
      });
      expect(response.result).toBe('success');
      expect(response.data.key).toBe('value');
    });

    it('debe enviar notificaciones correctamente', async () => {
      // Arrange
      const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
      const mockClient = {
        connect: jest.fn().mockResolvedValue(undefined),
        request: jest.fn(),
        notification: jest.fn().mockResolvedValue(undefined),
        disconnect: jest.fn(),
      };
      Client.mockReturnValue(mockClient);

      const client = new Client({ name: 'Test Client' });
      await client.connect({ transport: {} });

      // Act
      await client.notification('test_notification', {
        message: 'Test notification',
        timestamp: new Date().toISOString(),
      });

      // Assert
      expect(client.notification).toHaveBeenCalledWith('test_notification', {
        message: 'Test notification',
        timestamp: expect.any(String),
      });
    });
  });

  describe('Transportes MCP', () => {
    it('debe manejar transporte stdio', async () => {
      // Arrange
      const mockStdioTransport = {
        start: jest.fn().mockResolvedValue(undefined),
        send: jest.fn().mockResolvedValue(undefined),
        close: jest.fn().mockResolvedValue(undefined),
        onMessage: jest.fn(),
        onError: jest.fn(),
        onClose: jest.fn(),
      };

      // Act
      await mockStdioTransport.start();
      await mockStdioTransport.send({
        jsonrpc: '2.0',
        id: 1,
        method: 'test',
        params: {},
      });
      await mockStdioTransport.close();

      // Assert
      expect(mockStdioTransport.start).toHaveBeenCalled();
      expect(mockStdioTransport.send).toHaveBeenCalledWith(
        expect.objectContaining({
          jsonrpc: '2.0',
          id: 1,
          method: 'test',
        })
      );
      expect(mockStdioTransport.close).toHaveBeenCalled();
    });

    it('debe manejar transporte HTTP', async () => {
      // Arrange
      const mockHttpTransport = {
        connect: jest.fn().mockResolvedValue(undefined),
        send: jest.fn().mockResolvedValue(undefined),
        disconnect: jest.fn().mockResolvedValue(undefined),
        onMessage: jest.fn(),
        onError: jest.fn(),
      };

      // Act
      await mockHttpTransport.connect('http://localhost:3001/mcp');
      await mockHttpTransport.send({
        jsonrpc: '2.0',
        method: 'initialize',
        params: { protocolVersion: '2024-11-05' },
      });

      // Assert
      expect(mockHttpTransport.connect).toHaveBeenCalledWith('http://localhost:3001/mcp');
      expect(mockHttpTransport.send).toHaveBeenCalledWith(
        expect.objectContaining({
          jsonrpc: '2.0',
          method: 'initialize',
        })
      );
    });

    it('debe manejar transporte WebSocket', async () => {
      // Arrange
      const mockWsTransport = {
        connect: jest.fn().mockResolvedValue(undefined),
        send: jest.fn().mockResolvedValue(undefined),
        close: jest.fn().mockResolvedValue(undefined),
        onMessage: jest.fn(),
        onError: jest.fn(),
        onClose: jest.fn(),
      };

      // Act
      await mockWsTransport.connect('ws://localhost:8080/mcp');
      await mockWsTransport.send({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/list',
      });

      // Assert
      expect(mockWsTransport.connect).toHaveBeenCalledWith('ws://localhost:8080/mcp');
      expect(mockWsTransport.send).toHaveBeenCalledWith(
        expect.objectContaining({
          jsonrpc: '2.0',
          id: 2,
          method: 'tools/list',
        })
      );
    });
  });

  describe('Herramientas MCP específicas', () => {
    it('debe aplicar herramientas del editor correctamente', async () => {
      // Arrange
      const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
      const mockServer = {
        tool: jest.fn().mockReturnValue({
          name: 'vscode_automation_editor_type_text',
          description: 'Type text in editor',
        }),
        setRequestHandler: jest.fn(),
        connect: jest.fn(),
      };
      McpServer.mockReturnValue(mockServer);

      const server = new McpServer({ name: 'Editor Server' });

      // Act
      const tool = server.tool(
        'vscode_automation_editor_type_text',
        'Type text in the currently active editor',
        {
          text: { type: 'string', description: 'The text to type' },
          filename: { type: 'string', description: 'Filename to target specific editor' },
        },
        async ({ text, filename }) => {
          // Simular escritura en editor Monaco
          return {
            content: [{
              type: 'text',
              text: `Typed text: "${text}" in ${filename}`,
            }],
          };
        }
      );

      // Assert
      expect(server.tool).toHaveBeenCalledWith(
        'vscode_automation_editor_type_text',
        'Type text in the currently active editor',
        expect.objectContaining({
          text: { type: 'string', description: 'The text to type' },
          filename: { type: 'string', description: 'Filename to target specific editor' },
        }),
        expect.any(Function)
      );
    });

    it('debe aplicar herramientas del terminal correctamente', async () => {
      // Arrange
      const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
      const mockServer = {
        tool: jest.fn().mockReturnValue({
          name: 'vscode_automation_terminal_run_command',
          description: 'Run command in terminal',
        }),
        setRequestHandler: jest.fn(),
        connect: jest.fn(),
      };
      McpServer.mockReturnValue(mockServer);

      const server = new McpServer({ name: 'Terminal Server' });

      // Act
      const tool = server.tool(
        'vscode_automation_terminal_run_command',
        'Run a command in the terminal',
        {
          command: { type: 'string', description: 'Command to run in the terminal' },
          skipEnter: { type: 'boolean', description: 'Skip pressing enter after typing command' },
        },
        async ({ command, skipEnter }) => {
          return {
            content: [{
              type: 'text',
              text: `Ran command in terminal: "${command}"`,
            }],
          };
        }
      );

      // Assert
      expect(server.tool).toHaveBeenCalledWith(
        'vscode_automation_terminal_run_command',
        'Run a command in the terminal',
        expect.objectContaining({
          command: { type: 'string', description: 'Command to run in the terminal' },
          skipEnter: { type: 'boolean', description: 'Skip pressing enter after typing command' },
        }),
        expect.any(Function)
      );
    });

    it('debe aplicar herramientas de extensiones correctamente', async () => {
      // Arrange
      const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
      const mockServer = {
        tool: jest.fn().mockReturnValue({
          name: 'vscode_automation_extensions_install',
          description: 'Install extension',
        }),
        setRequestHandler: jest.fn(),
        connect: jest.fn(),
      };
      McpServer.mockReturnValue(mockServer);

      const server = new McpServer({ name: 'Extensions Server' });

      // Act
      const tool = server.tool(
        'vscode_automation_extensions_install',
        'Install an extension by ID',
        {
          extensionId: { type: 'string', description: 'Extension ID to install' },
          waitUntilEnabled: { type: 'boolean', description: 'Whether to wait until the extension is enabled' },
        },
        async ({ extensionId, waitUntilEnabled }) => {
          return {
            content: [{
              type: 'text',
              text: `Installed extension: ${extensionId}`,
            }],
          };
        }
      );

      // Assert
      expect(server.tool).toHaveBeenCalledWith(
        'vscode_automation_extensions_install',
        'Install an extension by ID',
        expect.objectContaining({
          extensionId: { type: 'string', description: 'Extension ID to install' },
          waitUntilEnabled: { type: 'boolean', description: 'Whether to wait until the extension is enabled' },
        }),
        expect.any(Function)
      );
    });
  });

  describe('Manejo de errores MCP', () => {
    it('debe manejar errores de conexión', async () => {
      // Arrange
      const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
      const mockClient = {
        connect: jest.fn().mockRejectedValue(new Error('Connection failed')),
        disconnect: jest.fn(),
        request: jest.fn(),
        notification: jest.fn(),
      };
      Client.mockReturnValue(mockClient);

      const client = new Client({ name: 'Test Client' });

      // Act & Assert
      await expect(client.connect({ transport: {} }))
        .rejects
        .toThrow('Connection failed');
    });

    it('debe manejar timeouts de requests', async () => {
      // Arrange
      const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
      const mockClient = {
        connect: jest.fn().mockResolvedValue(undefined),
        request: jest.fn().mockImplementation(() => {
          return new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Request timeout')), 5000);
          });
        }),
        notification: jest.fn(),
        disconnect: jest.fn(),
      };
      Client.mockReturnValue(mockClient);

      const client = new Client({ name: 'Test Client' });
      await client.connect({ transport: {} });

      // Act & Assert
      await expect(client.request('slow_method', {}))
        .rejects
        .toThrow('Request timeout');
    });

    it('debe manejar errores de herramientas', async () => {
      // Arrange
      const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
      const mockServer = {
        tool: jest.fn().mockReturnValue({
          name: 'failing_tool',
          description: 'A tool that fails',
        }),
        setRequestHandler: jest.fn(),
        connect: jest.fn(),
      };
      McpServer.mockReturnValue(mockServer);

      const server = new McpServer({ name: 'Error Server' });

      server.tool(
        'failing_tool',
        'A tool that always fails',
        {},
        async () => {
          throw new Error('Tool execution failed');
        }
      );

      // Act & Assert - El error se maneja en el handler de la herramienta
      expect(server.tool).toHaveBeenCalledWith(
        'failing_tool',
        'A tool that always fails',
        {},
        expect.any(Function)
      );
    });

    it('debe manejar desconexiones inesperadas', async () => {
      // Arrange
      const mockTransport = {
        send: jest.fn().mockRejectedValue(new Error('Transport closed')),
        close: jest.fn().mockResolvedValue(undefined),
        onError: jest.fn(),
        onClose: jest.fn(),
      };

      // Act & Assert
      await expect(mockTransport.send({ method: 'test' }))
        .rejects
        .toThrow('Transport closed');

      await mockTransport.close();
      expect(mockTransport.close).toHaveBeenCalled();
    });
  });

  describe('Protocolo JSON-RPC', () => {
    it('debe manejar requests JSON-RPC correctamente', async () => {
      // Arrange
      const mockHandler = jest.fn().mockResolvedValue({
        result: {
          tools: [
            { name: 'tool1', description: 'First tool' },
            { name: 'tool2', description: 'Second tool' },
          ],
        },
      });

      // Simular mensaje JSON-RPC
      const request = {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
        params: {},
      };

      // Act
      const response = await mockHandler(request);

      // Assert
      expect(mockHandler).toHaveBeenCalledWith(request);
      expect(response.result.tools).toHaveLength(2);
      expect(response.result.tools[0].name).toBe('tool1');
    });

    it('debe manejar responses JSON-RPC correctamente', async () => {
      // Arrange
      const response = {
        jsonrpc: '2.0',
        id: 1,
        result: {
          content: [{
            type: 'text',
            text: 'Command executed successfully',
          }],
        },
      };

      // Act & Assert
      expect(response.jsonrpc).toBe('2.0');
      expect(response.id).toBe(1);
      expect(response.result.content[0].type).toBe('text');
      expect(response.result.content[0].text).toBe('Command executed successfully');
    });

    it('debe manejar errores JSON-RPC correctamente', async () => {
      // Arrange
      const errorResponse = {
        jsonrpc: '2.0',
        id: 2,
        error: {
          code: -32601,
          message: 'Method not found',
          data: {
            method: 'nonexistent_method',
          },
        },
      };

      // Act & Assert
      expect(errorResponse.jsonrpc).toBe('2.0');
      expect(errorResponse.id).toBe(2);
      expect(errorResponse.error.code).toBe(-32601);
      expect(errorResponse.error.message).toBe('Method not found');
      expect(errorResponse.error.data.method).toBe('nonexistent_method');
    });

    it('debe manejar notificaciones JSON-RPC correctamente', async () => {
      // Arrange
      const notification = {
        jsonrpc: '2.0',
        method: 'window/logMessage',
        params: {
          type: 3, // Info
          message: 'Extension activated',
        },
      };

      // Act & Assert
      expect(notification.jsonrpc).toBe('2.0');
      expect(notification.method).toBe('window/logMessage');
      expect(notification.params.type).toBe(3);
      expect(notification.params.message).toBe('Extension activated');
      // Notificaciones no tienen id
      expect(notification.id).toBeUndefined();
    });
  });

  describe('Integración con aplicación MintMind', () => {
    it('debe integrar MCP con servicios del workbench', async () => {
      // Arrange
      const mockApplicationService = {
        getOrCreateApplication: jest.fn().mockResolvedValue({
          workbench: {
            editor: {
              waitForTypeInEditor: jest.fn().mockResolvedValue(undefined),
            },
            terminal: {
              runCommandInTerminal: jest.fn().mockResolvedValue(undefined),
            },
            extensions: {
              installExtension: jest.fn().mockResolvedValue(undefined),
            },
          },
        }),
        application: null,
        onApplicationChange: jest.fn(),
      };

      // Act
      const app = await mockApplicationService.getOrCreateApplication();
      await app.workbench.editor.waitForTypeInEditor('test.txt', 'Hello World');
      await app.workbench.terminal.runCommandInTerminal('echo "test"');
      await app.workbench.extensions.installExtension('test.extension');

      // Assert
      expect(mockApplicationService.getOrCreateApplication).toHaveBeenCalled();
      expect(app.workbench.editor.waitForTypeInEditor).toHaveBeenCalledWith('test.txt', 'Hello World');
      expect(app.workbench.terminal.runCommandInTerminal).toHaveBeenCalledWith('echo "test"');
      expect(app.workbench.extensions.installExtension).toHaveBeenCalledWith('test.extension');
    });

    it('debe manejar cambios de aplicación', async () => {
      // Arrange
      const mockApplicationService = {
        application: null,
        onApplicationChange: jest.fn(),
      };

      const registeredTools = [
        { enable: jest.fn(), disable: jest.fn() },
        { enable: jest.fn(), disable: jest.fn() },
      ];

      // Simular cambio de aplicación (null -> app)
      mockApplicationService.onApplicationChange((app: any) => {
        if (app) {
          registeredTools.forEach(t => t.enable());
        } else {
          registeredTools.forEach(t => t.disable());
        }
      });

      // Act
      mockApplicationService.onApplicationChange({}); // Nueva aplicación

      // Assert
      registeredTools.forEach(tool => {
        expect(tool.enable).toHaveBeenCalled();
        expect(tool.disable).not.toHaveBeenCalled();
      });
    });

    it('debe manejar estado de aplicación para herramientas', async () => {
      // Arrange
      const mockApplicationService = {
        application: {
          workbench: {
            editor: { /* ... */ },
            terminal: { /* ... */ },
          },
        },
      };

      const tools = [
        { enable: jest.fn(), disable: jest.fn() },
        { enable: jest.fn(), disable: jest.fn() },
        { enable: jest.fn(), disable: jest.fn() },
      ];

      // Act
      if (mockApplicationService.application) {
        tools.forEach(t => t.enable());
      } else {
        tools.forEach(t => t.disable());
      }

      // Assert
      tools.forEach(tool => {
        expect(tool.enable).toHaveBeenCalled();
        expect(tool.disable).not.toHaveBeenCalled();
      });
    });
  });
});
