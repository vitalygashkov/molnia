#!/usr/bin/env node

'use strict';

const { getArgs } = require('./lib/args');
const { fetchHeaders } = require('./lib/http');
const { downloadProgressive } = require('./lib/progressive');
const { downloadDash } = require('./lib/dash');
const { downloadHls } = require('./lib/hls');

const download = async (url, output) => {
  const headers = await fetchHeaders(url);
  console.time('Download');
  if (headers.isDash) {
    await downloadDash(url, output);
  } else if (headers.isHls) {
    await downloadHls(url, output);
  } else if (headers.isProgressive) {
    await downloadProgressive(url, output, headers);
  } else {
    console.error('File is not supported');
  }
  console.timeEnd('Download');
};

const args = getArgs();

const start = async () => {
  const progressiveUrl =
    'https://cdn.bitmovin.com/content/assets/art-of-motion-dash-hls-progressive/MI201109210084_mpeg-4_hd_high_1080p25_10mbits.mp4';
  const dashUrl =
    'https://cdn.bitmovin.com/content/assets/art-of-motion-dash-hls-progressive/mpds/f08e80da-bf1d-4e3d-8899-f0f6155f6efa.mpd';
  const hlsUrl =
    'https://cdn.bitmovin.com/content/assets/art-of-motion-dash-hls-progressive/m3u8s/f08e80da-bf1d-4e3d-8899-f0f6155f6efa.m3u8';
  const output = 'test.mp4';
  // await download(progressiveUrl, output);
};

if (args) start();

module.exports = { download };
