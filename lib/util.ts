/**
 * Sleep for a specified number of milliseconds
 * @param ms - Number of milliseconds to sleep
 * @returns Promise that resolves after the specified time
 */
export const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Convert a camelCase string to kebab-case
 * @param value - The camelCase string to convert
 * @returns The kebab-case string
 */
export const toKebab = (value: string): string =>
  value.replace(/[A-Z]/g, '-$&').toLowerCase();

/**
 * Convert all keys in an object from camelCase to kebab-case
 * @param obj - The object with camelCase keys
 * @returns A new object with kebab-case keys
 */
export const keysFromCamelToKebab = <T extends Record<string, any>>(
  obj: T,
): Record<string, T[keyof T]> => {
  const keys = Object.keys(obj);
  const result: Record<string, T[keyof T]> = {};
  for (const key of keys) result[toKebab(key)] = obj[key];
  return result;
};
