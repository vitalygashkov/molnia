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

export type { Progress };

export function download(url: string, options?: DownloadOptions): Promise<void>;

export function downloadSegments(
  data: { url: string; headers?: Record<string, string> }[],
  options?: DownloadOptions,
): Promise<void>;
