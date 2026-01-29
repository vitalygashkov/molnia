import { parseArgs } from 'node:util';
import { basename } from 'node:path';
import { createRequire } from 'node:module';
import {
  DEFAULT_MAX_REDIRECTIONS,
  DEFAULT_POOL_CONNECTIONS,
  DEFAULT_MAX_RETRIES,
} from './client.js';

const _require = createRequire(import.meta.url);
const packageJson = _require('../package.json');

/**
 * Parsed CLI options interface
 */
export interface ParsedOptions {
  urls: string[];
  output?: string;
  maxRetries: number;
  maxRedirections: number;
  connections: number;
  proxy?: string;
  headers?: Record<string, string>;
  userAgent?: string;
}

/**
 * CLI option definitions
 */
const options = {
  output: {
    type: 'string' as const,
    short: 'o' as const,
    description: 'Specify local output file',
  },
  connections: {
    type: 'string' as const,
    short: 'c' as const,
    description: 'Maximum number of concurrent connections per download',
    default: String(DEFAULT_POOL_CONNECTIONS),
  },
  retry: {
    type: 'string' as const,
    short: 'r' as const,
    description: 'Maximum request retry count',
    default: String(DEFAULT_MAX_RETRIES),
  },
  redirect: {
    type: 'string' as const,
    description: 'Maximum redirections per request',
    default: String(DEFAULT_MAX_REDIRECTIONS),
  },
  proxy: {
    type: 'string' as const,
    short: 'p' as const,
    description: 'HTTP(S) proxy in WHATWG URL syntax, example: http://127.0.0.1:8888',
  },
  header: {
    type: 'string' as const,
    short: 'H' as const,
    multiple: true,
    description: 'Add HTTP header string',
    parse(value: string) {
      const headers: Record<string, string> = {};
      for (const header of value) {
        const parts = header.split(':');
        if (parts.length >= 2) {
          const key = parts[0];
          const val = parts.slice(1).join(':');
          if (key && val) {
            headers[key.trim()] = val.trim();
          }
        }
      }
      return headers;
    },
  },
  help: {
    type: 'boolean' as const,
    short: 'h' as const,
    description: 'This information',
    toString() {
      let result = `Usage: ${packageJson.name} [options] url1 [url2] [url...]\n\n`;
      const keys = Object.keys(options);
      for (const key of keys) {
        const longKey = `--${key}`;
        const opt = options[key as keyof typeof options] as any;
        const shortKey = opt.short ? `-${opt.short}` : '';
        const description = opt.description;
        result += longKey.padEnd(20) + shortKey.padEnd(5);
        if (description) result += ` ${description}`;
        result += '\n';
      }
      result += `\nVisit ${packageJson.bugs.url} to report bugs`;
      return result.trim();
    },
  },
  version: {
    type: 'boolean' as const,
    short: 'v' as const,
    description: 'Version information',
    toString() {
      return `${packageJson.name} ${packageJson.version} (${process.platform}-${process.arch}-${process.version})`;
    },
  },
};

/**
 * Parse CLI options from process.argv
 * @returns Parsed options or undefined if not running as CLI
 */
export const parseOptions = (): ParsedOptions | undefined => {
  const [, scriptPath] = process.argv;
  if (!scriptPath) return undefined;

  const sourceScript = basename(scriptPath);
  const bin = Object.keys(packageJson.bin).at(0);
  const isCli = sourceScript.includes(bin || '');

  if (isCli) {
    const { values, positionals } = parseArgs({
      options,
      allowPositionals: true,
    });

    if (values.help) {
      console.log(options.help.toString());
      return undefined;
    }

    if (values.version) {
      console.log(options.version.toString());
      return undefined;
    }

    const parsedValues: any = { ...values };

    for (const arg of Object.keys(values)) {
      if (options[arg as keyof typeof options]) {
        const option = options[arg as keyof typeof options] as any;
        parsedValues[arg] =
          option.parse?.(values[arg as keyof typeof values]) || values[arg as keyof typeof values];
      }
    }

    return {
      urls: positionals as string[],
      output: parsedValues.output as string | undefined,
      maxRetries: parseInt(parsedValues.retry as string),
      maxRedirections: parseInt(parsedValues.redirect as string),
      connections: parseInt(parsedValues.connections as string),
      proxy: parsedValues.proxy as string | undefined,
      headers: parsedValues.header as Record<string, string> | undefined,
      userAgent: parsedValues['user-agent'] as string | undefined,
    };
  }

  return undefined;
};
