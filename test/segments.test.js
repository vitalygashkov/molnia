const { test } = require('node:test');
const { strictEqual } = require('node:assert');
const { stat, rm } = require('node:fs/promises');
const { downloadSegments } = require('../molnia');

const segments = [
  {
    url: 'https://offload.kion.ru/htv-rrs.mts.ru/88888888/16/20240401/268725201/video_HD_AB_4_init.m4i?hw_dash=1&amp;servicetype=0&amp;zoneoffset=0&amp;limitflux=-1&amp;limitdur=-1&amp;tenantId=703&amp;popid=5&amp;',
  },
  {
    url: 'https://offload.kion.ru/htv-rrs.mts.ru/88888888/16/20240401/268725201/video_HD_AB_4-1.m4v?hw_dash=1&amp;servicetype=0&amp;zoneoffset=0&amp;limitflux=-1&amp;limitdur=-1&amp;tenantId=703&amp;popid=5&amp;',
  },
  {
    url: 'https://offload.kion.ru/htv-rrs.mts.ru/88888888/16/20240401/268725201/video_HD_AB_4-2.m4v?hw_dash=1&amp;servicetype=0&amp;zoneoffset=0&amp;limitflux=-1&amp;limitdur=-1&amp;tenantId=703&amp;popid=5&amp;',
  },
  {
    url: 'https://offload.kion.ru/htv-rrs.mts.ru/88888888/16/20240401/268725201/video_HD_AB_4-3.m4v?hw_dash=1&amp;servicetype=0&amp;zoneoffset=0&amp;limitflux=-1&amp;limitdur=-1&amp;tenantId=703&amp;popid=5&amp;',
  },
  {
    url: 'https://offload.kion.ru/htv-rrs.mts.ru/88888888/16/20240401/268725201/video_HD_AB_4-4.m4v?hw_dash=1&amp;servicetype=0&amp;zoneoffset=0&amp;limitflux=-1&amp;limitdur=-1&amp;tenantId=703&amp;popid=5&amp;',
  },
  {
    url: 'https://offload.kion.ru/htv-rrs.mts.ru/88888888/16/20240401/268725201/video_HD_AB_4-5.m4v?hw_dash=1&amp;servicetype=0&amp;zoneoffset=0&amp;limitflux=-1&amp;limitdur=-1&amp;tenantId=703&amp;popid=5&amp;',
  },
  {
    url: 'https://offload.kion.ru/htv-rrs.mts.ru/88888888/16/20240401/268725201/video_HD_AB_4-6.m4v?hw_dash=1&amp;servicetype=0&amp;zoneoffset=0&amp;limitflux=-1&amp;limitdur=-1&amp;tenantId=703&amp;popid=5&amp;',
  },
  {
    url: 'https://offload.kion.ru/htv-rrs.mts.ru/88888888/16/20240401/268725201/video_HD_AB_4-7.m4v?hw_dash=1&amp;servicetype=0&amp;zoneoffset=0&amp;limitflux=-1&amp;limitdur=-1&amp;tenantId=703&amp;popid=5&amp;',
  },
  {
    url: 'https://offload.kion.ru/htv-rrs.mts.ru/88888888/16/20240401/268725201/video_HD_AB_4-8.m4v?hw_dash=1&amp;servicetype=0&amp;zoneoffset=0&amp;limitflux=-1&amp;limitdur=-1&amp;tenantId=703&amp;popid=5&amp;',
  },
  {
    url: 'https://offload.kion.ru/htv-rrs.mts.ru/88888888/16/20240401/268725201/video_HD_AB_4-9.m4v?hw_dash=1&amp;servicetype=0&amp;zoneoffset=0&amp;limitflux=-1&amp;limitdur=-1&amp;tenantId=703&amp;popid=5&amp;',
  },
  {
    url: 'https://offload.kion.ru/htv-rrs.mts.ru/88888888/16/20240401/268725201/video_HD_AB_4-10.m4v?hw_dash=1&amp;servicetype=0&amp;zoneoffset=0&amp;limitflux=-1&amp;limitdur=-1&amp;tenantId=703&amp;popid=5&amp;',
  },
  {
    url: 'https://offload.kion.ru/htv-rrs.mts.ru/88888888/16/20240401/268725201/video_HD_AB_4-11.m4v?hw_dash=1&amp;servicetype=0&amp;zoneoffset=0&amp;limitflux=-1&amp;limitdur=-1&amp;tenantId=703&amp;popid=5&amp;',
  },
  {
    url: 'https://offload.kion.ru/htv-rrs.mts.ru/88888888/16/20240401/268725201/video_HD_AB_4-12.m4v?hw_dash=1&amp;servicetype=0&amp;zoneoffset=0&amp;limitflux=-1&amp;limitdur=-1&amp;tenantId=703&amp;popid=5&amp;',
  },
  {
    url: 'https://offload.kion.ru/htv-rrs.mts.ru/88888888/16/20240401/268725201/video_HD_AB_4-13.m4v?hw_dash=1&amp;servicetype=0&amp;zoneoffset=0&amp;limitflux=-1&amp;limitdur=-1&amp;tenantId=703&amp;popid=5&amp;',
  },
  {
    url: 'https://offload.kion.ru/htv-rrs.mts.ru/88888888/16/20240401/268725201/video_HD_AB_4-14.m4v?hw_dash=1&amp;servicetype=0&amp;zoneoffset=0&amp;limitflux=-1&amp;limitdur=-1&amp;tenantId=703&amp;popid=5&amp;',
  },
  {
    url: 'https://offload.kion.ru/htv-rrs.mts.ru/88888888/16/20240401/268725201/video_HD_AB_4-15.m4v?hw_dash=1&amp;servicetype=0&amp;zoneoffset=0&amp;limitflux=-1&amp;limitdur=-1&amp;tenantId=703&amp;popid=5&amp;',
  },
  {
    url: 'https://offload.kion.ru/htv-rrs.mts.ru/88888888/16/20240401/268725201/video_HD_AB_4-16.m4v?hw_dash=1&amp;servicetype=0&amp;zoneoffset=0&amp;limitflux=-1&amp;limitdur=-1&amp;tenantId=703&amp;popid=5&amp;',
  },
  {
    url: 'https://offload.kion.ru/htv-rrs.mts.ru/88888888/16/20240401/268725201/video_HD_AB_4-17.m4v?hw_dash=1&amp;servicetype=0&amp;zoneoffset=0&amp;limitflux=-1&amp;limitdur=-1&amp;tenantId=703&amp;popid=5&amp;',
  },
  {
    url: 'https://offload.kion.ru/htv-rrs.mts.ru/88888888/16/20240401/268725201/video_HD_AB_4-18.m4v?hw_dash=1&amp;servicetype=0&amp;zoneoffset=0&amp;limitflux=-1&amp;limitdur=-1&amp;tenantId=703&amp;popid=5&amp;',
  },
  {
    url: 'https://offload.kion.ru/htv-rrs.mts.ru/88888888/16/20240401/268725201/video_HD_AB_4-19.m4v?hw_dash=1&amp;servicetype=0&amp;zoneoffset=0&amp;limitflux=-1&amp;limitdur=-1&amp;tenantId=703&amp;popid=5&amp;',
  },
  {
    url: 'https://offload.kion.ru/htv-rrs.mts.ru/88888888/16/20240401/268725201/video_HD_AB_4-20.m4v?hw_dash=1&amp;servicetype=0&amp;zoneoffset=0&amp;limitflux=-1&amp;limitdur=-1&amp;tenantId=703&amp;popid=5&amp;',
  },
  {
    url: 'https://offload.kion.ru/htv-rrs.mts.ru/88888888/16/20240401/268725201/video_HD_AB_4-21.m4v?hw_dash=1&amp;servicetype=0&amp;zoneoffset=0&amp;limitflux=-1&amp;limitdur=-1&amp;tenantId=703&amp;popid=5&amp;',
  },
  {
    url: 'https://offload.kion.ru/htv-rrs.mts.ru/88888888/16/20240401/268725201/video_HD_AB_4-22.m4v?hw_dash=1&amp;servicetype=0&amp;zoneoffset=0&amp;limitflux=-1&amp;limitdur=-1&amp;tenantId=703&amp;popid=5&amp;',
  },
  {
    url: 'https://offload.kion.ru/htv-rrs.mts.ru/88888888/16/20240401/268725201/video_HD_AB_4-23.m4v?hw_dash=1&amp;servicetype=0&amp;zoneoffset=0&amp;limitflux=-1&amp;limitdur=-1&amp;tenantId=703&amp;popid=5&amp;',
  },
  {
    url: 'https://offload.kion.ru/htv-rrs.mts.ru/88888888/16/20240401/268725201/video_HD_AB_4-24.m4v?hw_dash=1&amp;servicetype=0&amp;zoneoffset=0&amp;limitflux=-1&amp;limitdur=-1&amp;tenantId=703&amp;popid=5&amp;',
  },
];

test('download segments', async () => {
  const output = './test/video.mp4';
  await rm(output, { force: true }).catch(() => null);
  await rm(`${output}.molnia.segments.json`, { force: true }).catch(() => null);

  await downloadSegments(segments, { output });
  const info = await stat(output).catch(() => null);
  strictEqual(info && info.size, 34884313);
});

test('download segments resume with abort', async () => {
  const output = './test/video_resume.mp4';
  await rm(output, { force: true }).catch(() => null);
  await rm(`${output}.molnia.segments.json`, { force: true }).catch(() => null);

  const controller = new AbortController();

  const first = downloadSegments(segments, {
    output,
    signal: controller.signal,
  });

  setTimeout(() => controller.abort(), 3000);
  await first.catch(() => null);

  await downloadSegments(segments, { output });
  const info = await stat(output).catch(() => null);
  strictEqual(info && info.size, 34884313);

  const meta = await stat(`${output}.molnia.segments.json`).catch(() => null);
  strictEqual(meta, null);
});
