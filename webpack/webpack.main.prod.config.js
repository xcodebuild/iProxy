const merge = require('webpack-merge');

const baseConfig = require('./webpack.main.config');

module.exports = merge.merge(baseConfig, {
    mode: 'production',
});
