#!/usr/bin/env node

const debug = require('debug')('ottomaton');
const chalk = require('chalk');
const getStdin = require('get-stdin');
const Promise = require('native-promise-only');
const fs = require('fs');
const path = require('path');
const Ottomaton = require('..');
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

async function runScripts(scripts, state) {
  for (let script of scripts) {
    await otto.run(script, state);
  }

  return state;
}

function loadScriptFiles(scriptPaths, state) {
  return Object.values(scriptPaths.map(srcPath => {
    srcPath = path.resolve(cwd, srcPath);
    if (!fs.existsSync(srcPath))
      throw new Error(`file could not be loaded: ${ srcPath }`);

    return fs.readFileSync(srcPath, 'utf-8');
  }));
}

let displayError = err => {
  console.error(chalk.red(`ERROR: ${ err.message }`));
  process.exit(1);
};

let startKeys = Object.keys(argv);

let output = state => {
  var outputState = {};

  Object.keys(state).forEach(function(key) {
    // Ignore keys that were passed in
    if (startKeys.indexOf(key) === -1 && key !== 'html') {
      outputState[key] = state[key];
    }
  });

  if (argv.output === 'json') {
    console.log(JSON.stringify(outputState))
  } else {
    Object.keys(outputState).forEach(function(key) {
      console.log(key, '=', outputState[key]);
    });
  }
};

if (scripts.length) {
  runScripts(loadScriptFiles(scripts), argv).then(output, displayError);
} else {
  getStdin().then(function(src) {
    runScripts([src], argv);
  }).then(output, displayError);
}
