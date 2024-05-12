#!/usr/bin/env node

'use strict';

const { parseOptions } = require('./lib/args');
const { fetchHead, setClientOptions } = require('./lib/http');
const { downloadProgressive } = require('./lib/progressive');
const { save } = require('./lib/save');
const { downloadSegments } = require('./lib/segments');

const parseOutput = (url, output) => output || url?.split('/').at(-1);

const download = async (url, options = {}) => {
  const head = await fetchHead(url);
  options.output = parseOutput(head.url, options.output);
  if (head.isProgressive) {
    await downloadProgressive(head.url, options, head.contentLength, head.contentType);
  } else {
    await save({ url: head.url, headers: head, output: options.output });
  }
};

const options = parseOptions();

setClientOptions({ retry: options?.retry, proxy: options?.proxy });

const start = async () => {
  for (const url of options.urls) await download(url, options);
};

if (options) start();

module.exports = { download, downloadSegments, setClientOptions };
