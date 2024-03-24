import { basename } from 'node:path';
import { parseArgs } from 'node:util';
import { toKebab, keysFromCamelToKebab } from './util';
import packageJson from '../package.json';

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
  },
  userAgent: {
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

const getArgs = () => {
  const [_, scriptPath] = process.argv;
  const sourceScript = basename(scriptPath);
  const bin = Object.keys(packageJson.bin).at(0);
  const isCli = sourceScript === bin;
  if (isCli) {
    const { values, positionals } = parseArgs({ options: keysFromCamelToKebab(options), allowPositionals: true });
    if (values.help) return console.log(options.help.toString());
    if (values.version) return console.log(options.version.toString());
    return { values, positionals };
  }
};

export { getArgs };
