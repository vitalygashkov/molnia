#!/usr/bin/env node

'use strict';

const { parseOptions } = require('./lib/args');
const { fetchHead, createClient } = require('./lib/client');
const { downloadProgressive } = require('./lib/progressive');
const { save } = require('./lib/save');
const { downloadSegments } = require('./lib/segments');

const parseOutput = (url, output) => output || url?.split('/').at(-1);

const download = async (url, options = {}) => {
  options.dispatcher = createClient(options);
  const head = await fetchHead(url, options);
  options.output = parseOutput(head.url, options.output);
  if (head.isProgressive && !head.isCompressed) {
    await downloadProgressive(
      head.url,
      options,
      head.contentLength,
      head.contentType,
    );
  } else {
    await save({
      url: head.url,
      headers: options.headers,
      output: options.output,
      dispatcher: options.dispatcher,
      signal: options.signal,
    });
  }
};

const options = parseOptions();

const start = async () => {
  for (const url of options.urls) await download(url, options);
};

if (options) start();

module.exports = { download, downloadSegments };
