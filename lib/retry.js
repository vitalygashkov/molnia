'use strict';

const { RetryAgent } = require('undici');

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

const createRetryAgent = (client, maxRetries = DEFAULT_MAX_RETRIES) =>
  new RetryAgent(client, {
    maxRetries: maxRetries,
    errorCodes: RETRY_ERROR_CODES,
  });

module.exports = { createRetryAgent, RETRY_ERROR_CODES, DEFAULT_MAX_RETRIES };
