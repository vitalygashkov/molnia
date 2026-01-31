import fsp from 'node:fs/promises';
import fs from 'node:fs';
import { dirname } from 'node:path';
import * as fastq from 'fastq';
import { DEFAULT_POOL_CONNECTIONS, createClient } from './client.js';
import { createProgress, type Progress } from './progress.js';
import { save, type SaveOptions } from './save.js';

export const MAX_CHUNK_SIZE_MB = 2;

/**
 * Calculate chunk size based on total size
 * @param size - Total file size in bytes
 * @returns Chunk size in bytes
 */
export const getChunkSize = (size: number): number => Math.floor(Math.min(size / 5, MAX_CHUNK_SIZE_MB * 1024 * 1024));

/**
 * Get byte ranges for chunked download
 * @param size - Total file size in bytes
 * @param connections - Number of concurrent connections
 * @returns Array of [start, end] byte ranges
 */
export const getRanges = (size: number, connections: number): [number, number][] => {
  let chunkSize = getChunkSize(size);

  let extraSize = 0;
  if (size / chunkSize < connections) {
    chunkSize = Math.floor(size / connections);
    extraSize = size % connections;
  }

  const n = extraSize ? Math.floor(size / chunkSize) : Math.ceil(size / chunkSize);

  const chunks: any[] = Array.from({ length: n });
  for (let i = 0; i < n; i += 1) {
    if (i < n - 1) chunks[i] = chunkSize;
    else chunks[i] = size - (n - 1) * chunkSize - extraSize;
    if (i < extraSize) chunks[i] += 1;
  }

  if (n > 1 && chunks[n - 1] < chunkSize / 2) {
    const diff = Math.floor(chunkSize / 2 - chunks[n - 1]);
    chunks[n - 1] += diff;
    chunks[n - 2] -= diff;
  }

  let sum = 0;
  const ranges: [number, number][] = [];
  for (let i = 0; i < n; i += 1) {
    const chunk = chunks[i];
    ranges.push([sum, sum + chunk - 1]);
    sum += chunk;
  }
  return ranges;
};

/**
 * Progressive download options interface
 */
export interface ProgressiveDownloadOptions {
  output?: string;
  headers?: Record<string, string>;
  connections?: number;
  onChunkData?: (data: Buffer | ArrayBuffer) => void;
  onProgress?: (progress: Progress) => void;
  onError?: (error: Error) => void;
  client?: any;
}

/**
 * Download a file progressively using multiple connections
 * @param url - The URL to download from
 * @param options - Download options
 * @param contentLength - Total content length in bytes
 * @param contentType - Content type string
 */
export const downloadProgressive = async (
  url: string,
  options: ProgressiveDownloadOptions = {},
  contentLength: number,
  contentType: string
): Promise<void> => {
  const { output, headers, connections = DEFAULT_POOL_CONNECTIONS, onChunkData, onProgress, onError } = options;
  const httpClient = options.client ?? createClient(options);
  const ranges = getRanges(contentLength, connections);

  if (!output) {
    throw new Error('Output path is required');
  }

  const dir = dirname(output);
  const dirExists = fs.existsSync(dir);
  if (!dirExists) await fsp.mkdir(dir, { recursive: true });

  if (fs.existsSync(output)) {
    // TODO: Resume download or rewrite
    console.log('File already exists. Download skipped.');
    return;
  }

  const queue = fastq.promise(save, connections);
  const progress = createProgress(ranges.length);

  progress.setTotal(contentLength);

  const onHeaders = (headers: any, _url: string, statusCode: number) => {
    if (headers['content-type'] !== contentType) {
      const msg = `Content type mismatch. Received ${headers['content-type']} instead of ${contentType}. Status: ${statusCode}`;
      queue.killAndDrain().then(() => onError?.(new TypeError(msg, { cause: new Error(JSON.stringify(headers)) })));
    }
    const size = parseInt(headers['content-length']);
    progress.increase(size);
    if (onProgress) onProgress(progress);
    else progress.log();
  };

  for (let i = 0; i < ranges.length; i += 1) {
    const saveOptions: SaveOptions = {
      url,
      headers,
      client: httpClient,
      range: ranges[i],
      output,
      onHeaders,
      onData: onChunkData,
      onError,
    };
    queue.push(saveOptions);
  }

  await queue.drained();
  progress.stop();
  if (!onProgress) progress.stopLog();

  const stat = await fsp.stat(output);
  const actualSize = stat.size;
  const expectedSize = contentLength;

  if (actualSize !== expectedSize) {
    onError?.(new Error(`Actual size ${actualSize} doesn't match expected size ${expectedSize}`));
  }
};
