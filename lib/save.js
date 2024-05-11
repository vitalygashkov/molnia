const fs = require('node:fs');
const { fetchWithStream } = require('./http');

const appendRange = (options = {}, range = {}) => {
  if (range) {
    const [start, end = ''] = range;
    const rangeString = `bytes=${start}-${end}`;
    if (!options.headers) options.headers = {};
    options.headers.Range = rangeString;
    options.opaque.start = start;
    options.opaque.size = end - start + 1;
  }
};

// TODO: In Windows for some reason final mp4 file downloads corrupted (while in macOS it works fine)
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
  appendRange(options, range);
  await fetchWithStream(url, options, createStream);
};

const createSave = (dispatcher) => {
  const save = ({ url, headers = {}, range, output, onHeaders, onData }) => {
    const { origin, pathname: path } = new URL(url);
    const options = {
      origin,
      path,
      method: 'GET',
      headers: headers,
      opaque: { url, output, headers, onHeaders, onData },
    };
    appendRange(options, range);
    return dispatcher.stream(options, createStream);
  };
  return save;
};

module.exports = { save, createSave, appendRange };
