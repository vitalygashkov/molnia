import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect, describe, beforeEach, afterEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { download } from '../molnia';
import { server } from './setup';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const testOutputDir = path.join(__dirname, 'fixtures', 'download');

describe('download', () => {
  beforeEach(() => {
    if (!fs.existsSync(testOutputDir)) {
      fs.mkdirSync(testOutputDir, { recursive: true });
    }
  });

  afterEach(() => {
    // Clean up any test files
    const files = fs.readdirSync(testOutputDir);
    for (const file of files) {
      const filePath = path.join(testOutputDir, file);
      if (fs.statSync(filePath).isFile()) {
        fs.unlinkSync(filePath);
      }
    }
  });

  test('progressive download with Range header', async () => {
    const testData = new Uint8Array(2048); // 2KB

    server.use(
      http.get('https://test.molnia/progressive-download', ({ request }) => {
        const range = request.headers.get('Range');
        if (range) {
          const match = range.match(/bytes=(\d+)-(\d+)/);
          if (match && match[1] && match[2]) {
            const start = parseInt(match[1]);
            const end = Math.min(parseInt(match[2]), testData.length - 1);
            const partial = testData.slice(start, end + 1);
            return new HttpResponse(partial, {
              status: 206,
              headers: {
                'Content-Type': 'video/mp4',
                'Content-Length': String(partial.length),
                'Content-Range': `bytes ${start}-${end}/${testData.length}`,
              },
            });
          }
        }
        return new HttpResponse(testData, {
          status: 200,
          headers: { 'Content-Type': 'video/mp4' },
        });
      }),
    );

    const testOutputPath = path.join(testOutputDir, 'progressive.mp4');
    await download('https://test.molnia/progressive-download', {
      output: testOutputPath,
    });

    expect(fs.existsSync(testOutputPath)).toBe(true);
    const stats = fs.statSync(testOutputPath);
    expect(stats.size).toBe(testData.length);
  });

  test('regular download without Range support', async () => {
    const testData = new Uint8Array(1024);

    server.use(
      http.get('https://test.molnia/regular-download', () => {
        return new HttpResponse(testData, {
          status: 200,
          headers: {
            'Content-Type': 'application/octet-stream', // Not video to avoid progressive
            'Content-Length': String(testData.length),
          },
        });
      }),
    );

    const testOutputPath = path.join(testOutputDir, 'regular.mp4');
    await download('https://test.molnia/regular-download', {
      output: testOutputPath,
    });

    expect(fs.existsSync(testOutputPath)).toBe(true);
    const stats = fs.statSync(testOutputPath);
    expect(stats.size).toBe(testData.length);
  });

  test('passes custom headers', async () => {
    const testData = new Uint8Array(256);
    let headersReceived: Record<string, string> | null = null;

    server.use(
      http.get('https://test.molnia/custom-headers/file', ({ request }) => {
        headersReceived = {};
        request.headers.forEach((value, key) => {
          headersReceived![key] = value;
        });
        return new HttpResponse(testData, {
          status: 200,
          headers: { 'Content-Type': 'application/octet-stream' },
        });
      }),
    );

    const testOutputPath = path.join(testOutputDir, 'custom-headers.mp4');
    await download('https://test.molnia/custom-headers/file', {
      output: testOutputPath,
      headers: {
        Authorization: 'Bearer token',
        'X-Custom-Header': 'value',
      },
    });

    expect(headersReceived).not.toBeNull();
    expect(headersReceived?.['authorization']).toBe('Bearer token');
    expect(headersReceived?.['x-custom-header']).toBe('value');
  });

  test('calls onProgress callback', async () => {
    const testData = new Uint8Array(512);
    let progressReceived: any = null;

    server.use(
      http.get('https://test.molnia/progress-test/file.mp4', () => {
        return new HttpResponse(testData, {
          status: 200,
          headers: {
            'Content-Type': 'video/mp4',
            'Content-Length': String(testData.length),
          },
        });
      }),
    );

    const testOutputPath = path.join(testOutputDir, 'progress.mp4');
    await download('https://test.molnia/progress-test/file.mp4', {
      output: testOutputPath,
      onProgress: (progress) => {
        progressReceived = progress;
      },
    });

    expect(progressReceived).not.toBeNull();
  });
});
