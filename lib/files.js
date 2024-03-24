import fs from 'node:fs';

const getChunkPath = (output, i) => `${output}.part${i}`;
const getChunkTempPath = (output, i) => `${output}.part${i}.temp`;

const buildFile = async (output, chunksCount) => {
  const stream = fs.createWriteStream(output);
  for (let i = 0; i < chunksCount; i += 1) {
    const fileName = getChunkPath(output, i);
    const source = fs.createReadStream(fileName);
    await new Promise((res, rej) => {
      source.pipe(stream, { end: false });
      source.on('error', rej);
      stream.on('error', rej);
      source.on('end', () => {
        stream.removeListener('error', rej);
        res();
      });
    });
    source.destroy();
  }
  for (let i = 0; i < chunksCount; i += 1) {
    const fileName = getChunkPath(output, i);
    new Promise((res) => fs.unlink(fileName, res));
  }
  stream.destroy();
};

export { buildFile, getChunkPath, getChunkTempPath };
