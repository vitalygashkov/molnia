'use strict';

const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const { fetchWithStream } = require('./http');
const { createQueue } = require('./queue');

const TEMP_DIR = '.tmp';

const createStream = ({ opaque }) => {
  const { output } = opaque;
  const stream = fs.createWriteStream(output);
  return stream;
};

const downloadSegment = async ({ url, headers, output }) => {
  const options = { method: 'GET', headers: headers, opaque: { output } };
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

const downloadSegments = async (urls, { output } = {}) => {
  const connections = 5;
  const queue = createQueue(downloadSegment, connections);
  const segmentOutputs = [];
  for (let i = 0; i < urls.length; i += 1) {
    const url = urls[i];
    const segmentOutput = getSegmentOutput(url, output, i);
    segmentOutputs.push(segmentOutput);
    queue.push({ url, output: segmentOutput });
  }
  await new Promise((resolve) => (queue.drain = () => resolve()));

  const writeStream = fs.createWriteStream(output);
  for (const segmentOutput of segmentOutputs) {
    const data = fs.readFileSync(segmentOutput);
    writeStream.write(data);
    await fsp.unlink(segmentOutput).catch(() => null);
  }
  writeStream.end();
};

module.exports = { downloadSegments };
