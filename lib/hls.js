'use strict';

const fs = require('node:fs');
const { fetchWithStream } = require('./http');

const downloadHls = async (playlistUrl, output) => {
  // TODO: Implement
  console.warn('Segmented download is not implemented yet');
  const createStream = ({ opaque }) => fs.createWriteStream(opaque.output);
  await fetchWithStream(playlistUrl, { opaque: { output } }, createStream);
};

module.exports = { downloadHls };
