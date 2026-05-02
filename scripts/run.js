#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const isWin = process.platform === 'win32';

function makeEnv(extra = {}) {
    const env = {
        ...process.env,
        ...extra,
    };
    const binPath = path.join(root, 'node_modules', '.bin');
    env.PATH = `${binPath}${path.delimiter}${env.PATH || ''}`;
    return env;
}

function formatCommand(command, args) {
    return [command, ...args].join(' ');
}

function run(command, args = [], options = {}) {
    const cwd = options.cwd || root;
    console.log(`$ ${formatCommand(command, args)}`);
    const result = spawnSync(command, args, {
        cwd,
        env: makeEnv(options.env),
        stdio: 'inherit',
        shell: isWin,
    });

    if (result.error) {
        throw result.error;
    }

    if (result.status !== 0) {
        process.exit(result.status || 1);
    }
}

function status(command, args = [], options = {}) {
    const cwd = options.cwd || root;
    if (!options.silent) {
        console.log(`$ ${formatCommand(command, args)}`);
    }
    const result = spawnSync(command, args, {
        cwd,
        env: makeEnv(options.env),
        stdio: options.silent ? 'ignore' : 'inherit',
        shell: isWin,
    });

    if (result.error) {
        throw result.error;
    }

    return result.status === null ? 1 : result.status;
}

function output(command, args = [], options = {}) {
    const cwd = options.cwd || root;
    if (!options.silent) {
        console.log(`$ ${formatCommand(command, args)}`);
    }
    const result = spawnSync(command, args, {
        cwd,
        env: makeEnv(options.env),
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', options.silent ? 'ignore' : 'inherit'],
        shell: isWin,
    });

    if (result.error) {
        throw result.error;
    }

    if (result.status !== 0) {
        process.exit(result.status || 1);
    }

    return result.stdout.trim();
}

function runNodeScript(scriptName) {
    run(process.execPath, [path.join('scripts', scriptName)]);
}

function runTask(name) {
    const task = tasks[name];
    if (!task) {
        console.error(`Unknown script: ${name}`);
        console.error(`Available scripts: ${Object.keys(tasks).sort().join(', ')}`);
        process.exit(1);
    }
    task();
}

function cleanDist() {
    fs.rmSync(path.join(root, 'app', 'dist'), { recursive: true, force: true });
}

function compileMain() {
    run('webpack', ['--config', './webpack/webpack.main.prod.config.js'], {
        env: { NODE_ENV: 'production' },
    });
}

function compileRenderer() {
    run('webpack', ['--config', './webpack/webpack.renderer.prod.config.js'], {
        env: { NODE_ENV: 'production' },
    });
}

function compile() {
    compileMain();
    compileRenderer();
}

function build() {
    cleanDist();
    runNodeScript('sync-version.js');
    compile();
}

function electronBuilder(args, options = {}) {
    run('electron-builder', args, {
        env: options.codesign ? {} : { CSC_IDENTITY_AUTO_DISCOVERY: 'false' },
    });
}

function dist(args) {
    build();
    electronBuilder(args);
}

function updateZip() {
    const vendorDir = path.join(root, 'vendor');
    fs.rmSync(path.join(vendorDir, 'files.zip'), { force: true });
    run('npx', ['bestzip', 'files.zip', 'files/'], { cwd: vendorDir });
}

function updateNodeModules() {
    const nodeDir = path.join(root, 'vendor', 'files', 'node');
    fs.rmSync(path.join(nodeDir, 'modules'), { recursive: true, force: true });
    fs.writeFileSync(path.join(nodeDir, 'package.json'), '{}\n');

    run(
        'yarn',
        [
            'add',
            '--ignore-engines',
            '../../whistle-start',
            '../../whistle',
            'whistle.vase',
            '../../whistle.scriptfile',
            '../../whistle.chii-internal',
            '-S',
        ],
        { cwd: nodeDir },
    );

    fs.rmSync(path.join(nodeDir, 'modules'), { recursive: true, force: true });
    fs.renameSync(path.join(nodeDir, 'node_modules'), path.join(nodeDir, 'modules'));
    updateZip();
}

function installDeps() {
    run('yarn', ['--ignore-engines']);
    updateNodeModules();
}

function git(args, options = {}) {
    const gitConfig = [
        '-c',
        'http.version=HTTP/1.1',
        '-c',
        'http.lowSpeedLimit=0',
        '-c',
        'http.lowSpeedTime=999999',
        '-c',
        'core.compression=0',
    ];
    run('git', [...gitConfig, ...args], options);
}

function gitStatus(args, options = {}) {
    const gitConfig = [
        '-c',
        'http.version=HTTP/1.1',
        '-c',
        'http.lowSpeedLimit=0',
        '-c',
        'http.lowSpeedTime=999999',
        '-c',
        'core.compression=0',
    ];
    return status('git', [...gitConfig, ...args], options);
}

function gitOutput(args, options = {}) {
    const gitConfig = [
        '-c',
        'http.version=HTTP/1.1',
        '-c',
        'http.lowSpeedLimit=0',
        '-c',
        'http.lowSpeedTime=999999',
        '-c',
        'core.compression=0',
    ];
    return output('git', [...gitConfig, ...args], options);
}

function escapeRegExp(value) {
    return value.replace(/[\\.^$*+?()[\]{}|]/g, '\\$&');
}

function getLatestSubtreeSplit(prefix) {
    const normalizedPrefix = prefix.replace(/\/+$/, '');
    const grep = `^git-subtree-dir: ${escapeRegExp(normalizedPrefix)}/*$`;
    const body = gitOutput(['log', `--grep=${grep}`, '-n', '1', '--format=%B', 'HEAD'], {
        silent: true,
    });
    const match = body.match(/^git-subtree-split:\s*([0-9a-f]{40})\s*$/m);
    return match ? match[1] : null;
}

function hasCommit(commit) {
    return gitStatus(['cat-file', '-e', `${commit}^{commit}`], { silent: true }) === 0;
}

function fetchCommit(remoteUrl, commit, tempRef, retries) {
    if (hasCommit(commit)) {
        return true;
    }

    for (let attempt = 1; attempt <= retries; attempt += 1) {
        const code = gitStatus([
            'fetch',
            '--no-tags',
            '--depth=1',
            '--filter=blob:none',
            remoteUrl,
            `${commit}:${tempRef}`,
        ]);
        if (code === 0 && hasCommit(commit)) {
            return true;
        }

        if (attempt < retries) {
            console.error(`Fetch commit ${commit} failed. Retry ${attempt + 1}/${retries}...`);
        }
    }

    return false;
}

function upgradeWhistle() {
    const remoteUrl = process.env.WHISTLE_REMOTE_URL || 'https://github.com/avwo/whistle';
    const remoteRef = process.env.WHISTLE_REMOTE_REF || 'master';
    const prefix = process.env.WHISTLE_PREFIX || 'vendor/whistle';
    const retries = Number(process.env.WHISTLE_FETCH_RETRIES || 3);
    const tempRefBase = `refs/ipproxy/whistle-upgrade/${Date.now()}`;
    const tempRef = `${tempRefBase}/target`;
    const refspec = `${remoteRef}:${tempRef}`;
    const tempRefs = [tempRef];

    let fetched = false;

    try {
        for (let attempt = 1; attempt <= retries; attempt += 1) {
            const code = gitStatus(['fetch', '--no-tags', '--depth=1', remoteUrl, refspec]);
            if (code === 0) {
                fetched = true;
                break;
            }

            if (attempt < retries) {
                console.error(`Fetch failed. Retry ${attempt + 1}/${retries}...`);
            }
        }

        if (!fetched) {
            console.error('Failed to fetch whistle after retries.');
            process.exit(1);
        }

        const previousSplit = getLatestSubtreeSplit(prefix);
        if (previousSplit && !hasCommit(previousSplit)) {
            const previousSplitRef = `${tempRefBase}/previous-${previousSplit.slice(0, 12)}`;
            tempRefs.push(previousSplitRef);
            if (!fetchCommit(remoteUrl, previousSplit, previousSplitRef, retries)) {
                console.error(`Failed to fetch previous whistle split ${previousSplit}.`);
                process.exit(1);
            }
        }

        git(['subtree', 'merge', `--prefix=${prefix}`, '--squash', tempRef]);
    } finally {
        tempRefs.forEach((ref) => {
            status('git', ['update-ref', '-d', ref], { silent: true });
        });
    }

    installDeps();
}

function cleanbuild() {
    fs.rmSync(path.join(root, 'node_modules'), { recursive: true, force: true });
    run('yarn');
    runTask('dist');
}

function buildDoc() {
    const docsDir = path.join(root, 'docs');
    run('yarn', [], { cwd: docsDir });
    run('npm', ['run', 'build'], { cwd: docsDir });
}

function artIcon() {
    const chrome =
        process.env.CHROME_BIN ||
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    const screenshot = path.join(root, 'screenshot.png');

    run(chrome, [
        '--headless',
        '--screenshot',
        '--window-size=512,512',
        '--default-background-color=0',
        'art/icon/index.html',
    ]);
    fs.rmSync(path.join(root, 'vendor', 'files', 'icon.png'), { force: true });
    fs.renameSync(screenshot, path.join(root, 'vendor', 'files', 'icon.png'));

    run(chrome, [
        '--headless',
        '--screenshot',
        '--window-size=512,512',
        '--default-background-color=0',
        'art/icon/index-pure.html',
    ]);
    fs.rmSync(path.join(root, 'vendor', 'files', 'icon-pure.png'), { force: true });
    fs.renameSync(screenshot, path.join(root, 'vendor', 'files', 'icon-pure.png'));
}

const tasks = {
    'renderer-dev': () =>
        run('webpack-dev-server', ['--config', './webpack/webpack.renderer.dev.config.js']),
    'main-dev': () => {
        run('webpack', ['--config', './webpack/webpack.main.config.js']);
        run('electron', ['./app']);
    },
    dev: () =>
        run('webpack-dev-server', ['--config', './webpack/webpack.renderer.dev.config.js'], {
            env: { START_HOT: '1' },
        }),
    'compile-main': compileMain,
    'compile-renderer': compileRenderer,
    compile,
    build,
    dist: () => dist(['--mac', '--win', '--x64', '--publish', 'never']),
    'dist:mac': () => dist(['--mac', '--universal']),
    'dist:win': () => dist(['--win', '--x64']),
    'dist:linux': () => dist(['--linux']),
    'dist-codesign': () => {
        build();
        electronBuilder(['--mac', '--win', '--x64', '--publish', 'never'], { codesign: true });
    },
    pack: () => {
        build();
        electronBuilder([
            '--mac',
            '--win',
            '--x64',
            '--publish',
            'never',
            '--dir',
            '-c.compression=store',
            '-c.mac.identity=null',
        ]);
    },
    lint: () => run('eslint', ['./src/**/*.ts', './src/**/*.tsx', '--fix']),
    'upgrade:whistle': upgradeWhistle,
    'update:node_modules': updateNodeModules,
    'update:zip': updateZip,
    'update:zip-fullnode': updateZip,
    cleanbuild,
    'build-doc': buildDoc,
    'install-deps': installDeps,
    ci: () => {
        installDeps();
        runTask('dist');
    },
    postinstall: () => run('electron-builder', ['install-app-deps']),
    test: () => console.log('no test here yet'),
    syncversion: () => runNodeScript('sync-version.js'),
    dateversion: () => runNodeScript('date-version.js'),
    nightlyversion: () => runNodeScript('nightly-version.js'),
    'clean:dist': cleanDist,
    'art:icon': artIcon,
};

runTask(process.argv[2]);
