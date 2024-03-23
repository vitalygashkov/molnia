const { basename } = require('node:path');
const { parseArgs } = require('node:util');
const packageJson = require('../package.json');

const options = {
  help: {
    type: 'boolean',
    short: 'h',
  },
};

const getArgs = () => {
  const [_, scriptPath] = process.argv;
  const sourceScript = basename(scriptPath);
  const bin = Object.keys(packageJson.bin).at(0);
  const isCli = sourceScript === bin;
  if (isCli) {
    const { values, positionals } = parseArgs({ options });
    if (values.help) {
      console.log(`Usage: ${bin} [OPTIONS] [URI]...`);
    }
    return { values, positionals };
  } else {
    return {};
  }
};

module.exports = { getArgs };
