'use strict';

const {
  stream,
  setGlobalDispatcher,
  Agent,
  RetryAgent,
  ProxyAgent,
  Pool,
  Client,
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
    ? new ProxyAgent({ uri: proxy, ...opts, clientFactory: factory })
    : new Agent({ maxRedirections, ...opts, factory });
};

const setClientOptions = ({ retry, ...options }) => {
  if (hasClient()) state.client.close();
  state.client = withRetry(createClient(options), retry);
  setGlobalDispatcher(state.client);
};

const createPool = (url, options) => {
  const { origin, port } = new URL(url);
  const poolUrl = `${origin}:${port || '443'}`;
  const pool = new Pool(poolUrl, {
    connections: options.connections,
    maxRedirections: DEFAULT_MAX_REDIRECTIONS,
    // TODO: Fix issue that breaks Pool with RetryAgent to use retry
    // TODO: Fix ClientDestroyed when Agent or ProxyAgent using with createClient
    factory: (origin, opts) => {
      return new Client(origin, {
        ...opts,
        maxRedirections: DEFAULT_MAX_REDIRECTIONS,
      });
    },
  });
  return pool;
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
  const response = await fetch(input, {
    method: 'HEAD',
    redirect: 'follow',
  });
  return parseHead(response);
};

module.exports = {
  createClient,
  createPool,
  setClientOptions,
  fetchWithStream,
  fetchHead,
  parseHead,
};
