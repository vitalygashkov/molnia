const fs = require('node:fs');
const { fetchWithStream } = require('./http');

const createStream = ({ headers, opaque, statusCode }) => {
  const { url, output, start, onHeaders, onData } = opaque;
  onHeaders?.(headers, url, statusCode);
  const options = start ? { start, flags: 'a' } : {};
  const stream = fs.createWriteStream(output, options);
  return stream;
};

const save = async ({
  url,
  headers = {},
  range,
  output,
  onHeaders,
  onData,
}) => {
  const options = {
    method: 'GET',
    headers: headers,
    opaque: { url, output, headers, onHeaders, onData },
  };
  if (range) {
    const [start, end] = range;
    const rangeString = `bytes=${start}-${end}`;
    options.headers.Range = rangeString;
    options.opaque.start = start;
    options.opaque.size = end - start + 1;
  }
  await fetchWithStream(url, options, createStream);
};

module.exports = { save };
