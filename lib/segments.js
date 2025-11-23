'use strict';

const { finished } = require('node:stream/promises');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const { createProgress } = require('./progress');
const { save } = require('./save');
const { DEFAULT_POOL_CONNECTIONS, createClient } = require('./client');
const { createQueue } = require('./queue');
const {
  META_VERSION,
  getMetaPath,
  readMeta,
  writeMeta,
  removeMeta,
  handleProgress,
} = require('./metadata');

const getSegmentOutput = (url, tempPath, index) => {
  const filename = `segment_${index}.part`;
  return path.join(tempPath, filename);
};

const clear = async (targetPath) =>
  fsp.rm(targetPath, { recursive: true, force: true }).catch(() => null);

const downloadSegments = async (data, options = {}) => {
  const dispatcher = options.dispatcher ?? createClient(options);
  const {
    output,
    tempDir = process.cwd(),
    headers = {},
    connections = DEFAULT_POOL_CONNECTIONS,
    onChunkData,
    onProgress,
    onError,
    signal,
    overwrite,
    resume = true,
  } = options;

  const tempDirInfo = await fsp.stat(tempDir).catch(() => null);
  if (!tempDirInfo || !tempDirInfo.isDirectory())
    await fsp.mkdir(tempDir, { recursive: true });
  const folder = path.parse(output).name;
  const tempPath = path.join(tempDir, folder);
  const tempPathInfo = await fsp.stat(tempPath).catch(() => null);
  if (!tempPathInfo || !tempPathInfo.isDirectory())
    await fsp.mkdir(tempPath, { recursive: true });

  const metaPath = getMetaPath(output);

  if (overwrite || !resume) {
    await clear(tempPath);
    await removeMeta(metaPath);
  }

  const canonicalSegments = data.map(({ url, headers: segmentHeaders }) => ({
    url,
    headers: segmentHeaders || headers,
  }));

  let meta = resume ? await readMeta(metaPath) : null;
  if (
    !meta ||
    meta.version !== META_VERSION ||
    meta.output !== output ||
    !Array.isArray(meta.segments) ||
    meta.segments.length !== canonicalSegments.length ||
    meta.segments.some((s, i) => s.url !== canonicalSegments[i].url)
  ) {
    meta = {
      version: META_VERSION,
      output,
      segments: canonicalSegments,
      completed: Array(canonicalSegments.length).fill(false),
    };
    await writeMeta(metaPath, meta);
  }

  const queue = createQueue(async ({ index, saveOptions }) => {
    if (signal?.aborted) return;
    const error = await save(saveOptions);
    if (error instanceof Error) {
      // https://github.com/nodejs/undici/issues/1923
      // https://github.com/nodejs/undici/issues/3300
      if (
        error.code?.includes('UND_ERR_SOCKET') ||
        error.code?.includes('ECONNRESET')
      ) {
        if (!signal?.aborted) queue.push({ index, saveOptions });
      } else {
        onError?.(
          error,
          `Queue task error. Code: ${error.code}. Message: ${error.message}`,
        );
      }
      return;
    }
    meta.completed[index] = true;
    await writeMeta(metaPath, meta);
  }, connections);

  const progress = createProgress(data.length);

  const onHeaders = (headers) => {
    const size = parseInt(headers.get('content-length'));
    progress.increase(size);
    handleProgress(progress, onProgress);
  };

  const segmentOutputs = [];
  for (let i = 0; i < canonicalSegments.length; i += 1) {
    const { url, headers: segmentHeaders } = canonicalSegments[i];
    const segmentOutput = getSegmentOutput(url, tempPath, i);
    segmentOutputs.push(segmentOutput);

    if (resume && meta.completed[i]) continue;

    const saveOptions = {
      url,
      headers: segmentHeaders,
      dispatcher,
      output: segmentOutput,
      onHeaders,
      onData: onChunkData,
      onError,
      signal,
    };

    queue.push({ index: i, saveOptions });
  }

  await queue.drained();
  progress.stop();
  if (!onProgress) progress.stopLog();

  if (signal?.aborted) return;

  const allCompleted = Array.isArray(meta.completed)
    ? meta.completed.every(Boolean)
    : false;

  if (!allCompleted) {
    const error = new Error(
      'Not all segments were downloaded successfully. Try resuming later.',
    );
    onError?.(error, 'Segments incomplete');
    return;
  }

  const dir = path.dirname(output);
  const dirExists = await fsp
    .stat(dir)
    .then(() => true)
    .catch(() => false);
  if (!dirExists) await fsp.mkdir(dir, { recursive: true });

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

  // Clear temp directory with segments and metadata
  await clear(tempPath);
  await removeMeta(metaPath);
};

module.exports = { downloadSegments };
