/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { jest } from '@jest/globals';

// Mock de base de datos para tests de integración
export class TestDatabase {
  private static instance: TestDatabase;
  private isConnected = false;

  static getInstance(): TestDatabase {
    if (!TestDatabase.instance) {
      TestDatabase.instance = new TestDatabase();
    }
    return TestDatabase.instance;
  }

  async connect(): Promise<void> {
    if (this.isConnected) {return;}

    // Simular conexión a base de datos de test
    console.log('Conectando a base de datos de test...');

    // Aquí iría la lógica real de conexión a BD de test
    // Por ejemplo: PostgreSQL, MongoDB, etc.

    this.isConnected = true;
  }

  async disconnect(): Promise<void> {
    if (!this.isConnected) {return;}

    console.log('Desconectando de base de datos de test...');

    // Limpiar datos de test
    await this.clearAllData();

    this.isConnected = false;
  }

  async clearAllData(): Promise<void> {
    // Limpiar todas las tablas/colecciones de test
    console.log('Limpiando datos de test...');

    // Implementación específica según el tipo de BD
    // Ejemplo para SQL:
    // await this.connection.query('DELETE FROM users; DELETE FROM sessions; etc.');
  }

  async seedTestData(): Promise<void> {
    // Insertar datos de prueba
    console.log('Insertando datos de prueba...');

    // Ejemplo:
    // await this.connection.query(`
    //   INSERT INTO users (id, name, email) VALUES
    //   (1, 'Test User', 'test@example.com')
    // `);
  }

  getConnection() {
    if (!this.isConnected) {
      throw new Error('Database not connected. Call connect() first.');
    }
    // Retornar conexión mockeada o real
    return {
      query: jest.fn(),
      execute: jest.fn(),
      // otros métodos según el ORM/driver usado
    };
  }
}

// Helper para setup de BD en tests
export const setupTestDatabase = async (): Promise<TestDatabase> => {
  const db = TestDatabase.getInstance();
  await db.connect();
  await db.clearAllData();
  await db.seedTestData();
  return db;
};

// Helper para cleanup de BD después de tests
export const teardownTestDatabase = async (): Promise<void> => {
  const db = TestDatabase.getInstance();
  await db.disconnect();
};
