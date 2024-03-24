'use strict';

const { setGlobalDispatcher, Agent, RetryAgent, request, stream } = require('undici');

const state = { agent: null };

const setFetchOptions = (options) => {
  if (state.agent && !state.agent.closed) state.agent.close();
  // https://github.com/nodejs/undici/issues/2986
  // const agent = new RetryAgent(new Agent());
  state.agent = new Agent({ maxRedirections: options.maxRedirections });
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
  const isXml = type.includes('xml');
  return {
    contentType: type,
    contentLength: length,
    acceptBytesRange,
    isDash: isXml,
    isHls: type.includes('mpegurl'),
    isProgressive: !isXml && !type.includes('mpegurl') && length && acceptBytesRange,
  };
};

const fetchHeaders = (url) => fetch(url, { method: 'HEAD' }).then(({ headers }) => parseHeaders(headers));

module.exports = { setFetchOptions, fetch, fetchWithStream, fetchHeaders, parseHeaders };
