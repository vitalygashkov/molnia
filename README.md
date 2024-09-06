# molnia

[![npm version](https://img.shields.io/npm/v/molnia?style=flat&color=black)](https://www.npmjs.com/package/molnia)
![GitHub Downloads (all assets, latest release)](https://img.shields.io/github/downloads/vitalygashkov/molnia/latest/total?style=flat&color=black)
[![npm downloads](https://img.shields.io/npm/dt/molnia?style=flat&color=black)](https://www.npmjs.com/package/molnia)

Utility for easy file downloading: fast, lightweight, cross-platform and flexible.

<div align="left">
  <span>English</span> •
  <a href="https://github.com/vitalygashkov/molnia/tree/main/docs/README.ru.md">Pусский</a>
</div>

## Description

A file download utility written in JavaScript with minimal dependencies. It can be used both as a command line interface and as a library for use in third-party Node.js projects.

## Quick start

### Command-line interface

Download and install [Node.js](https://nodejs.org/en/download/). Run app:

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
- **Proxy** support
- **Multiple protocols** support: HTTP, HTTPS
- **Minimal dependencies** and reduced code size
- **Command-line interface**
