import fs from 'node:fs';
import { fetchWithStream } from './http';

const downloadHls = async (playlistUrl, output) => {
  // TODO: Implement
  console.warn('Segmented download is not implemented yet');
  const createStream = ({ opaque }) => fs.createWriteStream(opaque.output);
  await fetchWithStream(playlistUrl, { opaque: { output } }, createStream);
};

export { downloadHls };
