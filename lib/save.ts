import fs from 'node:fs';
import { setTimeout } from 'node:timers/promises';
import { finished } from 'node:stream/promises';
import { Readable } from 'node:stream';
import type { HttpClient } from './client.js';

/**
 * Range information
 */
interface RangeInfo {
  start: number;
  end?: number;
  size: number;
}

/**
 * Save options interface
 */
export interface SaveOptions {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  range?: [number, number];
  output: string;
  client?: HttpClient;
  onHeaders?: (headers: any, url: string, statusCode: number) => void;
  onData?: (data: Buffer | ArrayBuffer) => void;
  onError?: (error: Error, comment?: string) => void;
}

/**
 * Add range information to options
 * @param options - The request options
 * @param range - The byte range [start, end]
 * @returns Range information
 */
const withRange = (options: any, range?: [number, number]): RangeInfo => {
  if (range) {
    const [start, end] = range;
    const rangeString = `bytes=${start}-${end || ''}`;
    if (!options.headers) options.headers = {};
    options.headers.Range = rangeString;
    return { start, end, size: end - start + 1 };
  }
  return {} as RangeInfo;
};

/**
 * Convert a Web ReadableStream to a Node.js Readable stream
 * @param webStream - Web API ReadableStream
 * @returns Node.js Readable stream
 */
const webStreamToNode = (webStream: ReadableStream<Uint8Array>): Readable => {
  return Readable.fromWeb(webStream as any);
};

/**
 * Save a file from a URL
 * @param options - Save options
 * @returns Promise that resolves when the file is saved
 */
export const save = async (options: SaveOptions): Promise<void> => {
  const { url, method = 'GET', headers = {}, range, output, client, onHeaders, onData, onError } = options;

  if (!('user-agent' in headers) && !('User-Agent' in headers)) {
    headers['user-agent'] =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36';
  }

  const { start } = withRange({ headers }, range);

  try {
    // Use client if provided, otherwise use native fetch
    const response = client
      ? await client.createStream(url, { method, headers })
      : await fetch(url, { method, headers, redirect: 'follow' });

    const status = response.status;

    // Handle redirect manually if needed (though fetch follows redirects by default)
    if (status === 301 || status === 302 || status === 307 || status === 308) {
      const location = response.headers.get('location');
      if (location) {
        return save({
          url: location,
          method,
          headers,
          range,
          output,
          client,
          onHeaders,
          onData,
          onError,
        });
      }
    }

    // Convert headers to plain object for callback
    const headersObj: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headersObj[key] = value;
    });

    onHeaders?.(headersObj, url, status);

    if (onData) {
      const buffer = await response.arrayBuffer();
      onData?.(Buffer.from(buffer));
      return;
    }

    if (status >= 400) {
      return onError?.(new Error(`Request failed: ${status}`), `URL: ${url}`);
    }

    if (!response.body) {
      return onError?.(new Error('No response body'), `URL: ${url}`);
    }

    const streamOptions: { flags: string; start?: number } = { flags: 'w' };
    if (typeof start === 'number' && start > 0) {
      streamOptions.start = start;
      while (streamOptions.flags !== 'r+') {
        const exists = fs.existsSync(output);
        if (exists) streamOptions.flags = 'r+';
        else await setTimeout(100);
      }
    }

    const stream = fs.createWriteStream(output, streamOptions);
    const nodeStream = webStreamToNode(response.body);
    nodeStream.pipe(stream);

    if (onError) {
      stream.on('error', (error) => onError(error, 'Segment write stream error'));
      nodeStream.on('error', (error) => onError(error, 'Response stream error'));
    }

    await finished(stream);
  } catch (error: any) {
    return onError?.(error, 'Request error');
  }
};
