#!/usr/bin/env node

import { parseOptions } from './lib/args.js';
import { fetchHead, createClient } from './lib/client.js';
import { downloadProgressive } from './lib/progressive.js';
import { save } from './lib/save.js';
import { downloadSegments } from './lib/segments.js';

/**
 * Download options interface
 */
export interface DownloadOptions {
  output?: string;
  tempDir?: string;
  headers?: Record<string, string>;
  connections?: number;
  maxRetries?: number;
  maxRedirections?: number;
  proxy?: string;
  onChunkData?: (data: Buffer | ArrayBuffer) => void;
  onProgress?: (progress: any) => void;
  onError?: (error: Error, url?: string) => void;
  dispatcher?: any;
}

/**
 * Parse output filename from URL
 * @param url - The URL to parse
 * @param output - Optional output filename
 * @returns The output filename
 */
const parseOutput = (url: string, output?: string): string =>
  output || url?.split('/').at(-1) || 'download';

/**
 * Download a file from a URL
 * @param url - The URL to download from
 * @param options - Download options
 */
export const download = async (url: string, options: DownloadOptions = {}): Promise<void> => {
  options.dispatcher = createClient(options);
  const head = await fetchHead(url, options);
  options.output = parseOutput(head.url, options.output);

  if (!options.output) {
    throw new Error('Output path is required');
  }

  if (head.isProgressive && !head.isCompressed) {
    await downloadProgressive(head.url, options, head.contentLength || 0, head.contentType || '');
  } else {
    await save({
      url: head.url,
      headers: options.headers,
      output: options.output,
      dispatcher: options.dispatcher,
    });
  }
};

export { downloadSegments };

// CLI entry point
const cliOptions = parseOptions();

const start = async (): Promise<void> => {
  if (cliOptions) {
    for (const url of cliOptions.urls) {
      await download(url, cliOptions as DownloadOptions);
    }
  }
};

if (cliOptions) start();
