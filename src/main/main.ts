/* eslint-disable @typescript-eslint/no-var-requires */
'use strict';

import {
    app,
    BrowserWindow,
    Menu,
    MenuItem,
    MenuItemConstructorOptions,
    shell,
    dialog,
    globalShortcut,
} from 'electron';
import * as path from 'path';
import { splash } from './splash';
import electronIsDev from 'electron-is-dev';

import { format as formatUrl } from 'url';
import { initIPC } from './api';
import { hideOrQuit } from './platform';
import { installCertAndHelper } from './install';

// @ts-ignore
import extract from 'extract-zip';

import {
    WINDOW_DEFAULT_WIDTH,
    WINDOW_DEFAULT_HEIGHT,
    WINDOW_MIN_WIDTH,
    WINDOW_MIN_HEIGHT,
    SYSTEM_IS_MACOS,
    NEW_ISSUE_PAGE,
    GITHUB_PROJECT_PAGE,
    IPROXY_HOME_PATH,
    IPROXY_FILES_DIR,
    APP_VERSION,
    IS_BUILD_FOR_PR,
} from './const';
import ua from 'universal-analytics';
import { CoreAPI } from '../renderer/core-api';
import { uuidv4 } from '../renderer/utils';
import windowStateKeeper from 'electron-window-state';
import os from 'os';
import fs from 'fs-extra';
// @ts-ignore
import logoIcon from '../../vendor/files/iconTemplate@2x.png';
import { nanoid } from 'nanoid';

require('@electron/remote/main').initialize();
require('electron-store').initRenderer();

const isDevelopment = process.env.NODE_ENV !== 'production';

// disable GPU for #219
app.disableHardwareAcceleration();

// global reference to mainWindow (necessary to prevent window from being garbage collected)
let mainWindow: BrowserWindow | null;

const version = APP_VERSION;

let appReady = false;

app.commandLine.appendSwitch('--no-proxy-server');
app.commandLine.appendSwitch('disable-site-isolation-trials');

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
    app.quit();
} else {
    app.on('second-instance', () => {
        // 当运行第二个实例时,将会聚焦到myWindow这个窗口
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
        }
    });
}

function copyFileSync(source: string, target: string) {
    let targetFile = target;

    //if target is a directory a new file with the same name will be created
    if (fs.existsSync(target)) {
        if (fs.lstatSync(target).isDirectory()) {
            targetFile = path.join(target, path.basename(source));
        }
    }

    fs.writeFileSync(targetFile, fs.readFileSync(source));
}

function copyFolderRecursiveSync(source: string, target: string) {
    let files = [];

    //check if folder needs to be created or integrated
    const targetFolder = path.join(target, path.basename(source));
    if (!fs.existsSync(targetFolder)) {
        fs.mkdirSync(targetFolder);
    }

    //copy
    if (fs.lstatSync(source).isDirectory()) {
        files = fs.readdirSync(source);
        files.forEach(function (file) {
            const curSource = path.join(source, file);
            if (fs.lstatSync(curSource).isDirectory()) {
                copyFolderRecursiveSync(curSource, targetFolder);
            } else {
                copyFileSync(curSource, targetFolder);
            }
        });
    }
}

// @ts-ignore
// will be used in renderer
global.__static = __static;

// @ts-ignore
global.__filesDir = IPROXY_FILES_DIR;

const IPROXY_FILES_IN_ASAR_PATH = electronIsDev
    ? path.join(__dirname, '../../vendor/files/')
    : path.join(__dirname, './files/');

const IPROXY_FILES_ZIP_IN_ASAR_PATH = electronIsDev
    ? path.join(__dirname, '../../vendor/files.zip')
    : path.join(__dirname, './files.zip');

let splashWindow: BrowserWindow | null;

async function initSplashScreen() {
    // start a splash window
    return new Promise((resolve) => {
        const splashContent =
            'data:text/html;charset=UTF-8,' +
            encodeURIComponent(
                splash({
                    brand: 'Build with ♥',
                    productName: `iProxy`,
                    text: `Loading - ${version} ...`,
                    website: 'https://github.com/xcodebuild/iproxy',
                    logo: logoIcon,
                    color: '#1890ff',
                }),
            );

        splashWindow = new BrowserWindow({
            width: 600,
            height: 400,
            frame: false,
            backgroundColor: '#1890ff',
            // modal: true,
            // transparent: true,
            autoHideMenuBar: true,
            resizable: false,
            movable: true,
        });

        splashWindow.loadURL(splashContent);

        splashWindow.webContents.on('did-finish-load', () => {
            // @ts-ignore
            resolve();
        });
        splashWindow.show();
    });
}

async function initCopyFiles() {
    try {
        if (!fs.existsSync(IPROXY_FILES_DIR)) {
            fs.mkdirpSync(IPROXY_FILES_DIR);
        }

        const versionFile = path.join(IPROXY_FILES_DIR, 'version');
        if (fs.existsSync(versionFile) && fs.readFileSync(versionFile, 'utf-8') === version && !electronIsDev) {
            // pass
        } else {
            console.log('copy files');
            fs.removeSync(IPROXY_FILES_DIR);

            await extract(IPROXY_FILES_ZIP_IN_ASAR_PATH, {
                dir: IPROXY_HOME_PATH,
            });

            // copyFolderRecursiveSync(IPROXY_FILES_IN_ASAR_PATH, IPROXY_HOME_PATH);
            // fs.chmodSync(IPROXY_NODEJS_PATH, '775');
            fs.moveSync(
                path.join(IPROXY_FILES_DIR, '/node/modules'),
                path.join(IPROXY_FILES_DIR, '/node/node_modules'),
            );
            fs.writeFileSync(versionFile, version, 'utf-8');
        }
    } catch (e) {
        console.error(e);
    }
}

let forceQuit = false;

function createMainWindow() {
    const mainWindowState = windowStateKeeper({
        defaultWidth: WINDOW_DEFAULT_WIDTH,
        defaultHeight: WINDOW_DEFAULT_HEIGHT,
    });
    const window = new BrowserWindow({
        height: mainWindowState.height,
        width: mainWindowState.width,
        minWidth: WINDOW_MIN_WIDTH,
        minHeight: WINDOW_MIN_HEIGHT,
        webPreferences: {
            nodeIntegration: true,
            webSecurity: false,
            // electron >= 10
            contextIsolation: false,
        },
        // disable frameless in Windows
        frame: SYSTEM_IS_MACOS ? false : true,
        x: mainWindowState.x,
        y: mainWindowState.y,
        show: false,
    });
    window.hide();

    mainWindowState.manage(window);
    require('@electron/remote/main').enable(window.webContents);

    if (isDevelopment) {
        window.webContents.openDevTools();
    }

    const filter = {
        urls: ['*://127.0.0.1:*/*'],
    };

    if (isDevelopment) {
        window.loadURL(`http://localhost:2333`);
    } else {
        window.loadURL(
            formatUrl({
                pathname: path.join(__dirname, './index.html'),
                protocol: 'file',
                slashes: true,
            }),
        );
    }

    // @ts-ignore
    global.WHISTLE_USERNAME = nanoid(8);
    // @ts-ignore
    global.WHISTLE_PASSWORD = nanoid(8);

    window.webContents.session.webRequest.onBeforeSendHeaders(filter, (details, callback) => {
        // @ts-ignore
        const base64encodedData = new Buffer(global.WHISTLE_USERNAME + ':' + global.WHISTLE_PASSWORD).toString(
            'base64',
        );
        callback({
            requestHeaders: {
                ...details.requestHeaders,
                Authorization: 'Basic ' + base64encodedData,
            },
            cancel: false,
        });
    });

    window.on('close', (event) => {
        if (!forceQuit) {
            if (SYSTEM_IS_MACOS) {
                app.hide();
            } else {
                window.hide();
            }
            event?.preventDefault();
        }
    });

    // @ts-ignore
    window.webContents.on('new-window', function (event, url) {
        event.preventDefault();
        new BrowserWindow({
            width: 1300,
            height: 800,
        }).loadURL(url);
    });

    window.webContents.on('did-finish-load', () => {
        splashWindow?.destroy();
        splashWindow = null;
        window.show();
    });

    window.webContents.on('devtools-opened', () => {
        window.focus();
        setImmediate(() => {
            window.focus();
        });
    });

    const REFRESH_KEYS = ['CommandOrControl+R', 'CommandOrControl+Shift+R', 'F5'];

    window.on('focus', () => {
        REFRESH_KEYS.forEach((key) => {
            globalShortcut.register(key, () => {
                // pass
            });
        });
    });

    window.on('blur', () => {
        REFRESH_KEYS.forEach((key) => {
            globalShortcut.unregister(key);
        });
    });

    return window;
}

function setApplicationMenu() {
    const defaultMenu = Menu.getApplicationMenu();
    const applicationMenu = new Menu();

    (defaultMenu?.items ?? [])
        .filter((menu) => {
            // remove the original help menu
            return menu.role !== 'help';
        })
        .forEach((menu) => {
            // @ts-ignore
            if (menu.role === 'viewmenu') {
                const subMenu = new Menu();
                (menu.submenu?.items ?? []).forEach((item) => {
                    // @ts-ignore
                    if (item.role !== 'reload' && item.role !== 'forcereload') {
                        subMenu.append(item);
                    }
                });
                applicationMenu.append(
                    new MenuItem({
                        type: menu.type,
                        label: menu.label,
                        submenu: subMenu,
                    }),
                );
            } else {
                applicationMenu.append(menu);
            }
        });

    // append custom help menu
    const helpSubMenu = new Menu();
    const helpSubMenuConfig: MenuItemConstructorOptions[] = [
        {
            label: 'Project Homepage',
            click: function () {
                shell.openExternal(GITHUB_PROJECT_PAGE);
            },
        },
        {
            label: 'Report Issue',
            click: function () {
                shell.openExternal(NEW_ISSUE_PAGE);
            },
        },
        {
            label: 'Install Certificate && Helper',
            click: async () => {
                await installCertAndHelper();
                dialog.showMessageBox({
                    type: 'info',
                    message: 'Install Done, iProxy will restart',
                });
                app.relaunch();
                app.quit();
            },
        },
    ];
    helpSubMenuConfig.forEach((option) => {
        helpSubMenu.append(new MenuItem(option));
    });
    applicationMenu.append(
        new MenuItem({
            label: 'Help',
            type: 'submenu',
            submenu: helpSubMenu,
        }),
    );

    Menu.setApplicationMenu(applicationMenu);
}

app.on('before-quit', function () {
    forceQuit = true;
});

app.on('will-quit', () => {
    // 注销所有快捷键
    globalShortcut.unregisterAll();
});

// quit application when all windows are closed
app.on('window-all-closed', () => {
    // on macOS it is common for applications to stay open until the user explicitly quits
    if (SYSTEM_IS_MACOS) {
        app.quit();
    }
});

app.on('activate', () => {
    if (!appReady) {
        // fix `Cannot create BrowserWindow before app is ready`
        return;
    }
    // on macOS it is common to re-create a window even after all windows have been closed
    if (!mainWindow) {
        mainWindow = createMainWindow();
    }
    mainWindow.show();
});

// create main BrowserWindow when electron is ready
app.on('ready', async () => {
    appReady = true;
    await initSplashScreen();
    await initCopyFiles();
    mainWindow = createMainWindow();
    setApplicationMenu();
    initIPC(mainWindow);
});
