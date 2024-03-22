#!/usr/bin/env node

'use strict';

const fs = require('node:fs');
const fsp = require('node:fs/promises');

const { request, fetchHead, parseHeaders } = require('./lib/request');
const { createQueue } = require('./lib/queue');
const { buildFile, getChunkTempPath, getChunkPath } = require('./lib/files');
const { downloadDash } = require('./lib/dash');
const { downloadHls } = require('./lib/hls');

const getChunkSize = (size) => Math.floor(Math.min(size / 10, 10 * 1024 * 1024));

const getRanges = (size, connections) => {
  const chunkSize = getChunkSize(size);

  let extraSize = 0;
  if (size / chunkSize < connections) {
    chunkSize = Math.floor(size / connections);
    extraSize = size % connections;
  }

  const n = extraSize ? Math.floor(size / chunkSize) : Math.ceil(size / chunkSize);

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

const fetchRange = async ({ id, range, url, output }) => {
  const [start, end] = range;
  let size = end - start + 1;
  const target = getChunkTempPath(output, id);
  const options = {
    method: 'GET',
    headers: { Range: `bytes=${start}-${end}` },
    opaque: { target },
  };
  await request(url, options, ({ statusCode, headers, opaque }) => {
    const { contentLength } = parseHeaders(headers);
    let error = '';
    if (size && contentLength && size !== contentLength) {
      error = new Error(`Expecting content length of ${size} but got ${contentLength} when downloading chunk ${id}`);
      console.error(error);
      return;
    }
    if (statusCode !== 206) {
      error = new Error(`Expecting HTTP Status code 206 but got ${statusCode} when downloading chunk ${id}`);
      console.error(error);
      return;
    }
    if (!size && contentLength) size = contentLength;
    if (!size && id === 0 && contentLength) size = contentLength;
    return fs.createWriteStream(opaque.target);
  });
  const stats = await fsp.stat(target).catch(() => null);
  if (stats) {
    await fsp.rename(target, getChunkPath(output, id));
    const progress = { bytes: 0, percentage: 0 };
    progress.bytes += stats.size;
    progress.percentage = size ? (100 * progress.bytes) / size : 0;
    // console.log(progress);
  }
  return stats;
};

const downloadProgressive = async (url, output, headers) => {
  const connections = 10;
  const queue = createQueue(fetchRange, connections);
  const ranges = getRanges(headers.contentLength, connections);
  queue.error((err) => err && console.error(err));
  for (let i = 0; i < ranges.length; i += 1) {
    const [start, end] = ranges[i];
    const chunkStats = await fsp.stat(getChunkPath(output, i)).catch(() => null);
    const fetchRangeOptions = { id: i, range: [start, end], url, output };
    if (!chunkStats) {
      queue.push(fetchRangeOptions);
      continue;
    }
    const size = end - start + 1;
    if (chunkStats.size > size) throw new Error(`Expecting maximum chunk size of ${size} but got: ${chunkStats.size}`);
    if (chunkStats.size === size) {
      // Chunk already downloaded, resume downloading
      console.log('Chunk already downloaded, resume downloading..');
    } else {
      queue.push(fetchRangeOptions);
    }
  }
  await new Promise((resolve) => (queue.drain = () => buildFile(output, ranges.length).then(resolve)));
};

const download = async (url, output) => {
  const headers = await fetchHead(url);
  console.log(new Date().toUTCString());
  if (headers.isDash) {
    await downloadDash(url, output);
  } else if (headers.isHls) {
    await downloadHls(url, output);
  } else if (headers.isProgressive) {
    await downloadProgressive(url, output, headers);
  } else {
    console.error('File is not supported');
  }
  console.log(new Date().toUTCString());
};

(async () => {
  const progressiveUrl =
    'https://cdn.bitmovin.com/content/assets/art-of-motion-dash-hls-progressive/MI201109210084_mpeg-4_hd_high_1080p25_10mbits.mp4';
  const dashUrl =
    'https://cdn.bitmovin.com/content/assets/art-of-motion-dash-hls-progressive/mpds/f08e80da-bf1d-4e3d-8899-f0f6155f6efa.mpd';
  const hlsUrl =
    'https://cdn.bitmovin.com/content/assets/art-of-motion-dash-hls-progressive/m3u8s/f08e80da-bf1d-4e3d-8899-f0f6155f6efa.m3u8';
  const output = 'test.mp4';
  await download(progressiveUrl, output);
})();
