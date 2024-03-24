#!/usr/bin/env node

'use strict';

const { parseOptions } = require('./lib/args');
const { fetchHeaders, setFetchOptions } = require('./lib/http');
const { downloadProgressive } = require('./lib/progressive');
const { downloadDash } = require('./lib/dash');
const { downloadHls } = require('./lib/hls');

const parseOutput = (url, output) => output || url?.split('/').at(-1);

const download = async (url, options) => {
  const headers = await fetchHeaders(url);
  options.output = parseOutput(url, options.output);
  console.time(`File ${options.output} downloaded`);
  if (headers.isDash) {
    await downloadDash(url, options);
  } else if (headers.isHls) {
    await downloadHls(url, options);
  } else if (headers.isProgressive) {
    await downloadProgressive(url, options, headers.contentLength);
  } else {
    console.error('File is not supported');
  }
  console.timeEnd(`File ${options.output} downloaded`);
};

const options = parseOptions();

const start = async () => {
  setFetchOptions({ maxRedirections: 5 });
  for (const url of options.urls) {
    await download(url, options);
  }
};

if (options) start();

module.exports = { download };
