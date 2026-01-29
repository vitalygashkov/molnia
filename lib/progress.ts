import { stdout } from 'node:process';

/**
 * Default progress state
 */
const DEFAULT_STATE = {
  total: { b: 0, mb: 0 },
  current: { b: 0, mb: 0 },
  chunkSize: 0,
  chunkSizes: [] as number[],
  averageSize: { b: 0, mb: 0 },
  averageTotal: { b: 0, mb: 0 },
  speed: { bps: 0, mbps: 0 },
};

/**
 * Format seconds into a human-readable string
 * @param seconds - Number of seconds to format
 * @returns Formatted time string (e.g., "1h 30m 15s")
 */
const formatSeconds = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  const hourString = hours > 0 ? `${hours}h` : '';
  const minuteString = minutes > 0 ? `${minutes}m` : '';
  const secondString = remainingSeconds > 0 ? `${remainingSeconds}s` : '';
  if (hours > 0) {
    return `${hourString} ${minuteString || '0m'} ${secondString && `${secondString}`}`;
  } else if (!hours && minutes > 0) {
    return `${minuteString} ${secondString && `${secondString}`}`;
  }
  return secondString;
};

/**
 * Progress state interface
 */
export interface ProgressState {
  current: { b: number; mb: number };
  total: { b: number; mb: number };
  speed: { bps: number; mbps: number };
  chunkSize: number;
  chunkSizes: number[];
  averageSize: { b: number; mb: number };
  averageTotal: { b: number; mb: number };
}

/**
 * Progress interface
 */
export interface Progress {
  state: ProgressState;
  setTotal(total: number): void;
  increase(size: number): void;
  stop(): void;
  log(): void;
  stopLog(): void;
  toString(): string;
}

/**
 * Create a progress tracker
 * @param count - The number of chunks/items being tracked
 * @returns A progress instance
 */
export const createProgress = (count: number = 0): Progress => {
  const state = structuredClone(DEFAULT_STATE);
  let secondsPassed = 0;
  const interval = setInterval(() => {
    if (secondsPassed > 1) state.speed.bps = state.current.b / secondsPassed;
    secondsPassed += 0.5;
  }, 500);

  const setTotal = (total: number): void => {
    state.total.b = total;
    state.total.mb = total / 1024 / 1024;
  };

  return {
    state,
    setTotal,
    increase(size: number): void {
      state.current.b += size;
      state.current.mb = state.current.b / 1024 / 1024;
      state.speed.mbps = state.speed.bps / 1024 / 1024;
      state.chunkSize = size;
      state.chunkSizes.push(size);
      state.averageSize.b = state.current.b / state.chunkSizes.length;
      state.averageSize.mb = state.averageSize.b / 1024 / 1024;
      state.averageTotal.b = count * state.averageSize.b;
      state.averageTotal.mb = state.averageTotal.b / 1024 / 1024;
    },
    stop(): void {
      clearInterval(interval);
      Object.assign(state, DEFAULT_STATE);
    },
    log(): void {
      const current = state.current.b;
      const total = state.total.b;
      const progressString = current + (total ? `/${total}` : '');
      stdout.write(`\rDownloading [${progressString}]`);
    },
    stopLog(): void {
      stdout.write('\n');
    },
    toString(): string {
      let message = '';
      if (state.speed.bps) message += `${state.speed.mbps.toFixed(1)} MB/s – `;

      message += `${state.current.mb.toFixed(1)}`;
      if (state.total.b) message += ` of ${state.total.mb.toFixed(1)} MB`;
      else message += ' MB';

      const total = state.total.b || state.averageTotal.b;
      if (total) {
        const bytesElapsed = state.speed.bps * secondsPassed;
        const bytesLeft = total - bytesElapsed;
        const secondsLeft = Math.round(bytesLeft / state.speed.bps);
        const secondsText = formatSeconds(secondsLeft);
        if (secondsLeft && isFinite(secondsLeft) && secondsText) message += `, ${secondsText} left`;
      }

      return message;
    },
  };
};
