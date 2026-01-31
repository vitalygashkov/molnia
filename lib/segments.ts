import { finished } from 'node:stream/promises';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import * as fastq from 'fastq';
import { createProgress, type Progress } from './progress.js';
import { save, type SaveOptions } from './save.js';
import { ClientOptions, DEFAULT_POOL_CONNECTIONS, createClient } from './client.js';
import { META_VERSION, getMetaPath, readMeta, writeMeta, removeMeta } from './metadata.js';

const MAX_RETRIES = 3;

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
 * Metadata interface for segments download
 */
interface SegmentsMeta {
  version: number;
  output: string;
  segments: Array<{ url: string; headers: Record<string, string> }>;
  completed: boolean[];
  bytesDownloaded: number;
}

/**
 * Segments download options interface
 */
export interface SegmentsDownloadOptions extends ClientOptions {
  output?: string;
  tempDir?: string;
  headers?: Record<string, string>;
  onChunkData?: (data: Buffer | ArrayBuffer) => void;
  onProgress?: (progress: Progress) => void;
  onError?: (error: Error, comment?: string) => void;
  signal?: AbortSignal;
  resume?: boolean;
  overwrite?: boolean;
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
  const client = createClient(options);
  const {
    output,
    tempDir = process.cwd(),
    headers = {},
    connections = DEFAULT_POOL_CONNECTIONS,
    onChunkData,
    onProgress,
    onError,
    signal,
    resume = true,
    overwrite = false,
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

  const metaPath = getMetaPath(output);

  // Clear or resume based on options
  if (overwrite || !resume) {
    await clear(tempPath);
    await removeMeta(metaPath);
  }

  const canonicalSegments = data.map(({ url, headers: segmentHeaders }) => ({
    url,
    headers: { ...headers, ...segmentHeaders },
  }));

  // Load or create metadata
  let meta: SegmentsMeta | null = resume
    ? ((await readMeta(metaPath)) as SegmentsMeta | null)
    : null;
  const isMetaVersionMismatch = meta?.version !== META_VERSION;
  const isMetaOutputMismatch = meta?.output !== output;
  const isMetaSegmentsEmpty = !Array.isArray(meta?.segments);
  const isMetaSegmentsCountMismatch = meta?.segments?.length !== canonicalSegments.length;

  if (
    !meta ||
    isMetaVersionMismatch ||
    isMetaOutputMismatch ||
    isMetaSegmentsEmpty ||
    isMetaSegmentsCountMismatch
  ) {
    meta = {
      version: META_VERSION,
      output,
      segments: canonicalSegments,
      completed: Array(canonicalSegments.length).fill(false),
      bytesDownloaded: 0,
    };
    await writeMeta(metaPath, meta);
  }

  // Track segment sizes as they come in
  const segmentSizes: Record<number, number> = {};
  const headersReceived: Record<number, boolean> = {};

  const createOnHeaders = (index: number) => (headers: Record<string, string>) => {
    if (headersReceived[index]) return;
    headersReceived[index] = true;
    const size = parseInt(headers['content-length'] || '0', 10);
    const validatedSize = Number.isNaN(size) || size < 0 ? 0 : size;
    segmentSizes[index] = validatedSize;
    progress.increase(validatedSize);
    if (onProgress) handleProgress(progress, onProgress);
  };

  const handleProgress = (p: Progress, op?: (progress: Progress) => void): void => {
    if (op) op(p);
    else p.log();
  };

  // Create queue with custom handler for resumability
  const queue = fastq.promise(
    async (params: {
      index: number;
      saveOptions: SaveOptions;
      segmentBytes?: number;
      retryCount?: number;
    }) => {
      if (signal?.aborted) return;
      const saveResult = await save(params.saveOptions);
      if (saveResult instanceof Error) {
        // Retry on socket or connection reset error
        const error = saveResult as Error & { code?: string };
        if (error.code?.includes('ECONNRESET') || error.code?.includes('UND_ERR_SOCKET')) {
          const retryCount = (params.retryCount || 0) + 1;
          if (retryCount < MAX_RETRIES) {
            if (!signal?.aborted) queue.push({ ...params, retryCount });
          } else {
            onError?.(
              error,
              `Max retries exceeded. Code: ${error.code}. Message: ${error.message}`,
            );
          }
        } else {
          onError?.(error, `Queue task error. Code: ${error.code}. Message: ${error.message}`);
        }
        return;
      }
      meta!.completed[params.index] = true;
      if (params.segmentBytes) {
        meta!.bytesDownloaded = (meta!.bytesDownloaded || 0) + params.segmentBytes;
      }
      await writeMeta(metaPath, meta!);
    },
    connections,
  );

  const progress = createProgress(data.length);
  progress.setCurrent(meta?.bytesDownloaded || 0);

  const segmentOutputs: string[] = [];
  for (let i = 0; i < canonicalSegments.length; i += 1) {
    const segment = canonicalSegments[i];
    if (!segment) continue;

    const { url, headers: segmentHeaders } = segment;
    const segmentOutput = getSegmentOutput(url, tempPath, i);
    segmentOutputs.push(segmentOutput);

    // Skip already completed segments when resuming
    if (resume && meta?.completed?.[i]) continue;

    const saveOptions: SaveOptions = {
      url,
      headers: segmentHeaders,
      client,
      output: segmentOutput,
      onHeaders: createOnHeaders(i),
      onData: onChunkData,
      onError,
    };

    queue.push({
      index: i,
      saveOptions,
      get segmentBytes(): number {
        return segmentSizes[i] || 0;
      },
    });
  }

  await queue.drained();
  progress.stop();
  if (!onProgress) progress.stopLog();

  if (signal?.aborted) return;

  // Check if all segments completed
  const allCompleted = Array.isArray(meta?.completed) ? meta.completed.every(Boolean) : false;

  if (!allCompleted) {
    const error = new Error('Not all segments were downloaded successfully. Try resuming later.');
    onError?.(error, 'Segments incomplete');
    return;
  }

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

  // Clear temp directory with segments and metadata
  await clear(tempPath);
  await removeMeta(metaPath);
};
