/**
 * Tests para utilidades básicas del sistema
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';

// Módulo de utilidades simple para testing
class MathUtils {
  static add(a: number, b: number): number {
    if (typeof a !== 'number' || typeof b !== 'number' || !Number.isFinite(a) || !Number.isFinite(b)) {
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
 * Tests adicionales para casos edge y validación de tipos estricta
 */
describe('MathUtils Edge Cases', () => {
  describe('Type Validation', () => {
    it('should handle floating point precision correctly', () => {
      const result = MathUtils.add(0.1, 0.2);
      expect(result).toBeCloseTo(0.3, 10); // Close enough for floating point
    });

    it('should handle very large numbers', () => {
      const largeNum = Number.MAX_SAFE_INTEGER;
      const result = MathUtils.multiply(largeNum, 2);
      expect(result).toBe(largeNum * 2);
    });

    it('should handle very small numbers', () => {
      const smallNum = Number.MIN_VALUE;
      const result = MathUtils.add(smallNum, smallNum);
      expect(result).toBe(smallNum * 2);
    });

    it('should throw error for NaN inputs', () => {
      expect(() => MathUtils.add(NaN, 5)).toThrow('Both arguments must be numbers');
      expect(() => MathUtils.add(5, NaN)).toThrow('Both arguments must be numbers');
    });

    it('should throw error for Infinity inputs', () => {
      expect(() => MathUtils.add(Infinity, 5)).toThrow('Both arguments must be numbers');
      expect(() => MathUtils.add(5, -Infinity)).toThrow('Both arguments must be numbers');
    });
  });

  describe('Async Operations', () => {
    it('should handle async operations with delays', async () => {
      const startTime = Date.now();
      const result = await MathUtils.asyncAdd(10, 20);
      const endTime = Date.now();

      expect(result).toBe(30);
      expect(endTime - startTime).toBeGreaterThanOrEqual(10); // At least 10ms delay
    });

    it('should propagate async errors correctly', async () => {
      await expect(MathUtils.asyncAdd('invalid' as any, 5)).rejects.toThrow('Both arguments must be numbers');
    });

    it('should handle multiple concurrent async operations', async () => {
      const promises = [
        MathUtils.asyncAdd(1, 1),
        MathUtils.asyncAdd(2, 2),
        MathUtils.asyncAdd(3, 3),
      ];

      const results = await Promise.all(promises);
      expect(results).toEqual([2, 4, 6]);
    });
  });
});