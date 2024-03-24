export interface DownloadOptions {
  output?: string;
  headers?: Record<string, string>;
  userAgent?: string;
}

export function download(url: string, options?: DownloadOptions): Promise<void>;
