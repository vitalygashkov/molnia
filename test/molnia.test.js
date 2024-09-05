const { test } = require('node:test');
const { strictEqual } = require('node:assert');
const { existsSync } = require('node:fs');
const { downloadSegments } = require('../molnia');

test('download segments', async () => {
  const urls = [
    'https://offload.kion.ru/htv-rrs.mts.ru/88888888/16/20240401/268725201/video_HD_AB_4_init.m4i?hw_dash=1&amp;servicetype=0&amp;zoneoffset=0&amp;limitflux=-1&amp;limitdur=-1&amp;tenantId=703&amp;popid=5&amp;',
    'https://offload.kion.ru/htv-rrs.mts.ru/88888888/16/20240401/268725201/video_HD_AB_4-1.m4v?hw_dash=1&amp;servicetype=0&amp;zoneoffset=0&amp;limitflux=-1&amp;limitdur=-1&amp;tenantId=703&amp;popid=5&amp;',
    'https://offload.kion.ru/htv-rrs.mts.ru/88888888/16/20240401/268725201/video_HD_AB_4-2.m4v?hw_dash=1&amp;servicetype=0&amp;zoneoffset=0&amp;limitflux=-1&amp;limitdur=-1&amp;tenantId=703&amp;popid=5&amp;',
    'https://offload.kion.ru/htv-rrs.mts.ru/88888888/16/20240401/268725201/video_HD_AB_4-3.m4v?hw_dash=1&amp;servicetype=0&amp;zoneoffset=0&amp;limitflux=-1&amp;limitdur=-1&amp;tenantId=703&amp;popid=5&amp;',
    'https://offload.kion.ru/htv-rrs.mts.ru/88888888/16/20240401/268725201/video_HD_AB_4-4.m4v?hw_dash=1&amp;servicetype=0&amp;zoneoffset=0&amp;limitflux=-1&amp;limitdur=-1&amp;tenantId=703&amp;popid=5&amp;',
    'https://offload.kion.ru/htv-rrs.mts.ru/88888888/16/20240401/268725201/video_HD_AB_4-5.m4v?hw_dash=1&amp;servicetype=0&amp;zoneoffset=0&amp;limitflux=-1&amp;limitdur=-1&amp;tenantId=703&amp;popid=5&amp;',
    'https://offload.kion.ru/htv-rrs.mts.ru/88888888/16/20240401/268725201/video_HD_AB_4-6.m4v?hw_dash=1&amp;servicetype=0&amp;zoneoffset=0&amp;limitflux=-1&amp;limitdur=-1&amp;tenantId=703&amp;popid=5&amp;',
    'https://offload.kion.ru/htv-rrs.mts.ru/88888888/16/20240401/268725201/video_HD_AB_4-7.m4v?hw_dash=1&amp;servicetype=0&amp;zoneoffset=0&amp;limitflux=-1&amp;limitdur=-1&amp;tenantId=703&amp;popid=5&amp;',
    'https://offload.kion.ru/htv-rrs.mts.ru/88888888/16/20240401/268725201/video_HD_AB_4-8.m4v?hw_dash=1&amp;servicetype=0&amp;zoneoffset=0&amp;limitflux=-1&amp;limitdur=-1&amp;tenantId=703&amp;popid=5&amp;',
    'https://offload.kion.ru/htv-rrs.mts.ru/88888888/16/20240401/268725201/video_HD_AB_4-9.m4v?hw_dash=1&amp;servicetype=0&amp;zoneoffset=0&amp;limitflux=-1&amp;limitdur=-1&amp;tenantId=703&amp;popid=5&amp;',
    'https://offload.kion.ru/htv-rrs.mts.ru/88888888/16/20240401/268725201/video_HD_AB_4-10.m4v?hw_dash=1&amp;servicetype=0&amp;zoneoffset=0&amp;limitflux=-1&amp;limitdur=-1&amp;tenantId=703&amp;popid=5&amp;',
    'https://offload.kion.ru/htv-rrs.mts.ru/88888888/16/20240401/268725201/video_HD_AB_4-11.m4v?hw_dash=1&amp;servicetype=0&amp;zoneoffset=0&amp;limitflux=-1&amp;limitdur=-1&amp;tenantId=703&amp;popid=5&amp;',
    'https://offload.kion.ru/htv-rrs.mts.ru/88888888/16/20240401/268725201/video_HD_AB_4-12.m4v?hw_dash=1&amp;servicetype=0&amp;zoneoffset=0&amp;limitflux=-1&amp;limitdur=-1&amp;tenantId=703&amp;popid=5&amp;',
    'https://offload.kion.ru/htv-rrs.mts.ru/88888888/16/20240401/268725201/video_HD_AB_4-13.m4v?hw_dash=1&amp;servicetype=0&amp;zoneoffset=0&amp;limitflux=-1&amp;limitdur=-1&amp;tenantId=703&amp;popid=5&amp;',
    'https://offload.kion.ru/htv-rrs.mts.ru/88888888/16/20240401/268725201/video_HD_AB_4-14.m4v?hw_dash=1&amp;servicetype=0&amp;zoneoffset=0&amp;limitflux=-1&amp;limitdur=-1&amp;tenantId=703&amp;popid=5&amp;',
    'https://offload.kion.ru/htv-rrs.mts.ru/88888888/16/20240401/268725201/video_HD_AB_4-15.m4v?hw_dash=1&amp;servicetype=0&amp;zoneoffset=0&amp;limitflux=-1&amp;limitdur=-1&amp;tenantId=703&amp;popid=5&amp;',
    'https://offload.kion.ru/htv-rrs.mts.ru/88888888/16/20240401/268725201/video_HD_AB_4-16.m4v?hw_dash=1&amp;servicetype=0&amp;zoneoffset=0&amp;limitflux=-1&amp;limitdur=-1&amp;tenantId=703&amp;popid=5&amp;',
    'https://offload.kion.ru/htv-rrs.mts.ru/88888888/16/20240401/268725201/video_HD_AB_4-17.m4v?hw_dash=1&amp;servicetype=0&amp;zoneoffset=0&amp;limitflux=-1&amp;limitdur=-1&amp;tenantId=703&amp;popid=5&amp;',
    'https://offload.kion.ru/htv-rrs.mts.ru/88888888/16/20240401/268725201/video_HD_AB_4-18.m4v?hw_dash=1&amp;servicetype=0&amp;zoneoffset=0&amp;limitflux=-1&amp;limitdur=-1&amp;tenantId=703&amp;popid=5&amp;',
    'https://offload.kion.ru/htv-rrs.mts.ru/88888888/16/20240401/268725201/video_HD_AB_4-19.m4v?hw_dash=1&amp;servicetype=0&amp;zoneoffset=0&amp;limitflux=-1&amp;limitdur=-1&amp;tenantId=703&amp;popid=5&amp;',
    'https://offload.kion.ru/htv-rrs.mts.ru/88888888/16/20240401/268725201/video_HD_AB_4-20.m4v?hw_dash=1&amp;servicetype=0&amp;zoneoffset=0&amp;limitflux=-1&amp;limitdur=-1&amp;tenantId=703&amp;popid=5&amp;',
    'https://offload.kion.ru/htv-rrs.mts.ru/88888888/16/20240401/268725201/video_HD_AB_4-21.m4v?hw_dash=1&amp;servicetype=0&amp;zoneoffset=0&amp;limitflux=-1&amp;limitdur=-1&amp;tenantId=703&amp;popid=5&amp;',
    'https://offload.kion.ru/htv-rrs.mts.ru/88888888/16/20240401/268725201/video_HD_AB_4-22.m4v?hw_dash=1&amp;servicetype=0&amp;zoneoffset=0&amp;limitflux=-1&amp;limitdur=-1&amp;tenantId=703&amp;popid=5&amp;',
    'https://offload.kion.ru/htv-rrs.mts.ru/88888888/16/20240401/268725201/video_HD_AB_4-23.m4v?hw_dash=1&amp;servicetype=0&amp;zoneoffset=0&amp;limitflux=-1&amp;limitdur=-1&amp;tenantId=703&amp;popid=5&amp;',
    'https://offload.kion.ru/htv-rrs.mts.ru/88888888/16/20240401/268725201/video_HD_AB_4-24.m4v?hw_dash=1&amp;servicetype=0&amp;zoneoffset=0&amp;limitflux=-1&amp;limitdur=-1&amp;tenantId=703&amp;popid=5&amp;',
  ];
  await downloadSegments(urls, { output: './test/video.mp4' });
  strictEqual(existsSync('./test/video.mp4'), true);
});
