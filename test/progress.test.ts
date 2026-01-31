import { test, expect, describe } from 'vitest';
import { createProgress } from '../lib/progress';

describe('progress', () => {
  describe('createProgress', () => {
    test('initial state is zero', () => {
      const progress = createProgress(5);
      expect(progress.state.current.b).toBe(0);
      expect(progress.state.total.b).toBe(0);
    });

    test('setTotal sets the total size', () => {
      const progress = createProgress(5);
      progress.setTotal(1000);
      expect(progress.state.total.b).toBe(1000);
      expect(progress.state.total.mb).toBeCloseTo(0.00095367431640625);
    });

    test('increase updates current size', () => {
      const progress = createProgress(5);
      progress.setTotal(1000);
      progress.increase(100);
      expect(progress.state.current.b).toBe(100);
      expect(progress.state.chunkSize).toBe(100);
    });

    test('increase tracks chunk sizes', () => {
      const progress = createProgress(3);
      progress.setTotal(100);
      progress.increase(25);
      progress.increase(25);
      progress.increase(50);
      expect(progress.state.chunkSizes).toEqual([25, 25, 50]);
      expect(progress.state.averageSize.b).toBeCloseTo(33.333, 0);
    });

    test('stop clears interval and resets state', () => {
      const progress = createProgress(5);
      progress.setTotal(100);
      progress.increase(50);
      progress.stop();
      expect(progress.state.current.b).toBe(0);
    });

    test('toString returns formatted progress', () => {
      const progress = createProgress(5);
      progress.setTotal(1024 * 1024); // 1MB
      progress.increase(512 * 1024); // 0.5MB
      const str = progress.toString();
      expect(str).toContain('0.5');
      expect(str).toContain('1.0');
    });
  });
});
