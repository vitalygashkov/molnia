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
  const {
    proxy,
    maxRedirections = DEFAULT_MAX_REDIRECTIONS,
    factory,
    opts = {},
  } = options;
  return proxy
    ? new ProxyAgent({
        uri: proxy,
        maxRedirections,
        ...opts,
        clientFactory: factory,
      })
    : new Agent({ maxRedirections, ...opts, factory });
};

const createPool = ({ retry, ...options } = {}) => {
  const maxRetries = retry || DEFAULT_MAX_RETRIES;
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

  const maxRedirections = options.maxRedirections || DEFAULT_MAX_REDIRECTIONS;
  const connections = options.connections || DEFAULT_POOL_CONNECTIONS;

  const pool = new Agent({
    maxRedirections,
    connections,
    interceptors: { Pool: [interceptor] },
  });

  return pool;
};

const setClientOptions = ({ retry, ...options }) => {
  if (hasClient()) state.client.close();
  const client = createClient(options);
  state.client = withRetry(client, retry);
  setGlobalDispatcher(state.client);
};

const fetchWithStream = async (url, options = {}, streamFactory) => {
  return stream(url, options, streamFactory);
};

const parseHead = (response) => {
  const { headers, url } = response;
  const type = headers.get('content-type');
  const length = parseInt(headers.get('content-length'));
  const acceptBytesRange = headers.get('accept-ranges') === 'bytes';
  return {
    contentType: type,
    contentLength: length,
    acceptBytesRange,
    isProgressive: length && acceptBytesRange,
    url,
  };
};

const fetchHead = async (input) => {
  const response = await fetch(input, { method: 'HEAD' });
  return parseHead(response);
};

module.exports = {
  createClient,
  createPool,
  setClientOptions,
  fetchWithStream,
  fetchHead,
  parseHead,
  RETRY_ERROR_CODES,
  DEFAULT_POOL_CONNECTIONS,
};
