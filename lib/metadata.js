'use strict';

const fsp = require('node:fs/promises');

const META_VERSION = 1;

const getMetaPath = (output) => `${output}.part.json`;

const readMeta = async (metaPath) => {
  const exists = await fsp
    .stat(metaPath)
    .then(() => true)
    .catch(() => false);
  if (!exists) return null;
  try {
    const raw = await fsp.readFile(metaPath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const writeMeta = async (metaPath, meta) => {
  await fsp.writeFile(metaPath, JSON.stringify(meta));
};

const removeMeta = async (metaPath) =>
  fsp.rm(metaPath, { force: true }).catch(() => null);

const createQueueWorker = (saveFunc, meta, metaPath, signal) => {
  return async (task) => {
    if (signal?.aborted) return;
    const { saveOptions, index } = task;
    const error = await saveFunc(saveOptions);
    if (error instanceof Error) return error;
    if (typeof index === 'number') {
      meta.completed[index] = true;
      await writeMeta(metaPath, meta);
    }
    return null;
  };
};

const handleProgress = (progress, onProgress) => {
  if (onProgress) onProgress(progress);
  else progress.log();
};

module.exports = {
  META_VERSION,
  getMetaPath,
  readMeta,
  writeMeta,
  removeMeta,
  createQueueWorker,
  handleProgress,
};
