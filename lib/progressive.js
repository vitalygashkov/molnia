'use strict';

const fsp = require('node:fs/promises');
const fs = require('node:fs');
const { dirname } = require('node:path');
const { DEFAULT_POOL_CONNECTIONS, createClient } = require('./client');
const { createProgress } = require('./progress');
const { save } = require('./save');
const { createQueue } = require('./queue');

const MAX_CHUNK_SIZE_MB = 2;
const META_VERSION = 1;

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

const getMetaPath = (output) => `${output}.part.json`;

const readMeta = async (metaPath) => {
  const metaExists = await fsp
    .stat(metaPath)
    .then(() => true)
    .catch(() => false);
  if (!metaExists) return null;
  try {
    const raw = await fsp.readFile(metaPath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const writeMeta = async (metaPath, meta) => {
  await fsp.writeFile(metaPath, JSON.stringify(meta));
};

const removeMeta = async (metaPath) =>
  fsp.rm(metaPath, { force: true }).catch(() => null);

const getTrustedPrefixIndex = (completed = []) => {
  let index = 0;
  while (index < completed.length && completed[index]) index += 1;
  return index;
};

const sumRanges = (ranges, count) => {
  let sum = 0;
  for (let i = 0; i < count && i < ranges.length; i += 1) {
    const [start, end] = ranges[i];
    sum += end - start + 1;
  }
  return sum;
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
    signal,
    overwrite,
    resume = true,
  } = options;
  const dispatcher = options.dispatcher ?? createClient(options);
  const ranges = getRanges(contentLength, connections);
  const metaPath = getMetaPath(output);

  const dir = dirname(output);
  const dirExists = fs.existsSync(dir);
  if (!dirExists) await fsp.mkdir(dir, { recursive: true });

  let fileExists = fs.existsSync(output);

  if (overwrite && fileExists) {
    await fsp.rm(output).catch(() => null);
    await removeMeta(metaPath);
    fileExists = false;
  }

  let meta = null;
  let isResume = false;

  if (resume) {
    meta = await readMeta(metaPath);
    if (
      meta &&
      meta.version === META_VERSION &&
      meta.url === url &&
      meta.output === output &&
      meta.contentLength === contentLength &&
      meta.contentType === contentType
    ) {
      isResume = fileExists;
    } else {
      meta = null;
    }
  }

  if (fileExists && !isResume && !overwrite) {
    return console.log('File already exists. Download skipped.');
  }

  if (!meta) {
    meta = {
      version: META_VERSION,
      url,
      output,
      contentLength,
      contentType,
      connections,
      ranges,
      completed: Array(ranges.length).fill(false),
    };
    await writeMeta(metaPath, meta);
  }

  const queue = createQueue(async ({ options: saveOptions, index }) => {
    if (signal?.aborted) return;
    const error = await save(saveOptions);
    if (error instanceof Error) return;
    if (typeof index === 'number') {
      meta.completed[index] = true;
      await writeMeta(metaPath, meta);
    }
  }, connections);

  const progress = createProgress(ranges.length);
  progress.setTotal(contentLength);

  let startIndex = 0;
  if (isResume) {
    startIndex = getTrustedPrefixIndex(meta.completed);
    const downloaded = sumRanges(ranges, startIndex);
    if (downloaded > 0) {
      progress.increase(downloaded);
      if (onProgress) onProgress(progress);
      else progress.log();
    }
  }

  const onHeaders = (headers, url, statusCode) => {
    if (headers.get('content-type') !== contentType) {
      const msg = `Content type mismatch. Received ${headers.get('content-type')} instead of ${contentType}. Status: ${statusCode}`;
      queue
        .killAndDrain()
        .then(() =>
          onError?.(
            new TypeError(msg, { cause: new Error(JSON.stringify(headers)) }),
          ),
        );
    }
    const size = parseInt(headers.get('content-length'));
    progress.increase(size);
    if (onProgress) onProgress(progress);
    else progress.log();
  };

  for (let i = startIndex; i < ranges.length; i += 1) {
    if (signal?.aborted) {
      queue.killAndDrain();
      break;
    }
    const saveOptions = {
      url,
      headers,
      dispatcher,
      range: ranges[i],
      output,
      onHeaders,
      onData: onChunkData,
      onError,
      signal,
    };
    queue.push({ options: saveOptions, index: i });
  }

  await queue.drained();
  progress.stop();
  if (!onProgress) progress.stopLog();

  if (signal?.aborted) return;

  const stat = await fsp.stat(output).catch(() => null);
  const actualSize = stat?.size;
  const expectedSize = contentLength;

  if (!actualSize || actualSize !== expectedSize) {
    onError?.(
      new Error(
        `Actual size ${actualSize} doesn't match expected size ${expectedSize}`,
      ),
    );
  } else {
    await removeMeta(metaPath);
  }
};

module.exports = { downloadProgressive };
