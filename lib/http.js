'use strict';

const {
  fetch,
  stream,
  setGlobalDispatcher,
  Agent,
  ProxyAgent,
  RetryAgent,
  RetryHandler,
} = require('undici');

const state = { client: null };

const hasClient = () => state.client && !state.client.closed;

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
];

const DEFAULT_MAX_RETRIES = 5;
const DEFAULT_MAX_REDIRECTIONS = 5;
const DEFAULT_POOL_CONNECTIONS = 5;

const withRetry = (client, maxRetries = DEFAULT_MAX_RETRIES) =>
  new RetryAgent(client, {
    maxRetries: maxRetries,
    errorCodes: RETRY_ERROR_CODES,
  });

const createClient = (options = {}) => {
  const maxRedirections = options.maxRedirections ?? DEFAULT_MAX_REDIRECTIONS;
  const agent = options.proxy
    ? new ProxyAgent({
        uri: options.proxy,
        maxRedirections,
      })
    : new Agent({ maxRedirections });
  return options.maxRetries ? withRetry(agent, options.maxRetries) : agent;
};

const createPool = (options = {}) => {
  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
  const errorCodes = RETRY_ERROR_CODES;
  const interceptor = (dispatch) => {
    return function InterceptedDispatch(opts, handler) {
      return dispatch(
        opts,
        new RetryHandler(
          { ...opts, retryOptions: { maxRetries, errorCodes } },
          { dispatch, handler },
        ),
      );
    };
  };
  const interceptors = { Pool: [interceptor] };

  const maxRedirections = options.maxRedirections ?? DEFAULT_MAX_REDIRECTIONS;
  const connections = options.connections || DEFAULT_POOL_CONNECTIONS;
  const pool = options.proxy
    ? new ProxyAgent({
        uri: options.proxy,
        maxRedirections,
        connections,
        interceptors,
      })
    : new Agent({
        maxRedirections,
        connections,
        interceptors,
      });
  return pool;
};

const setClientOptions = (options) => {
  if (hasClient()) state.client.close();
  state.client = createClient(options);
  setGlobalDispatcher(state.client);
};

const fetchWithStream = async (url, options = {}, streamFactory) => {
  return stream(url, options, streamFactory);
};

const parseContentLength = (headers) => {
  const length = parseInt(headers.get('content-length'));
  if (length > 1) return length;
  const range = headers.get('content-range');
  const lengthFromRange = range?.split('/')?.[1];
  return parseInt(lengthFromRange);
};

const parseHead = (response) => {
  const { headers, url } = response;
  const type = headers.get('content-type') || '';
  const length = parseContentLength(headers);
  const acceptBytesRange = headers.get('accept-ranges') === 'bytes';
  return {
    ...Object.fromEntries(headers.entries()),
    contentType: type,
    contentLength: length,
    acceptBytesRange,
    isProgressive:
      (length && acceptBytesRange) ||
      type.includes('video') ||
      type.includes('audio') ||
      type.includes('zip'),
    url,
  };
};

const fetchHead = async (input) => {
  try {
    const response = await fetch(input, {
      method: 'HEAD',
      dispatcher: state.client,
    });
    const head = parseHead(response);
    if (head.isProgressive && !head.contentLength) {
      const response = await fetch(input, {
        method: 'GET',
        dispatcher: state.client,
        headers: { Range: 'Bytes=0-0' },
      });
      return parseHead(response);
    }
  } catch (e) {
    return {
      contentType: null,
      contentLength: null,
      acceptBytesRange: false,
      isProgressive: false,
      url: input,
    };
  }
};

module.exports = {
  createClient,
  createPool,
  setClientOptions,
  fetchWithStream,
  fetchHead,
  parseHead,
  RETRY_ERROR_CODES,
  DEFAULT_MAX_RETRIES,
  DEFAULT_MAX_REDIRECTIONS,
  DEFAULT_POOL_CONNECTIONS,
};
