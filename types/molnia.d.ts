import { Progress } from './progress';

export interface DownloadOptions {
  output?: string;
  tempDir?: string;
  headers?: Record<string, string>;
  connections?: number;
  maxRetries?: number;
  maxRedirections?: number;
  proxy?: string;
  signal?: AbortSignal;
  resume?: boolean;
  overwrite?: boolean;
  onChunkData?: (data: Buffer) => Buffer | void;
  onProgress?: (progress: Progress) => void;
  onError?: (error: Error, url?: string) => void;
}

export interface ProgressiveDownloadProgress {
  bytesDownloaded: number;
  totalBytes: number;
  percentComplete: number;
}

export interface SegmentedDownloadProgress {
  bytesDownloaded: number;
  totalBytes: null;
  percentComplete: number;
  segmentsCompleted: number;
  segmentsTotal: number;
}

export type DownloadProgress =
  | ProgressiveDownloadProgress
  | SegmentedDownloadProgress;

export type { Progress };

export function download(url: string, options?: DownloadOptions): Promise<void>;

export function downloadSegments(
  data: { url: string; headers?: Record<string, string> }[],
  options?: DownloadOptions,
): Promise<void>;

/**
 * Get progress info for a paused/interrupted download.
 * Works for both progressive and segmented downloads.
 * @param output - The output file path
 * @returns Progress info or null if no metadata exists
 */
export function getDownloadProgress(
  output: string,
): Promise<DownloadProgress | null>;

/**
 * Clean up a paused/interrupted download entirely.
 * Removes output file, metadata file, and temp segment folder.
 * @param output - The output file path
 * @param tempDir - Temp directory for segmented downloads (defaults to cwd)
 */
export function cleanupDownload(
  output: string,
  tempDir?: string,
): Promise<void>;
