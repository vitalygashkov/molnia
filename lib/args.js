const { basename } = require('node:path');
const { parseArgs } = require('node:util');
const packageJson = require('../package.json');

const options = {
  help: {
    type: 'boolean',
    short: 'h',
    description: 'This information',
    toString() {
      let result = `Usage: ${packageJson.name} [options] url1 [url2] [url...]\n\n`;
      const keys = Object.keys(options);
      for (const key of keys) {
        const longKey = `--${key}`;
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
    const { values, positionals } = parseArgs({ options, allowPositionals: true });
    if (values.help) console.log(options.help.toString());
    if (values.version) console.log(options.version.toString());
    return { values, positionals };
  } else {
    return null;
  }
};

module.exports = { getArgs };
