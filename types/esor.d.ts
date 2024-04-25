import { Progress } from './progress';

export interface DownloadOptions {
  output?: string;
  tempDir?: string;
  headers?: Record<string, string>;
  connections?: number;
  onChunkData?: (data: Buffer) => Buffer | void;
  onProgress?: (progress: Progress) => void;
  onError?: (error: Error) => void;
}

export type { Progress };

export function download(url: string, options?: DownloadOptions): Promise<void>;

export function downloadSegments(
  urls: string[],
  options?: DownloadOptions,
): Promise<void>;

export function setAgentOptions(options: {
  proxy?: string;
  retry?: number;
}): void;
