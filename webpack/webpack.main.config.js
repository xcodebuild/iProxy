const path = require('path');
const webpack = require('webpack');
const merge = require('webpack-merge');
const { version } = require('../package.json');

const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');

const baseConfig = require('./webpack.base.config');

module.exports = merge.merge(baseConfig, {
    target: 'electron-main',
    entry: {
        main: './src/main/index.ts',
    },
    module: {
        rules: [
            {
                test: /\.(png|jpg|gif)$/i,
                use: [
                  {
                    loader: 'url-loader',
                    options: {
                      limit: 8192,
                    },
                  },
                ],
            }
        ],
    },
    plugins: [
        new ForkTsCheckerWebpackPlugin({
            reportFiles: ['src/main/**/*'],
        }),
        new webpack.DefinePlugin({
            'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
            __static: `"${path.join(__dirname, '../static').replace(/\\/g, '\\\\')}"`,
            '__PACKAGE_INFO_VERSION__': JSON.stringify(version),
            // 给 travis pr 构建的版本跳过更新等逻辑
            '__BUILD_FOR_TRAVIS_PR__': JSON.stringify(process.env.TRAVIS_PULL_REQUEST || ''),
            '__BUILD_FOR_TRAVIS_COMMIT__': JSON.stringify(process.env.TRAVIS_COMMIT || ''),
        }),
    ],
});
