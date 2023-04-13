import path from 'path';
import os from 'os';

import { app } from 'electron';

const userData = app.getPath('appData');

declare let __static: string;

export const IPROXY_HOME_PATH = path.join(userData, 'iProxy');

export const IPROXY_CERT_DIR_PATH = path.join(IPROXY_HOME_PATH, 'cert');
export const CERT_FILE_NAME = 'root.crt';
export const CERT_KEY_FILE_NAME = 'root.key';

export const IPROXY_CERT_KEY_PATH = path.join(IPROXY_CERT_DIR_PATH, CERT_KEY_FILE_NAME);

// export const PROXY_CONF_ORIGIN_HELPER_PATH = path.join(__static, './proxy_conf_helper');

export const IPROXY_ICON_TEMPLATE_PATH = path.join(__static, 'iconTemplate.png');

const systemTypemac = os.type();
const systemTypelinux = os.type();
export const SYSTEM_IS_MACOS = systemTypemac === 'Darwin';
export const SYSTEM_IS_LINUX = systemTypelinux === 'Linux';

export const IPROXY_UPDATE_DIR = path.join(IPROXY_HOME_PATH, './update');
export const IPROXY_UPDATE_CONFIG = path.join(IPROXY_UPDATE_DIR, './config.json');
export const IPROXY_FILES_DIR = path.join(IPROXY_HOME_PATH, './files');
export const PROXY_CONF_HELPER_FILE_PATH = path.join(IPROXY_FILES_DIR, './proxy_conf_helper');
export const PROXY_CONF_HELPER_PATH = path.join(IPROXY_HOME_PATH, './proxy_conf_helper');
export const PROXY_REFRESH_WINDOWS_HELPER_PATH = path.join(IPROXY_FILES_DIR, './win_proxy_helper');

let PLATFORM_IPROXY_NODE = '';

if (SYSTEM_IS_LINUX) {
    PLATFORM_IPROXY_NODE = 'iproxy-node-linux';
} else if (SYSTEM_IS_MACOS) {
    PLATFORM_IPROXY_NODE = 'iproxy-node-macos';
} else {
    PLATFORM_IPROXY_NODE = 'iproxy-node-win.exe';
}

export const IPROXY_NODEJS_PATH = path.join(IPROXY_FILES_DIR, '/node/' + PLATFORM_IPROXY_NODE);

export const GITHUB_PROJECT_PAGE = 'https://github.com/xcodebuild/iproxy';
export const NEW_ISSUE_PAGE = 'https://github.com/xcodebuild/iproxy/issues/new';

// @ts-ignore
export const APP_VERSION = __PACKAGE_INFO_VERSION__;

// @ts-ignore
export const IS_BUILD_FOR_PR = __BUILD_FOR_TRAVIS_PR__ ? true : false;

// @ts-ignore
export const BUILD_FOR_TRAVIS_COMMIT = __BUILD_FOR_TRAVIS_COMMIT__;

export const WINDOW_DEFAULT_WIDTH = 1100;
export const WINDOW_DEFAULT_HEIGHT = 700;
export const WINDOW_MIN_WIDTH = 640;
export const WINDOW_MIN_HEIGHT = 375;


export const BYPASS_DOMAINS = [
    '*.lan',
    '*.ali.com',
    '*.hz.ali.com',
    '*.symantacliveupdate.com',
    '*.symantac.com',
    'irmaagent.effirst.com:8080',
    'in.appcenter.ms',
];
