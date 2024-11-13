'use strict';

const { ProxyAgent } = require('undici');

const createProxyAgent = ({
  uri,
  maxRedirections,
  connections,
  connectTimeout,
}) => new ProxyAgent({ uri, maxRedirections, connectTimeout, connections });

module.exports = { createProxyAgent };
