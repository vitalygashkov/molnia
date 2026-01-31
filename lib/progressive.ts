import fsp from 'node:fs/promises';
import fs from 'node:fs';
import { dirname } from 'node:path';
import * as fastq from 'fastq';
import { DEFAULT_POOL_CONNECTIONS, createClient } from './client.js';
import { createProgress, type Progress } from './progress.js';
import { save, type SaveOptions } from './save.js';
import { META_VERSION, getMetaPath, readMeta, writeMeta, removeMeta } from './metadata.js';

export const MAX_CHUNK_SIZE_MB = 2;

/**
 * Calculate chunk size based on total size
 * @param size - Total file size in bytes
 * @returns Chunk size in bytes
 */
export const getChunkSize = (size: number): number =>
  Math.floor(Math.min(size / 5, MAX_CHUNK_SIZE_MB * 1024 * 1024));

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

  const chunks: number[] = [];
  for (let i = 0; i < n; i += 1) {
    const chunk = i < n - 1 ? chunkSize : size - (n - 1) * chunkSize - extraSize;
    chunks.push(i < extraSize ? chunk + 1 : chunk);
  }

  if (n > 1) {
    const lastChunk = chunks[n - 1];
    if (lastChunk !== undefined && lastChunk < chunkSize / 2) {
      const diff = Math.floor(chunkSize / 2 - lastChunk);
      chunks[n - 1] = lastChunk + diff;
      const secondLastChunk = chunks[n - 2];
      if (secondLastChunk !== undefined) {
        chunks[n - 2] = secondLastChunk - diff;
      }
    }
  }

  let sum = 0;
  const ranges: [number, number][] = [];
  for (let i = 0; i < n; i += 1) {
    const chunk = chunks[i];
    if (chunk !== undefined) {
      ranges.push([sum, sum + chunk - 1]);
      sum += chunk;
    }
  }
  return ranges;
};

/**
 * Get the index of the first incomplete chunk in the prefix
 * @param completed - Array of completed flags
 * @returns Index of first incomplete chunk
 */
const getTrustedPrefixIndex = (completed: boolean[]): number => {
  let index = 0;
  while (index < completed.length && completed[index]) index += 1;
  return index;
};

/**
 * Sum the bytes of completed ranges
 * @param ranges - Array of [start, end] ranges
 * @param count - Number of completed ranges
 * @returns Total bytes downloaded
 */
const sumRanges = (ranges: [number, number][], count: number): number => {
  let sum = 0;
  for (let i = 0; i < count && i < ranges.length; i += 1) {
    const range = ranges[i];
    if (range) {
      const [start, end] = range;
      sum += end - start + 1;
    }
  }
  return sum;
};

/**
 * Progressive download metadata interface
 */
interface ProgressiveMeta {
  version: number;
  url: string;
  output: string;
  contentLength: number;
  contentType: string;
  connections: number;
  ranges: [number, number][];
  completed: boolean[];
  bytesDownloaded: number;
}

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
  client?: unknown;
  signal?: AbortSignal;
  resume?: boolean;
  overwrite?: boolean;
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
  contentType: string,
): Promise<void> => {
  const {
    output,
    headers,
    connections = DEFAULT_POOL_CONNECTIONS,
    onChunkData,
    onProgress,
    onError,
    signal,
    overwrite = false,
    resume = true,
  } = options;
  const httpClient = options.client ?? createClient(options);
  const ranges = getRanges(contentLength, connections);
  const metaPath = getMetaPath(output ?? '');

  if (!output) {
    throw new Error('Output path is required');
  }

  const dir = dirname(output);
  const dirExists = fs.existsSync(dir);
  if (!dirExists) await fsp.mkdir(dir, { recursive: true });

  let fileExists = fs.existsSync(output);

  if (overwrite && fileExists) {
    await fsp.rm(output).catch(() => undefined);
    await removeMeta(metaPath);
    fileExists = false;
  }

  let meta: ProgressiveMeta | null = null;
  let isResume = false;

  if (resume) {
    meta = (await readMeta(metaPath)) as ProgressiveMeta | null;
    if (
      meta &&
      meta.version === META_VERSION &&
      meta.url === url &&
      meta.output === output &&
      meta.contentLength === contentLength &&
      meta.contentType === contentType
    ) {
      isResume = fileExists;
    } else {
      meta = null;
    }
  }

  if (fileExists && !isResume && !overwrite) {
    console.log('File already exists. Download skipped.');
    return;
  }

  if (!meta) {
    meta = {
      version: META_VERSION,
      url,
      output,
      contentLength,
      contentType,
      connections,
      ranges,
      completed: Array(ranges.length).fill(false),
      bytesDownloaded: 0,
    };
    await writeMeta(metaPath, meta);
  }

  // Create queue with custom handler for resumability
  const queue = fastq.promise(async (task: { saveOptions: SaveOptions; index: number }) => {
    if (signal?.aborted) return;
    const { saveOptions, index } = task;
    const error = await save(saveOptions);
    if (error instanceof Error) return;
    if (typeof index === 'number') {
      const range = ranges[index];
      if (range) {
        const [start, end] = range;
        const chunkBytes = end - start + 1;
        meta!.completed[index] = true;
        meta!.bytesDownloaded = (meta!.bytesDownloaded || 0) + chunkBytes;
        await writeMeta(metaPath, meta!);
      }
    }
  }, connections);

  const progress = createProgress(ranges.length);
  progress.setCurrent(meta?.bytesDownloaded || 0);
  progress.setTotal(contentLength);

  let startIndex = 0;
  if (isResume && meta) {
    startIndex = getTrustedPrefixIndex(meta.completed);
    const downloaded = sumRanges(ranges, startIndex);
    if (downloaded > 0) {
      progress.increase(downloaded);
    }
  }

  const handleProgress = (p: Progress, op?: (progress: Progress) => void): void => {
    if (op) op(p);
    else p.log();
  };

  const onHeaders = (responseHeaders: Record<string, string>, _url: string, statusCode: number) => {
    const contentTypeHeader = responseHeaders['content-type'] || responseHeaders['Content-Type'];
    if (contentTypeHeader !== contentType) {
      const msg = `Content type mismatch. Received ${contentTypeHeader} instead of ${contentType}. Status: ${statusCode}`;
      queue.killAndDrain().then(() => onError?.(new TypeError(msg)));
    }
    const size = parseInt(responseHeaders['content-length'] || '0');
    progress.increase(size);
    handleProgress(progress, onProgress);
  };

  for (let i = startIndex; i < ranges.length; i += 1) {
    if (signal?.aborted) {
      queue.killAndDrain();
      break;
    }
    const range = ranges[i];
    if (!range) continue;
    const [start, end] = range as [number, number];
    const saveOptions: SaveOptions = {
      url,
      headers,
      client: httpClient as any,
      range: [start, end],
      output,
      onHeaders,
      onData: onChunkData,
      onError,
    };
    queue.push({ saveOptions, index: i });
  }

  await queue.drained();
  progress.stop();
  if (!onProgress) progress.stopLog();

  if (signal?.aborted) return;

  const stat = await fsp.stat(output).catch(() => null);
  const actualSize = stat?.size;
  const expectedSize = contentLength;

  if (!actualSize || actualSize !== expectedSize) {
    onError?.(new Error(`Actual size ${actualSize} doesn't match expected size ${expectedSize}`));
  } else {
    await removeMeta(metaPath);
  }
};
