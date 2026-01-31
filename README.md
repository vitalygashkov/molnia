# molnia

[![npm version](https://img.shields.io/npm/v/molnia?style=flat&color=black)](https://www.npmjs.com/package/molnia)
![GitHub Downloads (all assets, latest release)](https://img.shields.io/github/downloads/vitalygashkov/molnia/latest/total?style=flat&color=black)
[![npm downloads](https://img.shields.io/npm/dt/molnia?style=flat&color=black)](https://www.npmjs.com/package/molnia)

Library for easy file downloading: fast, lightweight, cross-platform and flexible.

## Description

A file download library written in TypeScript with minimal dependencies.

## Installation

Install package using NPM:

```
npm i molnia
```

## Usage

Use in your project:

```js
import { download } from 'molnia';

const options = { output: `C:\Users\John\Downloads\10Mb.dat` };
await download('https://proof.ovh.net/files/10Mb.dat', options);
```

## Features

- **Concurrency**: chunk download queue with size limitations
- **Retry** in case of request failure
- **Proxy** support (HTTP/HTTPS) across Node.js, Bun and Deno
- **Multiple protocols** support: HTTP, HTTPS
- **Cross-runtime**: works with Node.js, Bun and Deno
- **Minimal dependencies** and reduced code size
