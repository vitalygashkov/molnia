import { finished } from 'node:stream/promises';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { createProgress, type Progress } from './progress.js';
import { save, type SaveOptions } from './save.js';
import { DEFAULT_POOL_CONNECTIONS, createClient } from './client.js';
import { createQueue, type QueueWorker } from './queue.js';

/**
 * Get segment output file path
 * @param _url - Segment URL (unused but kept for API compatibility)
 * @param tempPath - Temporary directory path
 * @param index - Segment index
 * @returns Full path to segment file
 */
const getSegmentOutput = (_url: string, tempPath: string, index: number): string => {
  const filename = `segment_${index}.part`;
  return path.join(tempPath, filename);
};

/**
 * Clear a directory or file
 * @param targetPath - Path to clear
 */
const clear = async (targetPath: string): Promise<void> =>
  fsp.rm(targetPath, { recursive: true, force: true }).catch(() => undefined);

/**
 * Segment data interface
 */
export interface SegmentData {
  url: string;
  headers?: Record<string, string>;
}

/**
 * Segments download options interface
 */
export interface SegmentsDownloadOptions {
  output?: string;
  tempDir?: string;
  headers?: Record<string, string>;
  connections?: number;
  onChunkData?: (data: Buffer | ArrayBuffer) => void;
  onProgress?: (progress: Progress) => void;
  onError?: (error: Error, comment?: string) => void;
  dispatcher?: any;
}

/**
 * Download multiple segments and merge them into a single file
 * @param data - Array of segment data
 * @param options - Download options
 */
export const downloadSegments = async (
  data: SegmentData[],
  options: SegmentsDownloadOptions = {},
): Promise<void> => {
  const dispatcher = options.dispatcher ?? createClient(options);
  const {
    output,
    tempDir = process.cwd(),
    headers = {},
    connections = DEFAULT_POOL_CONNECTIONS,
    onChunkData,
    onProgress,
    onError,
  } = options;

  const tempDirInfo = await fsp.stat(tempDir).catch(() => null);
  if (!tempDirInfo || !tempDirInfo.isDirectory()) await fsp.mkdir(tempDir, { recursive: true });

  if (!output) {
    throw new Error('Output path is required');
  }

  const folder = path.parse(output).name;
  const tempPath = path.join(tempDir, folder);
  const tempPathInfo = await fsp.stat(tempPath).catch(() => null);
  if (!tempPathInfo || !tempPathInfo.isDirectory()) await fsp.mkdir(tempPath, { recursive: true });

  const queue = createQueue(save as QueueWorker<SaveOptions>, connections);
  const progress = createProgress(data.length);

  const onHeaders = (headers: any) => {
    const size = parseInt(headers['content-length']);
    progress.increase(size);
    if (onProgress) onProgress(progress);
    else progress.log();
  };

  const getErrorHandler = (saveOptions: SaveOptions) => (error: any, comment?: string) => {
    // https://github.com/nodejs/undici/issues/1923
    // https://github.com/nodejs/undici/issues/3300
    if (error.code?.includes('UND_ERR_SOCKET') || error.code?.includes('ECONNRESET')) {
      // Retry on socket or connection reset error
      return queue.push(saveOptions);
    } else {
      onError?.(
        error,
        comment || `Queue task error. Code: ${error.code}. Message: ${error.message}`,
      );
    }
    return undefined;
  };

  const segmentOutputs: string[] = [];
  for (let i = 0; i < data.length; i += 1) {
    const segment = data[i];
    if (!segment) continue;

    const { url, headers: segmentHeaders } = segment;
    const segmentOutput = getSegmentOutput(url, tempPath, i);
    segmentOutputs.push(segmentOutput);
    const saveOptions: SaveOptions = {
      url,
      headers: segmentHeaders || headers,
      dispatcher,
      output: segmentOutput,
      onHeaders,
      onData: onChunkData,
      onError,
    };
    saveOptions.onError = getErrorHandler(saveOptions);
    queue.push(saveOptions).catch(getErrorHandler(saveOptions));
  }

  await queue.drained();
  progress.stop();
  if (!onProgress) progress.stopLog();

  const dir = path.dirname(output);
  const dirExists = await fsp
    .stat(dir)
    .then(() => true)
    .catch(() => false);
  if (!dirExists) await fsp.mkdir(dir, { recursive: true });

  // Merge segments into one file
  const outputStream = fs.createWriteStream(output);
  outputStream.on('error', (error) => onError?.(error, 'Output write stream error'));
  for (const segmentOutput of segmentOutputs) {
    const segmentStream = fs.createReadStream(segmentOutput);
    segmentStream.on('error', (error) => onError?.(error, 'Segment read stream error'));
    segmentStream.pipe(outputStream, { end: false });
    await finished(segmentStream);
  }
  outputStream.end();
  await finished(outputStream);

  // Clear temp directory with segments
  await clear(tempPath);
};
