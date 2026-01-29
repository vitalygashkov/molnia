import {
  fetch,
  Agent,
  ProxyAgent,
  RetryAgent,
  interceptors,
  type Dispatcher,
  type Headers,
} from 'undici';

const { redirect } = interceptors;

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

  'UND_ERR_SOCKET',
  'UND_ERR_CONNECT_TIMEOUT',
] as const;

export const DEFAULT_MAX_RETRIES = 5;
export const DEFAULT_MAX_REDIRECTIONS = 5;
export const DEFAULT_POOL_CONNECTIONS = 5;

const DEFAULT_CONNECT_TIMEOUT = 300e3; // 5 minutes
const DEFAULT_KEEP_ALIVE_TIMEOUT = 60000; // 60 seconds
const DEFAULT_KEEP_ALIVE_MAX_TIMEOUT = 300000; // 5 minutes

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
 * Create an HTTP client with retry and redirect support
 * @param options - Client configuration options
 * @returns A dispatcher instance
 */
export const createClient = (options: ClientOptions = {}): Dispatcher => {
  const agentOptions = {
    connections: options.connections ?? DEFAULT_POOL_CONNECTIONS,
    connectTimeout: DEFAULT_CONNECT_TIMEOUT,
    keepAliveTimeout: DEFAULT_KEEP_ALIVE_TIMEOUT,
    keepAliveMaxTimeout: DEFAULT_KEEP_ALIVE_MAX_TIMEOUT,
    connect: {
      autoSelectFamilyAttemptTimeout: 500,
      rejectUnauthorized: false,
    },
  };

  const agent = (
    options.proxy
      ? new ProxyAgent({ uri: options.proxy, ...agentOptions })
      : new Agent(agentOptions)
  ).compose(
    redirect({
      maxRedirections: DEFAULT_MAX_REDIRECTIONS,
    } as any),
  );

  return new RetryAgent(agent, {
    maxRetries: options.maxRetries ?? DEFAULT_MAX_RETRIES,
    errorCodes: [...RETRY_ERROR_CODES],
  });
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
export const parseHead = (response: any): HeadResponse => {
  const { headers, url } = response;
  const encoding = headers.get('content-encoding') || '';
  const type = headers.get('content-type') || '';
  const isCompressed = !!encoding && ['gzip', 'deflate'].includes(encoding);
  const length = parseContentLength(headers);
  const acceptBytesRange =
    headers.get('accept-ranges') === 'bytes' || headers.get('content-range')?.includes('bytes');
  return {
    ...Object.fromEntries(headers.entries()),
    contentEncoding: encoding,
    contentType: type,
    contentLength: length,
    acceptBytesRange,
    isCompressed,
    isProgressive:
      (length && acceptBytesRange) ||
      type.includes('video') ||
      type.includes('audio') ||
      type.includes('zip'),
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
  { headers, dispatcher }: { headers?: Record<string, string>; dispatcher?: Dispatcher } = {},
): Promise<HeadResponse> => {
  try {
    const response = await fetch(input, {
      method: 'GET',
      dispatcher,
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
