#!/usr/bin/env node

'use strict';

const { getArgs } = require('./lib/args');
const { fetchHeaders } = require('./lib/http');
const { downloadProgressive } = require('./lib/progressive');
const { downloadDash } = require('./lib/dash');
const { downloadHls } = require('./lib/hls');

const parseOutput = (url, output) => output || url?.split('/').at(-1);

const download = async (url, output) => {
  const headers = await fetchHeaders(url);
  const parsedOutput = parseOutput(url, output);
  console.time(`File ${parsedOutput} downloaded`);
  if (headers.isDash) {
    await downloadDash(url, parsedOutput);
  } else if (headers.isHls) {
    await downloadHls(url, parsedOutput);
  } else if (headers.isProgressive) {
    await downloadProgressive(url, parsedOutput, headers);
  } else {
    console.error('File is not supported');
  }
  console.timeEnd(`File ${parsedOutput} downloaded`);
};

const args = getArgs();

const start = async () => {
  for (const url of args.positionals) {
    await download(url, args.output);
  }
};

if (args) start();

module.exports = { download };
