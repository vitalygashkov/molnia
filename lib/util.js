'use strict';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const toKebab = (value) => value.replace(/[A-Z]/g, '-$&').toLowerCase();

const keysFromCamelToKebab = (obj) => {
  const keys = Object.keys(obj);
  const result = {};
  for (const key of keys) result[toKebab(key)] = obj[key];
  return result;
};

export { sleep, toKebab, keysFromCamelToKebab };
