/**
 * Queue types for fastq
 */
export type QueueWorker<T> = (task: T) => Promise<void>;

export interface Queue<T> {
  push(task: T): Promise<void>;
  drained(): Promise<void>;
  killAndDrain(): Promise<void>;
}

/**
 * Create a promise-based queue using fastq
 * @param worker - The worker function to process tasks
 * @param concurrency - The number of concurrent workers
 * @returns A queue instance
 */
export const createQueue = require('fastq').promise as <T>(
  worker: QueueWorker<T>,
  concurrency: number,
) => Queue<T>;
