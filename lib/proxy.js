'use strict';

const { ProxyAgent } = require('undici');

const createProxyAgent = (uri, options = {}) =>
  new ProxyAgent({ uri, ...options });

module.exports = { createProxyAgent };
