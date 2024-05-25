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
  const options = { method, headers, dispatcher };
  const { start } = withRange(options, range);
  const response = await request(url, options);
  onHeaders?.(response.headers, url, response.statusCode);
  if (onData) onData?.(await response.body.arrayBuffer());
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
  if (onError) stream.on('error', onError);
  await finished(stream);
};

module.exports = { save, withRange };
