import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect, describe, beforeEach, afterEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { downloadSegments, type SegmentData } from '../lib/segments';
import { server } from './setup';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const testOutputDir = path.join(__dirname, 'fixtures', 'segments');
const testOutputPath = path.join(testOutputDir, 'output.mp4');

describe('downloadSegments', () => {
  beforeEach(() => {
    if (!fs.existsSync(testOutputDir)) {
      fs.mkdirSync(testOutputDir, { recursive: true });
    }
    // Add segment handlers
    server.use(
      http.get('https://test.molnia/segments/:id', ({ params }) => {
        const { id } = params;
        const index = parseInt(id as string);
        const data = new Uint8Array(256 * (index + 1));
        for (let i = 0; i < data.length; i++) data[i] = i % 256;
        return new HttpResponse(data, {
          status: 200,
          headers: {
            'Content-Type': 'video/mp4',
            'Content-Length': String(data.length),
          },
        });
      }),
    );
  });

  afterEach(() => {
    if (fs.existsSync(testOutputPath)) {
      fs.unlinkSync(testOutputPath);
    }
    // Clean up temp directory
    const tempDir = path.join(testOutputDir, 'output');
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true });
    }
  });

  test('downloads single segment', async () => {
    const segments: SegmentData[] = [{ url: 'https://test.molnia/segments/0' }];

    await downloadSegments(segments, { output: testOutputPath });

    expect(fs.existsSync(testOutputPath)).toBe(true);
    const stats = fs.statSync(testOutputPath);
    expect(stats.size).toBeGreaterThan(0);
  });

  test('downloads multiple segments', async () => {
    const segments: SegmentData[] = [
      { url: 'https://test.molnia/segments/0' },
      { url: 'https://test.molnia/segments/1' },
      { url: 'https://test.molnia/segments/2' },
    ];

    await downloadSegments(segments, { output: testOutputPath });

    expect(fs.existsSync(testOutputPath)).toBe(true);
    const stats = fs.statSync(testOutputPath);
    // Total should be sum of all segments: 256 + 512 + 768 = 1536
    expect(stats.size).toBe(256 + 512 + 768);
  });

  test('throws error when no output path', async () => {
    const segments: SegmentData[] = [{ url: 'https://test.molnia/segments/0' }];

    await expect(downloadSegments(segments, {})).rejects.toThrow('Output path is required');
  });

  test('creates temp directory automatically', async () => {
    const segments: SegmentData[] = [{ url: 'https://test.molnia/segments/0' }];

    await downloadSegments(segments, { output: testOutputPath });

    expect(fs.existsSync(testOutputPath)).toBe(true);
  });

  test('passes custom headers to segments', async () => {
    // Add a handler that checks for the header
    server.use(
      http.get('https://test.molnia/segments/header-test', ({ request }) => {
        const auth = request.headers.get('Authorization');
        if (auth !== 'Bearer token123') {
          return new HttpResponse('Unauthorized', { status: 401 });
        }
        const data = new Uint8Array(256);
        return new HttpResponse(data, {
          status: 200,
          headers: { 'Content-Length': '256' },
        });
      }),
    );

    const testSegments: SegmentData[] = [
      {
        url: 'https://test.molnia/segments/header-test',
        headers: { Authorization: 'Bearer token123' },
      },
    ];

    await downloadSegments(testSegments, { output: testOutputPath });
    expect(fs.existsSync(testOutputPath)).toBe(true);
  });

  test('cleans up temp directory after completion', async () => {
    const segments: SegmentData[] = [
      { url: 'https://test.molnia/segments/0' },
      { url: 'https://test.molnia/segments/1' },
    ];

    await downloadSegments(segments, { output: testOutputPath });

    // Output file should exist
    expect(fs.existsSync(testOutputPath)).toBe(true);

    // Temp directory should be cleaned up
    const tempDir = path.join(testOutputDir, 'output');
    expect(fs.existsSync(tempDir)).toBe(false);
  });
});
