'use strict';

const {
  request,
  stream,
  setGlobalDispatcher,
  Agent,
  RetryAgent,
  ProxyAgent,
} = require('undici');

const state = { agent: null };

const hasAgent = () => state.agent && !state.agent.closed;

const RETRY_ERROR_CODES = [
  'ECONNRESET',
  'ECONNREFUSED',
  'ENOTFOUND',
  'ENETDOWN',
  'ENETUNREACH',
  'EHOSTDOWN',
  'EHOSTUNREACH',
  'EPIPE',
  'ERR_ASSERTION',
];

const setAgentOptions = (options) => {
  if (hasAgent()) state.agent.close();
  const agent = options.proxy ? new ProxyAgent(options.proxy) : new Agent();
  state.agent = new RetryAgent(agent, {
    maxRetries: options.retry,
    errorCodes: RETRY_ERROR_CODES,
  });
  setGlobalDispatcher(state.agent);
};

const fetch = async (url, options) => {
  const response = await request(url, options);
  return response;
};

const fetchWithStream = async (url, options = {}, streamFactory) => {
  const response = await stream(url, options, streamFactory);
  return response;
};

const parseHeaders = (headers) => {
  const type = headers['content-type'];
  const length = parseInt(headers['content-length']);
  const acceptBytesRange = headers['accept-ranges'] === 'bytes';
  return {
    contentType: type,
    contentLength: length,
    acceptBytesRange,
    isProgressive: length && acceptBytesRange,
  };
};

const fetchHeaders = (url) =>
  fetch(url, { method: 'HEAD' }).then(({ headers }) => parseHeaders(headers));

module.exports = {
  setAgentOptions,
  fetch,
  fetchWithStream,
  fetchHeaders,
  parseHeaders,
};
