/**
 * Tests para utilidades básicas del sistema
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';

// Módulo de utilidades simple para testing
class MathUtils {
  static add(a: number, b: number): number {
    if (typeof a !== 'number' || typeof b !== 'number') {
      throw new Error('Both arguments must be numbers');
    }
    return a + b;
  }

  static multiply(a: number, b: number): number {
    return a * b;
  }

  static divide(a: number, b: number): number {
    if (b === 0) {
      throw new Error('Cannot divide by zero');
    }
    return a / b;
  }

  static async asyncAdd(a: number, b: number): Promise<number> {
    await new Promise(resolve => setTimeout(resolve, 10));
    return this.add(a, b);
  }
}

describe('MathUtils', () => {
  describe('add', () => {
    it('should add two positive numbers correctly', () => {
      const result = MathUtils.add(2, 3);
      expect(result).toBe(5);
    });

    it('should add positive and negative numbers correctly', () => {
      const result = MathUtils.add(5, -3);
      expect(result).toBe(2);
    });

    it('should add two negative numbers correctly', () => {
      const result = MathUtils.add(-2, -3);
      expect(result).toBe(-5);
    });

    it('should add zero correctly', () => {
      const result = MathUtils.add(0, 5);
      expect(result).toBe(5);
    });

    it('should throw error when first argument is not a number', () => {
      expect(() => MathUtils.add('2' as any, 3)).toThrow('Both arguments must be numbers');
    });

    it('should throw error when second argument is not a number', () => {
      expect(() => MathUtils.add(2, '3' as any)).toThrow('Both arguments must be numbers');
    });
  });

  describe('multiply', () => {
    it('should multiply two numbers correctly', () => {
      const result = MathUtils.multiply(4, 3);
      expect(result).toBe(12);
    });

    it('should multiply by zero', () => {
      const result = MathUtils.multiply(5, 0);
      expect(result).toBe(0);
    });

    it('should multiply negative numbers', () => {
      const result = MathUtils.multiply(-2, 3);
      expect(result).toBe(-6);
    });
  });

  describe('divide', () => {
    it('should divide two numbers correctly', () => {
      const result = MathUtils.divide(10, 2);
      expect(result).toBe(5);
    });

    it('should divide and return decimal result', () => {
      const result = MathUtils.divide(5, 2);
      expect(result).toBe(2.5);
    });

    it('should throw error when dividing by zero', () => {
      expect(() => MathUtils.divide(10, 0)).toThrow('Cannot divide by zero');
    });
  });

  describe('asyncAdd', () => {
    it('should add two numbers asynchronously', async () => {
      const result = await MathUtils.asyncAdd(3, 4);
      expect(result).toBe(7);
    });

    it('should handle async errors', async () => {
      await expect(MathUtils.asyncAdd('3' as any, 4)).rejects.toThrow('Both arguments must be numbers');
    });
  });
});

/**
 * Test para configuración global de Jest
 */
describe('Global Test Configuration', () => {
  it('should have test environment variables set', () => {
    expect(process.env.NODE_ENV).toBe('test');
    expect(process.env.BUN_ENV).toBe('test');
  });

  it('should have global test utilities available', () => {
    expect(global.testUtils).toBeDefined();
    expect(typeof global.testUtils.createMockFunction).toBe('function');
    expect(typeof global.testUtils.createMockObject).toBe('function');
    expect(typeof global.testUtils.flushPromises).toBe('function');
  });

  it('should create mock functions correctly', () => {
    const mockFn = global.testUtils.createMockFunction((x: number) => x * 2);
    expect(mockFn(5)).toBe(10);
    expect(mockFn).toHaveBeenCalledWith(5);
  });

  it('should create mock objects correctly', () => {
    const mockObj = global.testUtils.createMockObject<{ name: string; age: number }>({
      name: 'Test',
      age: 25,
    });
    expect(mockObj.name).toBe('Test');
    expect(mockObj.age).toBe(25);
  });
});