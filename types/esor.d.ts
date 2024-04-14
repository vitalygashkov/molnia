export interface DownloadOptions {
  output?: string;
  headers?: Record<string, string>;
  connections?: number;
  onChunkData?: (data: Buffer) => Buffer | void;
}

export function download(url: string, options?: DownloadOptions): Promise<void>;

export function downloadSegments(
  urls: string[],
  options?: DownloadOptions,
): Promise<void>;
