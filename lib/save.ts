import fs from 'node:fs';
import { setTimeout } from 'node:timers/promises';
import { finished } from 'node:stream/promises';
import { request, type Dispatcher } from 'undici';

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
  dispatcher?: Dispatcher;
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
 * Save a file from a URL
 * @param options - Save options
 * @returns Promise that resolves when the file is saved
 */
export const save = async (options: SaveOptions): Promise<void> => {
  const {
    url,
    method = 'GET',
    headers = {},
    range,
    output,
    dispatcher,
    onHeaders,
    onData,
    onError,
  } = options;

  if (!('user-agent' in headers) && !('User-Agent' in headers)) {
    headers['user-agent'] =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36';
  }

  const requestOptions = { method, headers, dispatcher };
  const { start } = withRange(requestOptions, range);
  const response = await request(url, requestOptions).catch((error) => error);

  if (response instanceof Error) {
    return onError?.(response, 'Request error');
  }

  const status = response?.statusCode;

  if (status === 301) {
    const location = response.headers.location;
    if (location) {
      return save({
        url: location,
        method,
        headers,
        range,
        output,
        dispatcher,
        onHeaders,
        onData,
        onError,
      });
    }
  }

  onHeaders?.(response.headers, url, response.statusCode);

  if (onData) {
    onData?.(await response.body.arrayBuffer());
  }

  if (status && status >= 400) {
    return onError?.(new Error(`Request failed: ${status}`), `URL: ${url}`);
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
  response.body.pipe(stream);

  if (onError) {
    stream.on('error', (error) => onError(error, 'Segment write stream error'));
  }

  await finished(stream);
};
