/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { jest } from '@jest/globals';

// Mock de servidor HTTP para tests de integración
export class TestServer {
  private static instance: TestServer;
  private server: any = null;
  private port = 3001;

  static getInstance(): TestServer {
    if (!TestServer.instance) {
      TestServer.instance = new TestServer();
    }
    return TestServer.instance;
  }

  async start(): Promise<void> {
    if (this.server) {return;}

    console.log(`Iniciando servidor de test en puerto ${this.port}...`);

    // Aquí iría la lógica para iniciar el servidor real
    // Por ejemplo: Express, Fastify, etc.

    // Mock del servidor para tests
    this.server = {
      listen: jest.fn((port, callback) => {
        console.log(`Servidor mock escuchando en puerto ${port}`);
        if (callback) {callback();}
      }),
      close: jest.fn((callback) => {
        console.log('Servidor mock cerrado');
        if (callback) {callback();}
      }),
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
    };

    return new Promise((resolve) => {
      this.server.listen(this.port, resolve);
    });
  }

  async stop(): Promise<void> {
    if (!this.server) {return;}

    console.log('Deteniendo servidor de test...');

    return new Promise((resolve) => {
      this.server.close(resolve);
      this.server = null;
    });
  }

  getServer() {
    if (!this.server) {
      throw new Error('Server not started. Call start() first.');
    }
    return this.server;
  }

  getPort(): number {
    return this.port;
  }

  getBaseUrl(): string {
    return `http://localhost:${this.port}`;
  }
}

// Helper para setup de servidor en tests
export const setupTestServer = async (): Promise<TestServer> => {
  const server = TestServer.getInstance();
  await server.start();
  return server;
};

// Helper para cleanup de servidor después de tests
export const teardownTestServer = async (): Promise<void> => {
  const server = TestServer.getInstance();
  await server.stop();
};
