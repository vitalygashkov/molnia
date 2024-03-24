export interface DownloadOptions {
  output?: string;
  header?: Record<string, string>;
  'user-agent'?: string;
}

export function download(url: string, options?: DownloadOptions): Promise<void>;
