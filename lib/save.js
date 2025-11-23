'use strict';

const fs = require('node:fs');
const { setTimeout } = require('node:timers/promises');
const { finished } = require('node:stream/promises');
const { Writable } = require('node:stream');
const { fetch } = require('undici');

const withRange = (options = {}, range) => {
  if (range) {
    const [start, end] = range;
    const rangeString = `bytes=${start}-${end || ''}`;
    if (!options.headers) options.headers = {};
    options.headers.Range = rangeString;
    return { start, end, size: end - start + 1 };
  }
  return {};
};

const save = async ({
  url,
  method = 'GET',
  headers = {},
  range,
  output,
  dispatcher,
  onHeaders,
  onData,
  onError,
  signal,
}) => {
  if (!('user-agent' in headers) && !('User-Agent' in headers)) {
    headers['user-agent'] =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36';
  }

  const options = { method, headers, dispatcher, signal, redirect: 'follow' };
  const { start } = withRange(options, range);

  let response;
  try {
    response = await fetch(url, options);
  } catch (error) {
    onError?.(error, 'Request error');
    return error;
  }

  const status = response?.status;

  onHeaders?.(response.headers, url, response.status);

  if (onData) {
    try {
      const buffer = await response.arrayBuffer();
      onData(Buffer.from(buffer));
    } catch (error) {
      onError?.(error, 'Response data error');
      return error;
    }
  }

  if (status >= 400) {
    const error = new Error(`Request failed: ${status}`);
    onError?.(error, `URL: ${url}`);
    return error;
  }

  const streamOptions = { flags: 'w' };
  if (typeof start === 'number' && start > 0) {
    streamOptions.start = start;
    while (streamOptions.flags !== 'r+') {
      if (signal?.aborted) {
        onError?.(new Error('Aborted'));
        return;
      }
      const exists = fs.existsSync(output);
      if (exists) streamOptions.flags = 'r+';
      else await setTimeout(100);
    }
  }

  if (signal?.aborted) {
    onError?.(new Error('Aborted'));
    return;
  }

  const stream = fs.createWriteStream(output, streamOptions);
  stream.on('error', (error) => {
    onError?.(error, 'Segment write stream error');
  });

  try {
    const destination = Writable.toWeb(stream);
    await response.body.pipeTo(destination);
    await finished(stream);
    return null;
  } catch (error) {
    onError?.(error, 'Segment write stream error');
    return error;
  }
};

module.exports = { save, withRange };
