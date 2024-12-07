'use strict';

const { fetch, setGlobalDispatcher, Agent } = require('undici');
const { createRetryAgent } = require('./retry');
const { createProxyAgent } = require('./proxy');

const state = { client: null };

const hasClient = () => state.client && !state.client.closed;

const DEFAULT_MAX_REDIRECTIONS = 5;
const DEFAULT_POOL_CONNECTIONS = 5;
const DEFAULT_CONNECT_TIMEOUT = 300e3; // 5 minutes
const DEFAULT_KEEP_ALIVE_TIMEOUT = 60000; // 60 seconds
const DEFAULT_KEEP_ALIVE_MAX_TIMEOUT = 300000; // 5 minutes

const createClient = (options = {}) => {
  const agentOptions = {
    maxRedirections: options.maxRedirections ?? DEFAULT_MAX_REDIRECTIONS,
    connections: options.connections ?? DEFAULT_POOL_CONNECTIONS,
    connectTimeout: DEFAULT_CONNECT_TIMEOUT,
    keepAliveTimeout: DEFAULT_KEEP_ALIVE_TIMEOUT,
    keepAliveMaxTimeout: DEFAULT_KEEP_ALIVE_MAX_TIMEOUT,
  };
  const agent = options.proxy
    ? createProxyAgent(options.proxy, agentOptions)
    : new Agent(agentOptions);
  return options.maxRetries
    ? createRetryAgent(agent, options.maxRetries)
    : agent;
};

const setClientOptions = (options) => {
  if (hasClient()) state.client.close();
  state.client = createClient(options);
  setGlobalDispatcher(state.client);
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
  const acceptBytesRange = headers.get('accept-ranges') === 'bytes';
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

const fetchHead = async (input, headers) => {
  try {
    const response = await fetch(input, {
      method: 'GET',
      dispatcher: state.client,
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
  setClientOptions,
  fetchHead,
  parseHead,
  DEFAULT_MAX_REDIRECTIONS,
  DEFAULT_POOL_CONNECTIONS,
};
