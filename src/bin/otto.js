#!/usr/bin/env node

const debug = require('debug')('ottomaton');
const chalk = require('chalk');
const Ottomaton = require('..');
const Promise = require('native-promise-only');
const reduce = require('promise-reduce');
const fs = require('fs');
const path = require('path');
const otto = Ottomaton();
const argv = require('minimist')(process.argv.slice(2));
if (argv.version) {
    console.log(require('../package.json').version);
    process.exit(0);
}
let currentLib;
const cwd = process.cwd();
const scripts = [];
try {
    [].concat(argv._).forEach(libPath => {
        currentLib = path.resolve(cwd, libPath);
        if (!currentLib.match(/[.]txt$/)) {
            debug('registering library: %s', currentLib);
            otto.register(require(currentLib));
        } else {
            scripts.push(currentLib);
        }
    });
} catch (err) {
    debug('unable to register library "%s" reason: %j', currentLib, err);
    console.error(chalk.red(`ERROR: unable to register library "${ currentLib }"`));
    process.exit(1);
}
if (scripts.length) {
    Promise.resolve(scripts).then(reduce((state, srcPath) => {
        srcPath = path.resolve(cwd, srcPath);
        if (!fs.existsSync(srcPath)) {
            throw new Error(`file could not be loaded: ${ srcPath }`);
        }
        return otto.run(fs.readFileSync(srcPath, 'utf-8'), state);
    }, argv)).catch(err => {
        debug('ERROR %j', err);
        console.error(chalk.red(`ERROR: ${ err.message }`));
        process.exit(1);
    });
} else {
    const content = [];
    process.stdin.resume();
    process.stdin.on('data', buf => {
        content.push(buf.toString());
    });
    process.stdin.on('end', () => {
        return otto.run(content.join(''), argv).catch(err => {
            debug('ERROR %j', err);
            console.error(chalk.red(`ERROR: ${ err.message }`));
            process.exit(1);
        });
    });
}