# esor

[![npm version](https://img.shields.io/npm/v/esor?style=flat&color=black)](https://www.npmjs.com/package/esor)
![GitHub Downloads (all assets, latest release)](https://img.shields.io/github/downloads/vitalygashkov/esor/latest/total?style=flat&color=black)
[![npm downloads](https://img.shields.io/npm/dt/esor?style=flat&color=black)](https://www.npmjs.com/package/esor)

<p align="right">
  <a href="https://github.com/vitalygashkov/esor/tree/main/README.md">English</a> •
  <span>Русский</span>
</p>

Быстрая, легковесная и кроссплатформенная утилита для скачивания файлов.

> В переводе с латинского esor - "пожиратель".

## Описание

Утилита для скачивания файлов, написанная на JavaScript с минимумом зависимостей. Может использоваться как отдельная программа с интерфейсом командной строки, а также в качестве библиотеки для использования в сторонних Node.js-проектах.

## Быстрый старт

### Интерфейс командной строки (CLI)

Скачайте исполняемый файл для вашей ОС из [последнего релиза](https://github.com/vitalygashkov/esor/releases/latest) и вызовите его из командной строки:

```
esor [options] url1 [url2] [url...]
```

Пример:

```
esor --output C:\Users\Ivan\Downloads\10Mb.dat https://proof.ovh.net/files/10Mb.dat
```

### Библиотека

Установите пакет, используя NPM:

```
npm i esor
```

Импортируйте необходимые функции в ваш проект:

```js
import { download } from 'esor';

const options = { output: `C:\Users\Ivan\Downloads\10Mb.dat` };
await download('https://proof.ovh.net/files/10Mb.dat', options);
```

## Особенности

- Интерфейс командной строки
- Поддержка HTTP и HTTPS (в планах поддержка HTTP2)
- Параллелизм
