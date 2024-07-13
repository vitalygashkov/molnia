export interface ProgressState {
  current: { b: number; mb: number };
  total: { b: number; mb: number };
  speed: { bps: number; mbps: number };
  chunkSize: number;
  chunkSizes: number[];
  averageSize: { b: number; mb: number };
  averageTotal: { b: number; mb: number };
}

export interface Progress {
  state: ProgressState;
  increase(size: number): void;
  stop(): void;
  toString(): string;
}
