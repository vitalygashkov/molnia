const { test } = require('node:test');
const { strictEqual } = require('node:assert');
const { stat, rm } = require('node:fs/promises');
const { download } = require('../molnia');
const { fetchHead } = require('../lib/client');

test('progressive download resume with abort', async () => {
  const url = 'https://proof.ovh.net/files/100Mb.dat';
  const output = './test/progressive.dat';

  await rm(output, { force: true }).catch(() => null);
  await rm(`${output}.molnia.json`, { force: true }).catch(() => null);

  const controller = new AbortController();

  const first = download(url, {
    output,
    connections: 4,
    signal: controller.signal,
  });

  setTimeout(() => controller.abort(), 5000);
  await first.catch((e) => {
    console.log(e);
  });

  const head = await fetchHead(url);
  await download(url, { output, connections: 4 });
  const info = await stat(output).catch(() => null);
  strictEqual(info && info.size, head.contentLength);
  console.log(head.contentLength);

  const meta = await stat(`${output}.molnia.json`).catch(() => null);
  strictEqual(meta, null);
});
