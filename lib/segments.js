'use strict';

const { finished } = require('node:stream/promises');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const { createProgress } = require('./progress');
const { save } = require('./save');
const { DEFAULT_POOL_CONNECTIONS, createPool } = require('./http');
const { createQueue } = require('./queue');

const getSegmentOutput = (url, tempPath, index) => {
  const filename = `segment-${index}.${path.extname(pathname) || 'part'}`;
  return path.join(tempPath, filename);
};

const clear = async (targetPath) =>
  fsp.rm(targetPath, { recursive: true, force: true }).catch(() => null);

const downloadSegments = async (urls, options = {}) => {
  const {
    output,
    tempDir = process.cwd(),
    headers = {},
    connections,
    onChunkData,
    onProgress,
    onError,
  } = options;

  const tempDirInfo = await fsp.stat(tempDir).catch(() => null);
  if (!tempDirInfo || !tempDirInfo.isDirectory()) await fsp.mkdir(tempDir);
  const folder = path.parse(filepath).name;
  const tempPath = path.join(tempDir, folder);
  const tempPathInfo = await fsp.stat(tempPath).catch(() => null);
  await clear(tempPath);
  if (!tempPathInfo || !tempPathInfo.isDirectory()) await fsp.mkdir(tempPath);

  const queue = createQueue(save, connections);
  const progress = createProgress(urls.length);

  const onHeaders = (headers, url, statusCode) => {
    const size = parseInt(headers['content-length']);
    progress.increase(size);
    if (onProgress) onProgress(progress);
    else console.log(progress.toString());
  };

  const segmentOutputs = [];
  for (let i = 0; i < urls.length; i += 1) {
    const url = urls[i];
    const segmentOutput = getSegmentOutput(url, tempPath, i);
    segmentOutputs.push(segmentOutput);
    const saveOptions = {
      url,
      headers,
      output: segmentOutput,
      onHeaders,
      onData: onChunkData,
      onError,
    };
    queue.push(saveOptions).catch((err) => err && onError?.(err));
  }

  await queue.drained();
  progress.stop();

  // Merge segments into one file
  const outputStream = fs.createWriteStream(output);
  outputStream.on('error', (error) => onError?.(error));
  for (const segmentOutput of segmentOutputs) {
    const segmentStream = fs.createReadStream(segmentOutput);
    segmentStream.pipe(outputStream, { end: false });
    await finished(segmentStream);
  }
  outputStream.end();
  await finished(outputStream);

  // Clear temp directory with segments
  await clear(tempPath);
};

module.exports = { downloadSegments };
