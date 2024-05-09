'use strict';

const { finished } = require('node:stream/promises');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const { createQueue } = require('./queue');
const { createProgress } = require('./progress');
const { save } = require('./save');

const getSegmentOutput = (url, tempPath, index) => {
  const { pathname } = new URL(url);
  const filename = path.basename(pathname);
  return path.join(tempPath, filename);
};

const downloadSegments = async (urls, options = {}) => {
  const {
    output,
    tempDir = process.cwd(),
    connections = 5,
    headers = {},
    onChunkData,
    onProgress,
    onError,
  } = options;

  const tempDirInfo = await fsp.stat(tempDir).catch(() => null);
  if (!tempDirInfo || !tempDirInfo.isDirectory()) await fsp.mkdir(tempDir);
  const tempPath = await fsp.mkdtemp(`${tempDir}${path.sep}.esor-`);

  const queue = createQueue(save, connections);
  queue.error((error, task) => {
    if (error) onError?.(error, task.url);
  });

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
    queue.push({
      url,
      headers,
      output: segmentOutput,
      onHeaders,
    });
  }

  await new Promise((resolve) => (queue.drain = () => resolve()));
  progress.stop();

  const outputStream = fs.createWriteStream(output);
  outputStream.on('error', (error) => onError?.(error));
  for (const segmentOutput of segmentOutputs) {
    // TODO: Use onChunkData to process segment
    const segmentStream = fs.createReadStream(segmentOutput);
    segmentStream.pipe(outputStream, { end: false });
    await finished(segmentStream);
  }
  outputStream.end();
  await finished(outputStream);
  await fsp.rm(tempPath, { recursive: true, force: true }).catch(() => null);
};

module.exports = { downloadSegments };
