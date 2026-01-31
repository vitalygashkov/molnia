import { test, expect, describe } from 'vitest';
import { toKebab, keysFromCamelToKebab } from '../lib/util';

describe('util functions', () => {
  describe('toKebab', () => {
    test('converts camelCase to kebab-case', () => {
      expect(toKebab('camelCase')).toBe('camel-case');
      expect(toKebab('CamelCase')).toBe('-camel-case');
      expect(toKebab('myVariableName')).toBe('my-variable-name');
    });

    test('handles single word', () => {
      expect(toKebab('test')).toBe('test');
    });

    test('handles consecutive uppercase', () => {
      expect(toKebab('XMLParser')).toBe('-x-m-l-parser');
    });
  });

  describe('keysFromCamelToKebab', () => {
    test('converts object keys from camelCase to kebab-case', () => {
      const input = {
        camelCase: 1,
        anotherKey: 2,
        nestedObject: { innerValue: 3 },
      };
      const result = keysFromCamelToKebab(input);
      expect(result).toEqual({
        'camel-case': 1,
        'another-key': 2,
        'nested-object': { innerValue: 3 },
      });
    });

    test('handles empty object', () => {
      expect(keysFromCamelToKebab({})).toEqual({});
    });

    test('preserves values', () => {
      const input = { testValue: 'test', numberValue: 123, boolValue: true };
      const result = keysFromCamelToKebab(input);
      expect(result['test-value']).toBe('test');
      expect(result['number-value']).toBe(123);
      expect(result['bool-value']).toBe(true);
    });
  });
});
