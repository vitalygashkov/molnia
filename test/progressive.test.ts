import { test, expect, describe } from 'vitest';

// Import internal functions by accessing them through the module
// We'll test the logic by importing and testing the exported functions
import { downloadProgressive, getChunkSize, getRanges, MAX_CHUNK_SIZE_MB } from '../lib/progressive';

describe('progressive', () => {
  describe('getChunkSize', () => {
    // Test the chunk size calculation logic
    test('returns size/5 for small files', () => {
      const size = 1024 * 1024; // 1MB
      const chunkSize = getChunkSize(size);
      expect(chunkSize).toBe(Math.floor(size / 5));
    });

    test('caps at MAX_CHUNK_SIZE_MB for large files', () => {
      const size = 100 * 1024 * 1024; // 100MB
      const chunkSize = getChunkSize(size);
      expect(chunkSize).toBe(MAX_CHUNK_SIZE_MB * 1024 * 1024);
    });

    test('handles zero size', () => {
      const chunkSize = getChunkSize(0);
      expect(chunkSize).toBe(0);
    });
  });

  describe('getRanges', () => {
    test('calculates correct ranges for small file', () => {
      const size = 1000;
      const connections = 5;
      const ranges = getRanges(size, connections);

      // Check that ranges cover the entire file
      let totalCovered = 0;
      for (const [start, end] of ranges) {
        expect(start).toBeLessThanOrEqual(end);
        totalCovered += end - start + 1;
      }
      expect(totalCovered).toBe(size);
    });

    test('respects connection limit', () => {
      const size = 10000;
      const connections = 3;
      const ranges = getRanges(size, connections);
      expect(ranges.length).toBeLessThanOrEqual(connections + 2);
    });

    test('returns ranges for very small file', () => {
      const size = 100;
      const connections = 5;
      const ranges = getRanges(size, connections);
      // With connections > size, ranges should be based on connections
      expect(ranges.length).toBeGreaterThanOrEqual(1);
      expect(ranges[0]).toEqual([0, expect.any(Number)]);
    });

    test('handles large file with multiple chunks', () => {
      const size = 10 * 1024 * 1024; // 10MB
      const connections = 5;
      const ranges = getRanges(size, connections);

      // Should have multiple ranges
      expect(ranges.length).toBeGreaterThan(1);

      // Check coverage
      let totalCovered = 0;
      for (const [start, end] of ranges) {
        totalCovered += end - start + 1;
      }
      expect(totalCovered).toBe(size);
    });
  });

  describe('downloadProgressive', () => {
    test('throws error when no output path', async () => {
      await expect(downloadProgressive('https://example.com/test.mp4', {}, 1000, 'video/mp4')).rejects.toThrow(
        'Output path is required',
      );
    });
  });
});
