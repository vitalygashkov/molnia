import fsp from 'node:fs/promises';
import path from 'node:path';

/**
 * Metadata version for format compatibility
 */
export const META_VERSION = 1;

/**
 * Get metadata file path for a download
 * @param output - The output file path
 * @returns The metadata file path
 */
export const getMetaPath = (output: string): string => `${output}.part.json`;

/**
 * Read metadata from file
 * @param metaPath - Path to metadata file
 * @returns Parsed metadata or null if not found/invalid
 */
export const readMeta = async (metaPath: string): Promise<Record<string, unknown> | null> => {
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

/**
 * Write metadata to file
 * @param metaPath - Path to metadata file
 * @param meta - Metadata object to write
 */
export const writeMeta = async (metaPath: string, meta: object): Promise<void> => {
  await fsp.writeFile(metaPath, JSON.stringify(meta));
};

/**
 * Remove metadata file
 * @param metaPath - Path to metadata file
 */
export const removeMeta = async (metaPath: string): Promise<void> =>
  fsp.rm(metaPath, { force: true }).catch(() => undefined);

/**
 * Handle progress callback
 * @param progress - Progress object
 * @param onProgress - Optional progress callback
 */
export const handleProgress = (
  progress: unknown,
  onProgress?: (progress: unknown) => void,
): void => {
  if (onProgress) onProgress(progress);
};

/**
 * Download progress info interface
 */
export interface DownloadProgress {
  bytesDownloaded: number;
  totalBytes: number | null;
  percentComplete: number;
  segmentsCompleted?: number;
  segmentsTotal?: number;
}

/**
 * Get progress info for a paused/interrupted download
 * Works for both progressive and segmented downloads
 * @param output - The output file path
 * @returns Progress info or null if no metadata found
 */
export const getDownloadProgress = async (output: string): Promise<DownloadProgress | null> => {
  const metaPath = getMetaPath(output);
  const meta = await readMeta(metaPath);
  if (!meta) return null;

  const bytesDownloaded = (meta.bytesDownloaded as number) || 0;

  // Progressive download metadata
  if (meta.contentLength) {
    const totalBytes = meta.contentLength as number;
    const percentComplete = totalBytes > 0 ? Math.round((bytesDownloaded / totalBytes) * 100) : 0;
    return { bytesDownloaded, totalBytes, percentComplete };
  }

  // Segmented download metadata
  if (meta.segments && Array.isArray(meta.segments)) {
    const completed = (meta.completed as boolean[]) || [];
    const completedCount = completed.filter(Boolean).length;
    const totalCount = meta.segments.length;
    const percentComplete = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

    return {
      bytesDownloaded,
      totalBytes: null,
      percentComplete,
      segmentsCompleted: completedCount,
      segmentsTotal: totalCount,
    };
  }

  return null;
};

/**
 * Get raw metadata for a download
 * @param output - The output file path
 * @returns Raw metadata object or null if not found
 */
export const getDownloadMeta = async (output: string): Promise<Record<string, unknown> | null> => {
  const metaPath = getMetaPath(output);
  return readMeta(metaPath);
};

/**
 * Clean up a paused/interrupted download entirely
 * Removes output file, metadata file, and temp segment folder
 * @param output - The output file path
 * @param tempDir - Temp directory for segmented downloads (defaults to cwd)
 */
export const cleanupDownload = async (
  output: string,
  tempDir: string = process.cwd(),
): Promise<void> => {
  // Remove output file
  await fsp.rm(output, { force: true }).catch(() => undefined);

  // Remove metadata file
  const metaPath = getMetaPath(output);
  await removeMeta(metaPath);

  // Remove temp segment folder (for segmented downloads)
  const folder = path.parse(output).name;
  const tempPath = path.join(tempDir, folder);
  await fsp.rm(tempPath, { recursive: true, force: true }).catch(() => undefined);
};
