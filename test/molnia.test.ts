import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect, describe, beforeEach, afterEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { downloadSegments } from '../lib/segments';
import { download } from '../molnia';
import { server } from './setup';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const testOutputDir = path.join(__dirname, 'fixtures', 'integration');

describe('integration tests', () => {
  beforeEach(() => {
    if (!fs.existsSync(testOutputDir)) {
      fs.mkdirSync(testOutputDir, { recursive: true });
    }
  });

  afterEach(() => {
    // Clean up test files
    const files = fs.readdirSync(testOutputDir);
    for (const file of files) {
      const filePath = path.join(testOutputDir, file);
      if (fs.statSync(filePath).isFile()) {
        fs.unlinkSync(filePath);
      }
    }
    // Clean up temp directories
    const tempDir = path.join(testOutputDir, 'video');
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true });
    }
  });

  describe('downloadSegments', () => {
    test('downloads and merges multiple segments', async () => {
      const segmentData1 = new Uint8Array([1, 2, 3, 4, 5]);
      const segmentData2 = new Uint8Array([6, 7, 8, 9, 10]);
      const segmentData3 = new Uint8Array([11, 12, 13, 14, 15]);

      server.use(
        http.get('https://test.molnia/integration/segment/1', () => {
          return new HttpResponse(segmentData1, {
            status: 200,
            headers: { 'Content-Type': 'video/mp4', 'Content-Length': String(segmentData1.length) },
          });
        }),
        http.get('https://test.molnia/integration/segment/2', () => {
          return new HttpResponse(segmentData2, {
            status: 200,
            headers: { 'Content-Type': 'video/mp4', 'Content-Length': String(segmentData2.length) },
          });
        }),
        http.get('https://test.molnia/integration/segment/3', () => {
          return new HttpResponse(segmentData3, {
            status: 200,
            headers: { 'Content-Type': 'video/mp4', 'Content-Length': String(segmentData3.length) },
          });
        }),
      );

      const testOutputPath = path.join(testOutputDir, 'segments.mp4');
      await downloadSegments(
        [
          { url: 'https://test.molnia/integration/segment/1' },
          { url: 'https://test.molnia/integration/segment/2' },
          { url: 'https://test.molnia/integration/segment/3' },
        ],
        { output: testOutputPath },
      );

      expect(fs.existsSync(testOutputPath)).toBe(true);
      const stats = fs.statSync(testOutputPath);
      // Total should be sum of all segments (5 + 5 + 5 = 15)
      expect(stats.size).toBe(15);
    });

    test('downloads segments with custom headers', async () => {
      const segmentData = new Uint8Array(256);

      server.use(
        http.get('https://test.molnia/integration/segment/auth', ({ request }) => {
          const auth = request.headers.get('Authorization');
          if (auth === 'Bearer test-token') {
            return new HttpResponse(segmentData, {
              status: 200,
              headers: { 'Content-Type': 'video/mp4', 'Content-Length': String(segmentData.length) },
            });
          }
          return new HttpResponse('Unauthorized', { status: 401 });
        }),
      );

      const testOutputPath = path.join(testOutputDir, 'auth-segments.mp4');
      await downloadSegments(
        [{ url: 'https://test.molnia/integration/segment/auth', headers: { Authorization: 'Bearer test-token' } }],
        { output: testOutputPath },
      );

      expect(fs.existsSync(testOutputPath)).toBe(true);
    });
  });

  describe('download', () => {
    test('progressive download - multiple chunks', async () => {
      const fullData = new Uint8Array(2048);

      server.use(
        http.get('https://test.molnia/integration/progressive', ({ request }) => {
          const range = request.headers.get('Range');
          if (range) {
            const match = range.match(/bytes=(\d+)-(\d+)/);
            if (match && match[1] && match[2]) {
              const start = parseInt(match[1]);
              const end = Math.min(parseInt(match[2]), fullData.length - 1);
              const partial = fullData.slice(start, end + 1);
              return new HttpResponse(partial, {
                status: 206,
                headers: {
                  'Content-Type': 'video/mp4',
                  'Content-Length': String(partial.length),
                  'Content-Range': `bytes ${start}-${end}/${fullData.length}`,
                },
              });
            }
          }
          return new HttpResponse(fullData, {
            status: 200,
            headers: { 'Content-Type': 'video/mp4' },
          });
        }),
      );

      const testOutputPath = path.join(testOutputDir, 'progressive.mp4');
      await download('https://test.molnia/integration/progressive', {
        output: testOutputPath,
      });

      expect(fs.existsSync(testOutputPath)).toBe(true);
      const stats = fs.statSync(testOutputPath);
      expect(stats.size).toBe(fullData.length);
    });

    test('regular download - single request', async () => {
      const fullData = new Uint8Array(1024);

      server.use(
        http.get('https://test.molnia/integration/regular', () => {
          return new HttpResponse(fullData, {
            status: 200,
            headers: {
              'Content-Type': 'application/octet-stream', // Not video to avoid progressive
              'Content-Length': String(fullData.length),
            },
          });
        }),
      );

      const testOutputPath = path.join(testOutputDir, 'regular.mp4');
      await download('https://test.molnia/integration/regular', {
        output: testOutputPath,
      });

      expect(fs.existsSync(testOutputPath)).toBe(true);
      const stats = fs.statSync(testOutputPath);
      expect(stats.size).toBe(fullData.length);
    });
  });
});
