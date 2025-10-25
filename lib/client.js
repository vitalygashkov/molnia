'use strict';

const {
  fetch,
  Agent,
  ProxyAgent,
  RetryAgent,
  interceptors,
} = require('undici');

const { redirect } = interceptors;

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
const DEFAULT_CONNECT_TIMEOUT = 300e3; // 5 minutes
const DEFAULT_KEEP_ALIVE_TIMEOUT = 60000; // 60 seconds
const DEFAULT_KEEP_ALIVE_MAX_TIMEOUT = 300000; // 5 minutes

const createClient = (options = {}) => {
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
      throwOnMaxRedirects: true,
    }),
  );

  return new RetryAgent(agent, {
    maxRetries: options.maxRetries ?? DEFAULT_MAX_RETRIES,
    errorCodes: RETRY_ERROR_CODES,
  });
};

const parseContentLength = (headers) => {
  const length = parseInt(headers.get('content-length'));
  const range = headers.get('content-range');
  const lengthFromRange = range?.split('/')?.[1];
  return lengthFromRange ? parseInt(lengthFromRange) : length;
};

const parseHead = (response) => {
  const { headers, url } = response;
  const encoding = headers.get('content-encoding') || '';
  const type = headers.get('content-type') || '';
  const isCompressed = !!encoding && ['gzip', 'deflate'].includes(encoding);
  const length = parseContentLength(headers);
  const acceptBytesRange =
    headers.get('accept-ranges') === 'bytes' ||
    headers.get('content-range')?.includes('bytes');
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

const fetchHead = async (input, { headers, dispatcher } = {}) => {
  try {
    const response = await fetch(input, {
      method: 'GET',
      dispatcher,
      headers: { ...(headers || {}), Range: 'bytes=0-0' },
    });
    return parseHead(response);
  } catch (e) {
    return {
      contentType: null,
      contentLength: null,
      acceptBytesRange: false,
      isProgressive: false,
      url: input,
      error: e.message,
    };
  }
};

module.exports = {
  createClient,
  fetchHead,
  parseHead,
  DEFAULT_MAX_REDIRECTIONS,
  DEFAULT_POOL_CONNECTIONS,
  DEFAULT_MAX_RETRIES,
};
