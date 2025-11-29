'use strict';

const fsp = require('node:fs/promises');
const path = require('node:path');

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

const handleProgress = (progress, onProgress) => {
  if (onProgress) onProgress(progress);
  else progress.log();
};

/**
 * Get progress info for a paused/interrupted download.
 * Works for both progressive and segmented downloads.
 * @param {string} output - The output file path
 * @returns {Promise<{bytesDownloaded: number, totalBytes: number | null, percentComplete: number} | null>}
 */
const getDownloadProgress = async (output) => {
  const metaPath = getMetaPath(output);
  const meta = await readMeta(metaPath);
  if (!meta) return null;

  const bytesDownloaded = meta.bytesDownloaded || 0;

  // Progressive download metadata
  if (meta.contentLength) {
    const totalBytes = meta.contentLength;
    const percentComplete =
      totalBytes > 0 ? Math.round((bytesDownloaded / totalBytes) * 100) : 0;
    return { bytesDownloaded, totalBytes, percentComplete };
  }

  // Segmented download metadata
  if (meta.segments && Array.isArray(meta.segments)) {
    const completed = meta.completed || [];
    const completedCount = completed.filter(Boolean).length;
    const totalCount = meta.segments.length;
    const percentComplete =
      totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

    return {
      bytesDownloaded,
      totalBytes: null, // Unknown for segmented downloads
      percentComplete,
      segmentsCompleted: completedCount,
      segmentsTotal: totalCount,
    };
  }

  return null;
};

/**
 * Clean up a paused/interrupted download entirely.
 * Removes output file, metadata file, and temp segment folder.
 * @param {string} output - The output file path
 * @param {string} [tempDir] - Temp directory for segmented downloads (defaults to cwd)
 */
const cleanupDownload = async (output, tempDir = process.cwd()) => {
  // Remove output file
  await fsp.rm(output, { force: true }).catch(() => null);

  // Remove metadata file
  const metaPath = getMetaPath(output);
  await removeMeta(metaPath);

  // Remove temp segment folder (for segmented downloads)
  const folder = path.parse(output).name;
  const tempPath = path.join(tempDir, folder);
  await fsp.rm(tempPath, { recursive: true, force: true }).catch(() => null);
};

/**
 * Read raw metadata for a download (internal use or advanced scenarios).
 * @param {string} output - The output file path
 * @returns {Promise<object | null>}
 */
const getDownloadMeta = async (output) => {
  const metaPath = getMetaPath(output);
  return readMeta(metaPath);
};

module.exports = {
  META_VERSION,
  getMetaPath,
  readMeta,
  writeMeta,
  removeMeta,
  handleProgress,
  getDownloadProgress,
  getDownloadMeta,
  cleanupDownload,
};
