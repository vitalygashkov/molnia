#!/usr/bin/env node

import { getArgs } from './lib/args';
import { fetchHeaders } from './lib/http';
import { downloadProgressive } from './lib/progressive';
import { downloadDash } from './lib/dash';
import { downloadHls } from './lib/hls';

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

export default { download };
