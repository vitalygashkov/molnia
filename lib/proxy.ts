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

type FetchOptions = { proxy?: string };
type FetchFn = typeof fetch;

/**
 * Create a Node.js proxy fetch using https-proxy-agent
 * Uses the dispatcher option which is Node.js specific
 */
const createNodeProxyFetch = (options: FetchOptions): FetchFn => {
  if (!options.proxy) {
    return fetch;
  }

  const agent = new HttpsProxyAgent(options.proxy);

  return (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    return fetch(input, {
      ...init,
      // @ts-ignore - Node.js fetch supports dispatcher option via undici
      dispatcher: agent,
    });
  };
};

/**
 * Create a Bun proxy fetch using Bun's native proxy option
 * Bun v1.1.8+ supports the proxy option directly in fetch
 */
const createBunProxyFetch = (options: FetchOptions): FetchFn => {
  if (!options.proxy) {
    return fetch;
  }

  return (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    return fetch(input, {
      ...init,
      // @ts-ignore - Bun fetch supports proxy option
      proxy: options.proxy,
    });
  };
};

/**
 * Create a Deno proxy fetch using Deno.createHttpClient
 * Deno uses a client-based approach with proxy configuration
 */
const createDenoProxyFetch = (options: FetchOptions): FetchFn => {
  if (!options.proxy) {
    return fetch;
  }

  // Create HTTP client with proxy configuration
  const denoHttpClient = (globalThis as any).Deno.createHttpClient({
    proxy: { url: options.proxy },
  });

  return (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    return fetch(input, {
      ...init,
      // @ts-ignore - Deno fetch supports client option
      client: denoHttpClient,
    });
  };
};

/**
 * Create a proxy-aware fetch function based on the current runtime
 * @param options.proxy - Proxy URL in WHATWG format, e.g., http://127.0.0.1:8888
 */
export const createFetchWithProxy = ({ proxy }: FetchOptions): FetchFn => {
  const runtime = getRuntime();

  switch (runtime) {
    case 'bun':
      return createBunProxyFetch({ proxy });
    case 'deno':
      return createDenoProxyFetch({ proxy });
    case 'node':
      return createNodeProxyFetch({ proxy });
    default:
      return fetch;
  }
};
