'use strict';

const fsp = require('node:fs/promises');
const { basename } = require('node:path');
const { createQueue } = require('./queue');
const { save } = require('./save');
const { createProgress } = require('./progress');

const MAX_CHUNK_SIZE_MB = 2;
const getChunkSize = (size) =>
  Math.floor(Math.min(size / 5, MAX_CHUNK_SIZE_MB * 1024 * 1024));

const getRanges = (size, connections) => {
  let chunkSize = getChunkSize(size);

  let extraSize = 0;
  if (size / chunkSize < connections) {
    chunkSize = Math.floor(size / connections);
    extraSize = size % connections;
  }

  const n = extraSize
    ? Math.floor(size / chunkSize)
    : Math.ceil(size / chunkSize);

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

const downloadProgressive = async (url, options = {}, contentLength) => {
  const {
    output,
    headers,
    connections = 5,
    onChunkData,
    onProgress,
    onError,
  } = options;
  const ranges = getRanges(contentLength, connections);

  const queue = createQueue(save, connections);
  queue.error((error, task) => {
    if (error) onError?.(error, task.url);
  });

  const filename = basename(output);
  const stats = await fsp.stat(output).catch(() => null);
  if (stats) {
    // TODO: Resume download or rewrite
    return console.log('File already exists. Download skipped.');
  }

  const progress = createProgress(ranges.length);
  progress.state.total = contentLength;
  const onHeaders = (headers, url, statusCode) => {
    const size = parseInt(headers['content-length']);
    progress.increase(size);
    if (onProgress) onProgress(progress);
    else console.log(progress.toString());
  };

  for (let i = 0; i < ranges.length; i += 1) {
    const downloadChunkParams = {
      id: i,
      range: ranges[i],
      url,
      headers,
      output,
      onHeaders,
      onData: onChunkData,
    };
    queue.push(downloadChunkParams);
  }

  await new Promise((resolve) => (queue.drain = () => resolve()));
  progress.stop();

  // TODO: In Windows for some reason even after queue drain there are some unfinished tasks
  // Waiting for size checking temporarily fixes the issue but the problem still needs to be resolved

  const stat = await fsp.stat(output);
  const actualSize = stat.size;
  const expectedSize = contentLength;

  if (actualSize !== expectedSize) {
    onError?.(
      new Error(
        `Actual size ${actualSize} doesn't match expected size ${expectedSize}`,
      ),
    );
  }
};

module.exports = { downloadProgressive };
