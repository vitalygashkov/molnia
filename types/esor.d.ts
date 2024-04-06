export interface DownloadOptions {
  output?: string;
  headers?: Record<string, string>;
}

export function download(url: string, options?: DownloadOptions): Promise<void>;

export function downloadSegments(urls: string[], options?: DownloadOptions): Promise<void>;
