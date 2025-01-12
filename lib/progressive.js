'use strict';

const fsp = require('node:fs/promises');
const fs = require('node:fs');
const { dirname } = require('node:path');
const { DEFAULT_POOL_CONNECTIONS } = require('./client');
const { createProgress } = require('./progress');
const { save } = require('./save');
const { createQueue } = require('./queue');

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

const downloadProgressive = async (
  url,
  options = {},
  contentLength,
  contentType,
) => {
  const {
    output,
    headers,
    connections = DEFAULT_POOL_CONNECTIONS,
    onChunkData,
    onProgress,
    onError,
  } = options;
  const ranges = getRanges(contentLength, connections);

  const dir = dirname(output);
  const dirExists = fs.existsSync(dir);
  if (!dirExists) await fsp.mkdir(dir, { recursive: true });

  if (fs.existsSync(output)) {
    // TODO: Resume download or rewrite
    return console.log('File already exists. Download skipped.');
  }

  const queue = createQueue(save, connections);
  const progress = createProgress(ranges.length);

  progress.setTotal(contentLength);

  const onHeaders = (headers, url, statusCode) => {
    if (headers['content-type'] !== contentType) {
      const msg = `Content type mismatch. Received ${headers['content-type']} instead of ${contentType}. Status: ${statusCode}`;
      queue
        .killAndDrain()
        .then(() =>
          onError?.(
            new TypeError(msg, { cause: new Error(JSON.stringify(headers)) }),
          ),
        );
    }
    const size = parseInt(headers['content-length']);
    progress.increase(size);
    if (onProgress) onProgress(progress);
  };

  for (let i = 0; i < ranges.length; i += 1) {
    const saveOptions = {
      url,
      headers,
      range: ranges[i],
      output,
      onHeaders,
      onData: onChunkData,
      onError,
    };
    queue.push(saveOptions);
  }

  await queue.drained();
  progress.stop();

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
