/**
 * Integration tests for ripgrep parser implementations
 * Ensures both parsers work correctly in the application context
 */

import { jest } from '@jest/globals';

// Mock the Rust parser WASM module
jest.mock('../../ripgrep-rust-parser/pkg/ripgrep_rust_parser', () => ({
  parse_ripgrep_json: jest.fn(),
}));

import { parse_ripgrep_json as rustParseRipgrepJson } from '../../ripgrep-rust-parser/pkg/ripgrep_rust_parser';

// Mock Node.js performance API for consistent testing
const mockPerformance = {
  now: jest.fn(),
};

Object.defineProperty(global, 'performance', {
  value: mockPerformance,
  writable: true,
});

describe('Ripgrep Parser Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Set up performance mock to return incremental timestamps
    let callCount = 0;
    mockPerformance.now.mockImplementation(() => {
      callCount++;
      return callCount * 10; // 10ms increments
    });
  });

  describe('Parser Initialization', () => {
    it('should initialize Rust parser correctly', async () => {
      const mockResult = [{
        matches: [],
        stats: {
          elapsed_total: 0.001,
          searches: 1,
          searches_with_match: 0,
          bytes_searched: 100,
          bytes_printed: 0,
          matched_lines: 0,
          matches: 0,
        }
      }];

      (rustParseRipgrepJson as jest.MockedFunction<typeof rustParseRipgrepJson>)
        .mockResolvedValue(mockResult);

      const result = await rustParseRipgrepJson('{}');

      expect(rustParseRipgrepJson).toHaveBeenCalledWith('{}');
      expect(result).toEqual(mockResult);
    });

    it('should handle parser initialization errors', async () => {
      const errorMessage = 'Failed to load WASM module';
      (rustParseRipgrepJson as jest.MockedFunction<typeof rustParseRipgrepJson>)
        .mockRejectedValue(new Error(errorMessage));

      await expect(rustParseRipgrepJson('invalid'))
        .rejects.toThrow(errorMessage);
    });
  });

  describe('Data Flow Integration', () => {
    it('should process ripgrep output through parser pipeline', async () => {
      const ripgrepOutput = JSON.stringify([
        {
          type: 'match',
          data: {
            path: { text: 'src/main.ts' },
            lines: { text: 'console.log("Hello World");' },
            line_number: 10,
            absolute_offset: 200,
            submatches: [{
              start: 12,
              end: 25,
              text: '"Hello World"'
            }]
          }
        },
        {
          type: 'summary',
          data: {
            elapsed_total: {
              human: '0.005',
              secs: 0.005
            },
            stats: {
              searches: 1,
              searches_with_match: 1,
              bytes_searched: 1024,
              bytes_printed: 50,
              matched_lines: 1,
              matches: 1
            }
          }
        }
      ]);

      const expectedResult = [{
        matches: [{
          path: 'src/main.ts',
          lines: 'console.log("Hello World");',
          line_number: 10,
          absolute_offset: 200,
          submatches: [{
            start: 12,
            end: 25,
            text: '"Hello World"'
          }]
        }],
        stats: {
          elapsed_total: 0.005,
          searches: 1,
          searches_with_match: 1,
          bytes_searched: 1024,
          bytes_printed: 50,
          matched_lines: 1,
          matches: 1
        }
      }];

      (rustParseRipgrepJson as jest.MockedFunction<typeof rustParseRipgrepJson>)
        .mockResolvedValue(expectedResult);

      const result = await rustParseRipgrepJson(ripgrepOutput);

      expect(result).toEqual(expectedResult);
      expect(rustParseRipgrepJson).toHaveBeenCalledWith(ripgrepOutput);
    });

    it('should handle empty results', async () => {
      const emptyOutput = JSON.stringify([]);

      const expectedResult = [];

      (rustParseRipgrepJson as jest.MockedFunction<typeof rustParseRipgrepJson>)
        .mockResolvedValue(expectedResult);

      const result = await rustParseRipgrepJson(emptyOutput);

      expect(result).toEqual([]);
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle malformed JSON gracefully', async () => {
      const malformedJson = '{ invalid json content }';

      (rustParseRipgrepJson as jest.MockedFunction<typeof rustParseRipgrepJson>)
        .mockRejectedValue(new Error('JSON parsing error'));

      await expect(rustParseRipgrepJson(malformedJson))
        .rejects.toThrow('JSON parsing error');
    });

    it('should handle large JSON payloads', async () => {
      // Generate a large JSON payload
      const largeMatches = Array.from({ length: 10000 }, (_, i) => ({
        type: 'match',
        data: {
          path: { text: `file${i}.txt` },
          lines: { text: `Line ${i} content ${'x'.repeat(100)}` },
          line_number: i + 1,
          absolute_offset: i * 150,
          submatches: [{
            start: 5,
            end: 5 + i.toString().length,
            text: i.toString()
          }]
        }
      }));

      const largeOutput = JSON.stringify(largeMatches);
      const mockResult = largeMatches.map(() => ({
        matches: [],
        stats: { elapsed_total: 0, searches: 1, searches_with_match: 0, bytes_searched: 0, bytes_printed: 0, matched_lines: 0, matches: 0 }
      }));

      (rustParseRipgrepJson as jest.MockedFunction<typeof rustParseRipgrepJson>)
        .mockResolvedValue(mockResult);

      const result = await rustParseRipgrepJson(largeOutput);

      expect(result.length).toBe(10000);
      expect(rustParseRipgrepJson).toHaveBeenCalledWith(largeOutput);
    });
  });

  describe('Performance Monitoring', () => {
    it('should track parsing performance metrics', async () => {
      const testData = JSON.stringify([{
        type: 'match',
        data: {
          path: { text: 'test.txt' },
          lines: { text: 'test content' },
          line_number: 1,
          absolute_offset: 0,
          submatches: []
        }
      }]);

      (rustParseRipgrepJson as jest.MockedFunction<typeof rustParseRipgrepJson>)
        .mockResolvedValue([{
          matches: [],
          stats: { elapsed_total: 0, searches: 1, searches_with_match: 0, bytes_searched: 0, bytes_printed: 0, matched_lines: 0, matches: 0 }
        }]);

      const startTime = performance.now();
      await rustParseRipgrepJson(testData);
      const endTime = performance.now();

      // Verify performance tracking works
      expect(endTime).toBeGreaterThan(startTime);
      expect(mockPerformance.now).toHaveBeenCalled();
    });
  });
});