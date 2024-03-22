'use strict';

const undici = require('undici');

undici.setGlobalDispatcher(new undici.Agent({ allowH2: true }));

const parseHeaders = (headers) => {
  const type = headers['content-type'];
  const length = parseInt(headers['content-length']);
  const isXml = type.includes('xml');
  const acceptBytesRange = headers['accept-ranges'] === 'bytes';
  return {
    contentType: type,
    isDash: isXml,
    isHls: type.includes('mpegurl'),
    isProgressive: !isXml && !type.includes('mpegurl') && length && acceptBytesRange,
    contentLength: length,
    acceptBytesRange,
  };
};

const fetchHead = async (url) => {
  const response = await undici.request(url, { method: 'HEAD' });
  console.log(response.headers);
  return parseHeaders(response.headers);
};

const request = async (url, options = {}, streamFactory) => {
  const response = await undici.stream(url, options, streamFactory);
  return response;
};

module.exports = { request, fetchHead, parseHeaders };
