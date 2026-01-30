import ky, { type KyInstance } from 'ky';
import { createFetchWithProxy } from './proxy.js';

export const DEFAULT_MAX_RETRIES = 5;
export const DEFAULT_MAX_REDIRECTIONS = 5;
export const DEFAULT_POOL_CONNECTIONS = 5;

const DEFAULT_CONNECT_TIMEOUT = 300e3; // 5 minutes

/**
 * Client options interface
 */
export interface ClientOptions {
  connections?: number;
  maxRetries?: number;
  proxy?: string;
  fetch?: typeof fetch;
}

/**
 * Head response interface
 */
export interface HeadResponse {
  url: string;
  contentType: string | null;
  contentLength: number | null;
  acceptBytesRange: boolean;
  isProgressive: boolean;
  isCompressed: boolean;
  error?: string;
  [key: string]: any; // Additional headers
}

/**
 * Create an HTTP client with retry and proxy support
 * @param options - Client configuration options
 * @returns A configured HTTP client instance
 */
export const createClient = (options: ClientOptions = {}) => {
  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;

  // Create runtime-aware proxy fetch function
  const { proxy } = options;
  const customFetch = proxy ? createFetchWithProxy({ proxy, fetch: options.fetch }) : (options.fetch ?? fetch);

  // Create ky instance with custom fetch and built-in retry
  const client = ky.create({
    fetch: customFetch,
    timeout: DEFAULT_CONNECT_TIMEOUT,
    retry: {
      limit: maxRetries,
      methods: ['get', 'head'],
      statusCodes: [408, 413, 429, 500, 502, 503, 504],
      backoffLimit: 30000,
    },
    redirect: 'follow',
    headers: {
      'user-agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
    },
  });

  return client;
};

/**
 * Parse content length from headers
 * @param headers - HTTP headers
 * @returns The content length or null
 */
const parseContentLength = (headers: Headers): number | null => {
  const length = parseInt(headers.get('content-length') || '0');
  const range = headers.get('content-range');
  const lengthFromRange = range?.split('/')?.[1];
  return lengthFromRange ? parseInt(lengthFromRange) : length || null;
};

/**
 * Parse response headers into a structured object
 * @param response - The HTTP response
 * @returns A structured head response object
 */
export const parseHead = (response: Response): HeadResponse => {
  const { headers, url } = response;
  const encoding = headers.get('content-encoding') || '';
  const type = headers.get('content-type') || '';
  const isCompressed = !!encoding && ['gzip', 'deflate'].includes(encoding);
  const length = parseContentLength(headers);
  const acceptBytesRange =
    headers.get('accept-ranges') === 'bytes' || !!headers.get('content-range')?.includes('bytes');
  return {
    ...Object.fromEntries((headers as any).entries()),
    contentEncoding: encoding,
    contentType: type,
    contentLength: length,
    acceptBytesRange,
    isCompressed,
    isProgressive:
      (length && acceptBytesRange) || type.includes('video') || type.includes('audio') || type.includes('zip'),
    url,
  };
};

/**
 * Fetch HEAD information for a URL
 * @param input - The URL to fetch
 * @param options - Fetch options
 * @returns A head response object
 */
export const fetchHead = async (
  input: string,
  options: { headers?: Record<string, string>; client?: KyInstance } = {},
): Promise<HeadResponse> => {
  const client = options.client ?? createClient();
  try {
    const response = await client.get(input, {
      headers: { ...options.headers, Range: 'bytes=0-0' },
    });
    return parseHead(response);
  } catch (e: any) {
    return {
      contentType: null,
      contentLength: null,
      acceptBytesRange: false,
      isProgressive: false,
      isCompressed: false,
      url: input,
      error: e.message,
    };
  }
};
