import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect, describe, beforeEach, afterEach } from 'vitest';
import { save } from '../lib/save';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('save', () => {
  const testOutputDir = path.join(__dirname, 'fixtures');
  const testOutputPath = path.join(testOutputDir, 'test-output.bin');

  beforeEach(async () => {
    if (!fs.existsSync(testOutputDir)) {
      fs.mkdirSync(testOutputDir, { recursive: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(testOutputPath)) {
      fs.unlinkSync(testOutputPath);
    }
  });

  test('saves file successfully', async () => {
    const testData = new Uint8Array([1, 2, 3, 4, 5]);

    // Mock the response
    const mockResponse = {
      status: 200,
      headers: new Headers({
        'content-type': 'video/mp4',
        'content-length': String(testData.length),
      }),
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(testData);
          controller.close();
        },
      }),
      arrayBuffer: async () => testData.buffer,
    } as unknown as Response;

    const mockClient = {
      get: () => Promise.resolve(mockResponse),
    };

    await save({
      url: 'https://example.com/test.mp4',
      output: testOutputPath,
      client: mockClient as any,
    });

    expect(fs.existsSync(testOutputPath)).toBe(true);
    const savedData = fs.readFileSync(testOutputPath);
    // Buffer's toJSON returns { type: 'Buffer', data: [...] }, compare directly
    expect(savedData.equals(testData)).toBe(true);
  });

  test('calls onHeaders callback', async () => {
    const testData = new Uint8Array([1, 2, 3]);
    let headersReceived: any = null;

    const mockResponse = {
      status: 200,
      headers: new Headers({
        'content-type': 'video/mp4',
        'content-length': String(testData.length),
      }),
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(testData);
          controller.close();
        },
      }),
      arrayBuffer: async () => testData.buffer,
    } as unknown as Response;

    const mockClient = {
      get: () => Promise.resolve(mockResponse),
    };

    await save({
      url: 'https://example.com/test.mp4',
      output: testOutputPath,
      client: mockClient as any,
      onHeaders: (headers) => {
        headersReceived = headers;
      },
    });

    expect(headersReceived).not.toBeNull();
    expect(headersReceived['content-type']).toBe('video/mp4');
    expect(headersReceived['content-length']).toBe(String(testData.length));
  });

  test('calls onData callback when provided', async () => {
    const testData = new Uint8Array([1, 2, 3, 4, 5]);
    let dataReceived: any = null;

    const mockResponse = {
      status: 200,
      headers: new Headers({
        'content-type': 'video/mp4',
        'content-length': String(testData.length),
      }),
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(testData);
          controller.close();
        },
      }),
      arrayBuffer: async () => testData.buffer,
    } as unknown as Response;

    const mockClient = {
      get: () => Promise.resolve(mockResponse),
    };

    await save({
      url: 'https://example.com/test.mp4',
      output: testOutputPath,
      client: mockClient as any,
      onData: (data) => {
        dataReceived = data;
      },
    });

    expect(dataReceived).not.toBeNull();
    expect(dataReceived instanceof Buffer).toBe(true);
    expect(dataReceived.equals(testData)).toBe(true);
  });

  test('handles error status codes', async () => {
    const mockResponse = {
      status: 404,
      headers: new Headers({}),
    } as unknown as Response;

    const mockClient = {
      get: () => Promise.resolve(mockResponse),
    };

    const error = await save({
      url: 'https://example.com/notfound.mp4',
      output: testOutputPath,
      client: mockClient as any,
    });

    expect(error).not.toBeNull();
    expect(error instanceof Error).toBe(true);
    expect(error?.message).toContain('404');
  });
});
