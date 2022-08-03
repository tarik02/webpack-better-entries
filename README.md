# webpack-better-entries

![Check](https://github.com/Tarik02/webpack-better-entries/actions/workflows/check.yml/badge.svg)
![Publish to NPM](https://github.com/Tarik02/webpack-better-entries/actions/workflows/publish-to-npm.yml/badge.svg)
[![npm version](https://badge.fury.io/js/webpack-better-entries.svg)](https://badge.fury.io/js/webpack-better-entries)

## Installation

```bash
yarn add --dev webpack-better-entries
# or
npm install --save-dev webpack-better-entries
```

## Usage

Add this to your webpack config:
```js
import WebpackBetterEntries from 'webpack-better-entries';

  // ...

  plugins: [
    // context is the webpack context option
    // you can pass an array of patterns to glob function
    // also glob function receives second argument options which currently supports only { cwd: string } option

    // using async function
    new WebpackBetterEntries(async ({ context, glob }) => {
      const entries = {};

      entries['app'] = './src/index.ts';

      for (const entry of await glob('./src/modules/*/index.+(js|ts)')) {
        const [ name ] = entry.split(/[\\\/]/).slice(-2);
        entries[name] = {
          dependOn: 'app',
          import: entry
        };
      }

      return entries;
    }),

    // using async generator
    new WebpackBetterEntries(async function *({ context, glob }) {
      yield {
        name: 'app',
        import: './src/index.ts'
      };

      for await (const entry of glob('./src/modules/*/index.+(js|ts)')) {
        const [ name ] = entry.split(/[\\\/]/).slice(-2);
        yield {
          name,
          dependOn: 'app',
          import: entry
        };
      }
    }),
  ],

  // ...
```
