import fs from 'node:fs';
import { fetchWithStream } from './http';

const downloadDash = async (manifestUrl, output) => {
  // TODO: Implement DASH support
  console.warn('Segmented download is not implemented yet');
  const createStream = ({ opaque }) => fs.createWriteStream(opaque.output);
  await fetchWithStream(manifestUrl, { opaque: { output } }, createStream);
};

export { downloadDash };
