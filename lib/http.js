'use strict';

const {
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
  'UND_ERR_SOCKET',
];

const setAgentOptions = (options) => {
  if (hasAgent()) state.agent.close();
  const agent = options.proxy
    ? new ProxyAgent(options.proxy)
    : new Agent({ allowH2: true, maxRedirections: 3 });
  state.agent = new RetryAgent(agent, {
    maxRetries: options.retry,
    errorCodes: RETRY_ERROR_CODES,
  });
  setGlobalDispatcher(state.agent);
};

const fetchWithStream = async (url, options = {}, streamFactory) => {
  const response = await stream(url, options, streamFactory);
  return response;
};

const parseHead = (headers, url) => {
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

const fetchHead = (url) =>
  fetch(url, { method: 'HEAD', redirect: 'follow' }).then(({ headers, url }) =>
    parseHead(headers, url),
  );

module.exports = {
  setAgentOptions,
  fetchWithStream,
  fetchHead,
  parseHead,
};
