import { Progress } from './progress';

export interface DownloadOptions {
  output?: string;
  headers?: Record<string, string>;
  connections?: number;
  onChunkData?: (data: Buffer) => Buffer | void;
  onProgress?: (progress: Progress) => void;
}

export type { Progress };

export function download(url: string, options?: DownloadOptions): Promise<void>;

export function downloadSegments(
  urls: string[],
  options?: DownloadOptions,
): Promise<void>;
