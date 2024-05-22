const fs = require('node:fs');
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
}) => {
  const options = { method, headers, dispatcher };
  const { start } = withRange(options, range);
  const response = await request(url, options);
  onHeaders?.(response.headers, url, response.statusCode);
  if (onData) onData?.(await response.body.arrayBuffer());
  const streamOptions = { start, flags: 'a+' };
  const stream = fs.createWriteStream(output, streamOptions);
  response.body.pipe(stream);
  await finished(stream);
};

module.exports = { save, withRange };
