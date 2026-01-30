# molnia

[![npm version](https://img.shields.io/npm/v/molnia?style=flat&color=black)](https://www.npmjs.com/package/molnia)
![GitHub Downloads (all assets, latest release)](https://img.shields.io/github/downloads/vitalygashkov/molnia/latest/total?style=flat&color=black)
[![npm downloads](https://img.shields.io/npm/dt/molnia?style=flat&color=black)](https://www.npmjs.com/package/molnia)

Utility for easy file downloading: fast, lightweight, cross-platform and flexible.

## Description

A file download utility written in TypeScript with minimal dependencies. It can be used both as a command line interface and as a library.

## Quick start

### Command-line interface

Download and install [Node.js](https://nodejs.org/en/download/) (or [Bun](https://bun.sh/), [Deno](https://deno.land/)). Run app:

```
npx molnia [options] url1 [url2] [url...]
```

Example:

```
npx molnia --output C:\Users\John\Downloads\10Mb.dat https://proof.ovh.net/files/10Mb.dat
```

### Library

Install package using NPM:

```
npm i molnia
```

Use in your project:

```js
import { download } from 'molnia';

const options = { output: `C:\Users\John\Downloads\10Mb.dat` };
await download('https://proof.ovh.net/files/10Mb.dat', options);
```

## Features

- **Concurrency**: chunk download queue with size limitations
- **Retry** in case of request failure
- **Proxy** support (HTTP/HTTPS) across Node.js, Bun, and Deno
- **Multiple protocols** support: HTTP, HTTPS
- **Cross-runtime**: Works with Node.js, Bun, and Deno
- **Minimal dependencies** and reduced code size
- **Command-line interface**
