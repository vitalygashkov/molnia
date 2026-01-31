import { test, expect, describe, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { createClient, fetchHead, parseHead } from '../lib/client';
import { server } from './setup';

describe('client', () => {
  describe('createClient', () => {
    test('creates client with default options', () => {
      const client = createClient();
      expect(client).toBeDefined();
      expect(typeof client.get).toBe('function');
    });
  });

  describe('parseHead', () => {
    test('parses video content type as progressive', () => {
      const response = new Response(new Uint8Array(0), {
        status: 200,
        headers: {
          'content-type': 'video/mp4',
          'content-length': '1000',
        },
      });
      const result = parseHead(response);
      expect(result.isProgressive).toBe(true);
      expect(result.contentType).toBe('video/mp4');
      expect(result.contentLength).toBe(1000);
    });

    test('parses audio content type as progressive', () => {
      const response = new Response(new Uint8Array(0), {
        status: 200,
        headers: {
          'content-type': 'audio/mpeg',
          'content-length': '5000',
        },
      });
      const result = parseHead(response);
      expect(result.isProgressive).toBe(true);
    });

    test('parses gzip encoding as compressed', () => {
      const response = new Response(new Uint8Array(0), {
        status: 200,
        headers: {
          'content-encoding': 'gzip',
        },
      });
      const result = parseHead(response);
      expect(result.isCompressed).toBe(true);
    });

    test('parses deflate encoding as compressed', () => {
      const response = new Response(new Uint8Array(0), {
        status: 200,
        headers: {
          'content-encoding': 'deflate',
        },
      });
      const result = parseHead(response);
      expect(result.isCompressed).toBe(true);
    });

    test('parses accept-ranges header', () => {
      const response = new Response(new Uint8Array(0), {
        status: 200,
        headers: {
          'accept-ranges': 'bytes',
        },
      });
      const result = parseHead(response);
      expect(result.acceptBytesRange).toBe(true);
    });

    test('parses content-range header', () => {
      const response = new Response(new Uint8Array(0), {
        status: 206,
        headers: {
          'content-range': 'bytes 0-999/1000',
        },
      });
      const result = parseHead(response);
      expect(result.acceptBytesRange).toBe(true);
      expect(result.contentLength).toBe(1000);
    });

    test('handles missing content-length', () => {
      const response = new Response(new Uint8Array(0), {
        status: 200,
        headers: {},
      });
      const result = parseHead(response);
      expect(result.contentLength).toBe(null);
    });

    test('marks as progressive with content-range but no accept-ranges', () => {
      const response = new Response(new Uint8Array(0), {
        status: 206,
        headers: {
          'content-range': 'bytes 0-999/1000',
        },
      });
      const result = parseHead(response);
      expect(result.isProgressive).toBe(true);
    });

    test('does not mark as progressive for non-media types', () => {
      const response = new Response(new Uint8Array(0), {
        status: 200,
        headers: {
          'content-type': 'application/json',
        },
      });
      const result = parseHead(response);
      expect(result.isProgressive).toBe(false);
    });
  });

  describe('fetchHead', () => {
    beforeEach(() => {
      server.use(
        http.get('https://test.molnia.head/video.mp4', () => {
          return new HttpResponse(undefined, {
            status: 200,
            headers: {
              'content-type': 'video/mp4',
              'content-length': '1000',
              'accept-ranges': 'bytes',
            },
          });
        }),
      );
    });

    test('returns metadata for successful request', async () => {
      const response = await fetchHead('https://test.molnia.head/video.mp4', {});
      expect(response.url).toBe('https://test.molnia.head/video.mp4');
      expect(response.contentType).toBe('video/mp4');
      expect(response.contentLength).toBe(1000);
      expect(response.acceptBytesRange).toBe(true);
    });
  });
});
