import { beforeAll, afterAll, afterEach } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';

// Create a server instance
export const server = setupServer();

// Test data helpers
export const createTestData = (size: number): Uint8Array => {
  const data = new Uint8Array(size);
  for (let i = 0; i < size; i++) {
    data[i] = i % 256;
  }
  return data;
};

export const TEST_DATA_SMALL = createTestData(1024); // 1KB
export const TEST_DATA_MEDIUM = createTestData(1024 * 10); // 10KB
export const TEST_DATA_LARGE = createTestData(1024 * 100); // 100KB

// Common handlers
export const handlers = [
  // Progressive download endpoint (returns 206 with Range)
  http.get('https://test.molnia/progressive', ({ request }) => {
    const range = request.headers.get('Range');
    if (range) {
      const match = range.match(/bytes=(\d+)-(\d+)/);
      if (match && match[1] && match[2]) {
        const start = parseInt(match[1]);
        const end = parseInt(match[2]);
        const data = TEST_DATA_MEDIUM.slice(start, end + 1);
        return new HttpResponse(data, {
          status: 206,
          headers: {
            'Content-Type': 'video/mp4',
            'Content-Length': String(data.length),
            'Content-Range': `bytes ${start}-${end}/${TEST_DATA_MEDIUM.length}`,
          },
        });
      }
    }
    return new HttpResponse(TEST_DATA_MEDIUM, {
      status: 200,
      headers: { 'Content-Type': 'video/mp4' },
    });
  }),

  // Regular download endpoint (no range support)
  http.get('https://test.molnia/regular', () => {
    return new HttpResponse(TEST_DATA_MEDIUM, {
      status: 200,
      headers: { 'Content-Type': 'video/mp4' },
    });
  }),

  // Compressed endpoint (gzip)
  http.get('https://test.molnia/compressed', () => {
    return new HttpResponse(TEST_DATA_MEDIUM, {
      status: 200,
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Encoding': 'gzip',
      },
    });
  }),

  // Segment endpoints
  http.get('https://test.molnia/segment/:id', ({ params }) => {
    const { id } = params;
    const index = parseInt(id as string);
    const data = createTestData(512 * (index + 1)); // Variable size segments
    return new HttpResponse(data, {
      status: 200,
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Length': String(data.length),
      },
    });
  }),

  // Error endpoint (404)
  http.get('https://test.molnia/notfound', () => {
    return new HttpResponse('Not Found', { status: 404 });
  }),

  // Error endpoint (500)
  http.get('https://test.molnia/error', () => {
    return new HttpResponse('Internal Server Error', { status: 500 });
  }),
];

// Setup and teardown
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
