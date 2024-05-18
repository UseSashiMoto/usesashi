'use strict';

const { merge } = require('webpack-merge');

const common = require('./webpack.common.js');
const PATHS = require('./paths.js');

// Merge webpack configuration files
const config = (env, argv) =>
  merge(common, {
    entry: {
      content: PATHS.src + '/frontend/index.tsx',
      background: PATHS.src + '/background.ts',
    },
    devtool: argv.mode === 'production' ? false : 'source-map',
  });

module.exports = config;
