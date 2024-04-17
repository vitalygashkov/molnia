'use strict';

const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const { fetchWithStream } = require('./http');
const { createQueue } = require('./queue');
const { createProgress } = require('./progress');

const TEMP_DIR = '.tmp';

const createStream = ({ headers, opaque }) => {
  const { url, output, onSegmentHeaders } = opaque;
  onSegmentHeaders?.(headers, url);
  const stream = fs.createWriteStream(output);
  return stream;
};

const downloadSegment = async ({ url, headers, output, onSegmentHeaders }) => {
  const options = {
    method: 'GET',
    headers: headers,
    opaque: { url, output, headers, onSegmentHeaders },
  };
  await fetchWithStream(url, options, createStream);
};

const getSegmentOutput = (url, output, index) => {
  const { pathname } = new URL(url);
  const workdir = path.dirname(output);
  const dir = path.join(workdir, TEMP_DIR);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const filename = path.basename(pathname);
  return path.join(dir, filename);
};

const downloadSegments = async (urls, options = {}) => {
  const {
    output,
    connections = 5,
    headers = {},
    onChunkData,
    onProgress,
    onError,
  } = options;
  const workdir = path.dirname(output);
  const tempdir = path.join(workdir, TEMP_DIR);

  const queue = createQueue(downloadSegment, connections);
  queue.error((error, task) => {
    if (error) onError?.(error);
  });

  const progress = createProgress(urls.length);
  const onSegmentHeaders = (headers, url) => {
    const size = parseInt(headers['content-length']);
    progress.increase(size);
    if (onProgress) onProgress(progress);
    else console.log(progress.toString());
  };

  const segmentOutputs = [];
  for (let i = 0; i < urls.length; i += 1) {
    const url = urls[i];
    const segmentOutput = getSegmentOutput(url, output, i);
    segmentOutputs.push(segmentOutput);
    queue.push({
      url,
      headers,
      output: segmentOutput,
      onSegmentHeaders,
    });
  }

  await new Promise((resolve) => (queue.drain = () => resolve()));

  const outputStream = fs.createWriteStream(output);
  outputStream.on('error', (error) => onError?.(error));
  for (const segmentOutput of segmentOutputs) {
    const data = fs.readFileSync(segmentOutput);
    const chunk = onChunkData?.(data) || data;
    outputStream.write(chunk);
  }
  outputStream.end();
  await new Promise((resolve) => outputStream.once('finish', resolve));
  await new Promise((resolve) => outputStream.on('close', resolve));
  await fsp.unlink(tempdir).catch(() => null);
};

module.exports = { downloadSegments };
