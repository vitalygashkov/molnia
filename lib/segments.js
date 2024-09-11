'use strict';

const { finished } = require('node:stream/promises');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const { createProgress } = require('./progress');
const { save } = require('./save');
const { DEFAULT_POOL_CONNECTIONS, setClientOptions } = require('./http');
const { createQueue } = require('./queue');

const getSegmentOutput = (url, tempPath, index) => {
  const filename = `segment_${index}.part`;
  return path.join(tempPath, filename);
};

const clear = async (targetPath) =>
  fsp.rm(targetPath, { recursive: true, force: true }).catch(() => null);

const downloadSegments = async (urls, options = {}) => {
  setClientOptions(options);
  const {
    output,
    tempDir = process.cwd(),
    headers = {},
    connections = DEFAULT_POOL_CONNECTIONS,
    onChunkData,
    onProgress,
    onError,
  } = options;

  const tempDirInfo = await fsp.stat(tempDir).catch(() => null);
  if (!tempDirInfo || !tempDirInfo.isDirectory())
    await fsp.mkdir(tempDir, { recursive: true });
  const folder = path.parse(output).name;
  const tempPath = path.join(tempDir, folder);
  const tempPathInfo = await fsp.stat(tempPath).catch(() => null);
  if (!tempPathInfo || !tempPathInfo.isDirectory())
    await fsp.mkdir(tempPath, { recursive: true });

  const queue = createQueue(save, connections);
  const progress = createProgress(urls.length);

  const onHeaders = (headers, url, statusCode) => {
    const size = parseInt(headers['content-length']);
    progress.increase(size);
    if (onProgress) onProgress(progress);
    else console.log(progress.toString());
  };

  const getErrorHandler = (saveOptions) => (error, comment) => {
    // https://github.com/nodejs/undici/issues/1923
    // https://github.com/nodejs/undici/issues/3300
    if (
      error.code?.includes('UND_ERR_SOCKET') ||
      error.code?.includes('ECONNRESET')
    ) {
      // Retry on socket or connection reset error
      return queue.push(saveOptions);
    } else {
      onError?.(
        error,
        comment ||
          `Queue task error. Code: ${error.code}. Message: ${error.message}`,
      );
    }
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
    saveOptions.onError = getErrorHandler(saveOptions);
    queue.push(saveOptions).catch(getErrorHandler(saveOptions));
  }

  await queue.drained();
  progress.stop();

  // Merge segments into one file
  const outputStream = fs.createWriteStream(output);
  outputStream.on('error', (error) =>
    onError?.(error, 'Output write stream error'),
  );
  for (const segmentOutput of segmentOutputs) {
    const segmentStream = fs.createReadStream(segmentOutput);
    segmentStream.on('error', (error) =>
      onError?.(error, 'Segment read stream error'),
    );
    segmentStream.pipe(outputStream, { end: false });
    await finished(segmentStream);
  }
  outputStream.end();
  await finished(outputStream);

  // Clear temp directory with segments
  await clear(tempPath);
};

module.exports = { downloadSegments };
