export interface Progress {
  current: number;
  chunkSize: number;
  total: number;
  chunkSizes: number[];
  averageSize: number;
  averageTotal: number;
  increase(size: number): void;
  toString(): string;
}
