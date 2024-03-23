'use strict';

const fs = require('node:fs');
const fsp = require('node:fs/promises');

const { fetchWithStream, parseHeaders } = require('./http');
const { createQueue } = require('./queue');
const { buildFile, getChunkTempPath, getChunkPath } = require('./files');

const getChunkSize = (size) => Math.floor(Math.min(size / 5, 20 * 1024 * 1024));

const getRanges = (size, connections) => {
  const chunkSize = getChunkSize(size);

  let extraSize = 0;
  if (size / chunkSize < connections) {
    chunkSize = Math.floor(size / connections);
    extraSize = size % connections;
  }

  const n = extraSize ? Math.floor(size / chunkSize) : Math.ceil(size / chunkSize);

  const chunks = Array(n);
  for (let i = 0; i < n; i += 1) {
    if (i < n - 1) chunks[i] = chunkSize;
    else chunks[i] = size - (n - 1) * chunkSize - extraSize;
    if (i < extraSize) chunks[i] += 1;
  }

  if (n > 1 && chunks[n - 1] < chunkSize / 2) {
    const diff = Math.floor(chunkSize / 2 - chunks[n - 1]);
    chunks[n - 1] += diff;
    chunks[n - 2] -= diff;
  }

  let sum = 0;
  const ranges = [];
  for (let i = 0; i < n; i += 1) {
    const chunk = chunks[i];
    ranges.push([sum, sum + chunk - 1]);
    sum += chunk;
  }
  return ranges;
};

const createStream = ({ statusCode, headers, opaque }) => {
  const { contentLength } = parseHeaders(headers);
  const { start, output, size } = opaque;
  let error = '';
  if (size && contentLength && size !== contentLength) {
    error = new Error(`Expecting content length of ${size} but got ${contentLength} when downloading chunk ${id}`);
    console.error(error);
    return;
  }
  if (statusCode !== 206) {
    error = new Error(`Expecting HTTP Status code 206 but got ${statusCode} when downloading chunk ${id}`);
    console.error(error);
    return;
  }
  if (!size && contentLength) size = contentLength;
  if (!size && id === 0 && contentLength) size = contentLength;
  const stream = fs.createWriteStream(output, { start, flags: 'a' });
  return stream;
};

const fetchRange = async ({ id, range, url, output }) => {
  const [start, end] = range;
  const size = end - start + 1;
  const options = {
    method: 'GET',
    headers: { Range: `bytes=${start}-${end}` },
    opaque: { size, output, start },
  };
  console.time('Download chunk ' + id);
  await fetchWithStream(url, options, createStream);
  console.timeEnd('Download chunk ' + id);
};

const onTaskFinish = (error, task) => {
  if (error) console.error(error);
  else console.log("Task '%s' finished", task.id);
};

const downloadProgressive = async (url, output, headers) => {
  const connections = 5;
  const queue = createQueue(fetchRange, connections);
  const ranges = getRanges(headers.contentLength, connections);
  queue.error(onTaskFinish);
  for (let i = 0; i < ranges.length; i += 1) {
    const [start, end] = ranges[i];
    const stats = await fsp.stat(output).catch(() => null);
    const fetchRangeOptions = { id: i, range: [start, end], url, output };
    if (!stats) {
      queue.push(fetchRangeOptions);
    } else {
      const size = end - start + 1;
      // TODO: Resume download or rewrite
    }
  }
  await new Promise((resolve) => (queue.drain = () => resolve()));
};

module.exports = { downloadProgressive };
