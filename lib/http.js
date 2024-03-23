'use strict';

const { setGlobalDispatcher, Agent, RetryAgent, request, stream } = require('undici');

const agent = new RetryAgent(
  new Agent({
    // TODO: Implement H2 support
    // allowH2: true,
  })
);
setGlobalDispatcher(agent);

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

module.exports = { fetch, fetchWithStream, fetchHeaders, parseHeaders };
