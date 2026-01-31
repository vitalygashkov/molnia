/**
 * Cross-runtime proxy-aware fetch implementation
 * Supports Node.js (via https-proxy-agent), Bun (native), and Deno (native)
 */

import { HttpsProxyAgent } from 'https-proxy-agent';

/**
 * Detect the current JavaScript runtime
 * @returns The detected runtime: 'node', 'bun', 'deno', 'browser', or 'unknown'
 */
export const getRuntime = () => {
  if ('Bun' in globalThis) return 'bun';
  if ('Deno' in globalThis) return 'deno';
  if ('process' in globalThis && process.versions?.node) return 'node';
  if ('document' in globalThis) return 'browser';
  return 'unknown';
};

type FetchFn = typeof fetch;
type FetchOptions = { proxy: string; fetch?: FetchFn };

const withCustomFetchOptions = (
  options: Record<string, unknown>,
  customFetch?: FetchFn,
): FetchFn => {
  return (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    return (customFetch ?? fetch)(input, { ...init, ...options });
  };
};

/**
 * Create a Node.js proxy fetch using https-proxy-agent
 * Uses the dispatcher option which is Node.js specific
 */
const createNodeProxyFetch = (options: FetchOptions): FetchFn => {
  const dispatcher = new HttpsProxyAgent(options.proxy);
  return withCustomFetchOptions({ dispatcher }, options.fetch);
};

/**
 * Create a Bun proxy fetch using Bun's native proxy option
 * Bun v1.1.8+ supports the proxy option directly in fetch
 */
const createBunProxyFetch = (options: FetchOptions): FetchFn => {
  return withCustomFetchOptions({ proxy: options.proxy }, options.fetch);
};

/**
 * Create a Deno proxy fetch using Deno.createHttpClient
 * Deno uses a client-based approach with proxy configuration
 */
const createDenoProxyFetch = (options: FetchOptions): FetchFn => {
  const client = (globalThis as any).Deno.createHttpClient({ proxy: { url: options.proxy } });
  return withCustomFetchOptions({ client }, options.fetch);
};

/**
 * Create a proxy-aware fetch function based on the current runtime
 * @param options.proxy - Proxy URL in WHATWG format, e.g., http://127.0.0.1:8888
 */
export const createFetchWithProxy = (options: FetchOptions): FetchFn => {
  const runtime = getRuntime();
  if (!options.proxy) return options.fetch ?? fetch;
  switch (runtime) {
    case 'bun':
      return createBunProxyFetch(options);
    case 'deno':
      return createDenoProxyFetch(options);
    case 'node':
      return createNodeProxyFetch(options);
    default:
      return options.fetch ?? fetch;
  }
};
