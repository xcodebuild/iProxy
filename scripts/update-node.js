const fs = require('fs');
const path = require('path');
const os = require('os');
const shell = require('shelljs');

const systemType = os.type();
const SYSTEM_IS_MACOS = systemType === 'Darwin';

const VERSION = 'v16.4.2';

const IS_ARM = process.env.IS_ARM === '1';

if (SYSTEM_IS_MACOS) {
    shell.exec(`cd vendor/files/node && curl https://cdn.npm.taobao.org/dist/node/${VERSION}/node-${VERSION}-darwin-${IS_ARM ? 'arm64': 'x64'}.tar.gz| tar -xz && mv node-*-darwin-*/bin/node node-mac && rm -rf node-*-darwin-*`);
} else {
    shell.exec(`cd vendor/files/node && curl https://cdn.npm.taobao.org/dist/node/${VERSION}/win-x86/node.exe > node-win.exe`)
}
