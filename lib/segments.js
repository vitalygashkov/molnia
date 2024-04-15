'use strict';

const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const { fetchWithStream } = require('./http');
const { createQueue } = require('./queue');
const { progress } = require('./progress');

const TEMP_DIR = '.tmp';

const createStream = ({ headers, opaque }) => {
  const { output, onSegmentHeaders } = opaque;
  try {
    Object.assign(opaque.headers || {}, headers || {});
  } catch (e) {
    console.log(e);
  }
  onSegmentHeaders?.(headers);
  const stream = fs.createWriteStream(output);
  return stream;
};

const downloadSegment = async ({ url, headers, output, onSegmentHeaders }) => {
  const options = {
    method: 'GET',
    headers: headers,
    opaque: { output, headers, onSegmentHeaders },
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
  } = options;

  const queue = createQueue(downloadSegment, connections);
  queue.error((error, task) => {
    if (error) console.log(error);
  });

  const onSegmentHeaders = (headers) => {
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
    queue.push({ url, headers, output: segmentOutput, onSegmentHeaders });
  }

  await new Promise((resolve) => (queue.drain = () => resolve()));

  const writeStream = fs.createWriteStream(output);
  for (const segmentOutput of segmentOutputs) {
    const data = fs.readFileSync(segmentOutput);
    const chunk = onChunkData?.(data) || data;
    writeStream.write(chunk);
    await fsp.unlink(segmentOutput).catch(() => null);
  }
  writeStream.end();
};

module.exports = { downloadSegments };
