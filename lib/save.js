const fs = require('node:fs');
const fsp = require('node:fs/promises');
const { setTimeout } = require('node:timers/promises');
const { finished } = require('node:stream/promises');
const { request } = require('undici');

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
}) => {
  if (!('user-agent' in headers) && !('User-Agent' in headers)) {
    headers['user-agent'] =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36';
  }
  const options = { method, headers, dispatcher };
  const { start } = withRange(options, range);
  const response = await request(url, options).catch((error) =>
    onError?.(error, 'Request error'),
  );
  const status = response?.statusCode;
  onHeaders?.(response.headers, url, response.statusCode);
  if (onData) onData?.(await response.body.arrayBuffer());
  if (status >= 400)
    return onError?.(new Error(`Request failed: ${status}`), `URL: ${url}`);
  const streamOptions = { flags: 'w' };
  if (typeof start === 'number' && start > 0) {
    streamOptions.start = start;
    while (streamOptions.flags !== 'r+') {
      const stats = await fsp.stat(output).catch(() => null);
      if (stats) streamOptions.flags = 'r+';
      else await setTimeout(100);
    }
  }
  const stream = fs.createWriteStream(output, streamOptions);
  response.body.pipe(stream);
  if (onError)
    stream.on('error', (error) => onError(error, 'Segment write stream error'));
  await finished(stream);
};

module.exports = { save, withRange };
