'use strict';

const { parseArgs } = require('node:util');
const { basename } = require('node:path');
const packageJson = require('../package.json');

const options = {
  output: {
    type: 'string',
    short: 'o',
    description: 'Specify local output file',
  },
  header: {
    type: 'string',
    short: 'H',
    multiple: true,
    description: 'Add HTTP header string',
    parse(value) {
      const headers = {};
      for (const header of value) {
        const [key, value] = header.split(':');
        headers[key.trim()] = value.trim();
      }
      return headers;
    },
  },
  'user-agent': {
    type: 'string',
    short: 'U',
    description: 'Set user agent',
  },
  help: {
    type: 'boolean',
    short: 'h',
    description: 'This information',
    toString() {
      let result = `Usage: ${packageJson.name} [options] url1 [url2] [url...]\n\n`;
      const keys = Object.keys(options);
      for (const key of keys) {
        const longKey = `--${toKebab(key)}`;
        const shortKey = `-${options[key].short}`;
        const description = options[key].description;
        result += longKey.padEnd(20) + shortKey.padEnd(5);
        if (description) result += ` ${description}`;
        result += '\n';
      }
      result += `\nVisit ${packageJson.bugs.url} to report bugs`;
      return result.trim();
    },
  },
  version: {
    type: 'boolean',
    short: 'v',
    description: 'Version information',
    toString() {
      return `${packageJson.name} ${packageJson.version} (${process.platform}-${process.arch}-${process.version})`;
    },
  },
};

const parseOptions = () => {
  const [_, scriptPath] = process.argv;
  const sourceScript = basename(scriptPath);
  const bin = Object.keys(packageJson.bin).at(0);
  const isCli = sourceScript.includes(bin);
  if (isCli) {
    const { values, positionals } = parseArgs({ options, allowPositionals: true });
    if (values.help) return console.log(options.help.toString());
    if (values.version) return console.log(options.version.toString());
    for (const arg of Object.keys(values))
      if (options[arg]) values[arg] = options[arg].parse?.(values[arg]) || values[arg];
    return { urls: positionals, output: values.output, headers: values.header, userAgent: values['user-agent'] };
  }
};

module.exports = { parseOptions };
