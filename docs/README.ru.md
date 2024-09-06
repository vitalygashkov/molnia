# molnia

[![npm version](https://img.shields.io/npm/v/molnia?style=flat&color=black)](https://www.npmjs.com/package/molnia)
![GitHub Downloads (all assets, latest release)](https://img.shields.io/github/downloads/vitalygashkov/molnia/latest/total?style=flat&color=black)
[![npm downloads](https://img.shields.io/npm/dt/molnia?style=flat&color=black)](https://www.npmjs.com/package/molnia)

Быстрая, легковесная и кроссплатформенная утилита для скачивания файлов.

<div align="left">
  <a href="https://github.com/vitalygashkov/molnia/tree/main/README.md">English</a> •
  <span>Русский</span>
</div>

## Описание

Утилита для скачивания файлов, написанная на JavaScript с минимумом зависимостей. Может использоваться с интерфейсом командной строки, а также в качестве библиотеки для использования в сторонних Node.js-проектах.

## Быстрый старт

### Интерфейс командной строки (CLI)

Скачайте и установите [Node.js](https://nodejs.org/en/download/). Запустите программу из командной строки:

```
npx molnia [options] url1 [url2] [url...]
```

Пример:

```
npx molnia --output C:\Users\Ivan\Downloads\10Mb.dat https://proof.ovh.net/files/10Mb.dat
```

### Библиотека

Установите пакет, используя NPM:

```
npm i molnia
```

Импортируйте необходимые функции в ваш проект:

```js
import { download } from 'molnia';

const options = { output: `C:\Users\Ivan\Downloads\10Mb.dat` };
await download('https://proof.ovh.net/files/10Mb.dat', options);
```

## Особенности

- **Параллелизм**: использование очереди с ограничением по размеру для загрузки сегментов
- **Повторное выполнение** запросов в случае неудачи
- Поддержка **прокси**
- Поддержка **нескольких протоколов**: HTTP, HTTPS
- **Минимум зависимостей** и сокращенный размер кода
- **Интерфейс командной строки**
