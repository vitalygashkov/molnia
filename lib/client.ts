import { HttpsProxyAgent } from 'https-proxy-agent';
import ky from 'ky';

/**
 * Error codes that should trigger a retry
 */
const RETRY_ERROR_CODES = [
  'ECONNRESET',
  'ECONNREFUSED',
  'ENOTFOUND',
  'ENETDOWN',
  'ENETUNREACH',
  'EHOSTDOWN',
  'EHOSTUNREACH',
  'ETIMEDOUT',
  'EPIPE',
  'ERR_ASSERTION',
] as const;

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
 * Custom HTTP client wrapper that supports proxy and retry logic
 */
export interface HttpClient {
  get: (url: string, options?: { headers?: Record<string, string> }) => Promise<Response>;
  head: (url: string, options?: { headers?: Record<string, string> }) => Promise<Response>;
  createStream: (url: string, options?: { method?: string; headers?: Record<string, string> }) => Promise<Response>;
}

/**
 * Create a retry wrapper with exponential backoff
 * @param fn - The function to retry
 * @param maxRetries - Maximum number of retries
 * @returns The result of the function
 */
const withRetry = async <T>(fn: () => Promise<T>, maxRetries: number): Promise<T> => {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;

      // Check if error code is retryable
      const errorCode = error.code || error.message;
      const isRetryable = RETRY_ERROR_CODES.some((code) => errorCode?.includes(code));

      if (!isRetryable || attempt === maxRetries) {
        throw error;
      }

      // Exponential backoff: 100ms, 200ms, 400ms, 800ms, etc.
      const delay = Math.min(100 * 2 ** attempt, 30000);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
};

/**
 * Create an HTTP client with retry and proxy support
 * @param options - Client configuration options
 * @returns A configured HTTP client instance
 */
export const createClient = (options: ClientOptions = {}): HttpClient => {
  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;

  // Create proxy agent if proxy is specified
  const agent = options.proxy ? new HttpsProxyAgent(options.proxy) : undefined;

  // Custom fetch function that handles proxy
  const customFetch = (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    if (agent) {
      // Node.js fetch supports dispatcher/agent via undici
      return fetch(input, {
        ...init,
        // @ts-ignore - Node.js fetch supports dispatcher option
        dispatcher: agent,
      });
    }
    return fetch(input, init);
  };

  // Create ky instance with custom fetch
  const client = ky.create({
    fetch: customFetch,
    timeout: DEFAULT_CONNECT_TIMEOUT,
    retry: {
      limit: 0, // We handle retries manually for better control
    },
    redirect: 'follow',
    headers: {
      'Accept-Encoding': 'gzip, deflate',
    },
  });

  return {
    get: (url: string, opts?: { headers?: Record<string, string> }) =>
      withRetry(() => client.get(url, opts).then((res) => res as unknown as Response), maxRetries),
    head: (url: string, opts?: { headers?: Record<string, string> }) =>
      withRetry(() => client.head(url, opts).then((res) => res as unknown as Response), maxRetries),
    createStream: (url: string, opts?: { method?: string; headers?: Record<string, string> }) =>
      withRetry(() => {
        return client
          .get(url, {
            ...opts,
            redirect: 'follow',
          })
          .then((res) => res as unknown as Response);
      }, maxRetries),
  };
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
    ...Object.fromEntries(headers.entries()),
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
  { headers, client }: { headers?: Record<string, string>; client?: HttpClient } = {},
): Promise<HeadResponse> => {
  const httpClient = client ?? createClient();

  try {
    const response = await httpClient.get(input, {
      headers: { ...headers, Range: 'bytes=0-0' },
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
