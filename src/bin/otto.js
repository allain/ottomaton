#!/usr/bin/env node
var debug = require('debug')('ottomaton');
var chalk = require('chalk');
var Ottomaton = require('..');
var Promise = require('native-promise-only');
var reduce = require('promise-reduce');
var fs = require('fs');
var path = require('path');

var otto = Ottomaton();

var argv = require('minimist')(process.argv.slice(2));

if (argv.version) {
  console.log(require('../package.json').version);
  process.exit(0);
}

var currentLib;
var cwd = process.cwd();
var scripts = [];
try {
  [].concat(argv._).forEach(function(libPath) {
    currentLib = path.resolve(cwd, libPath);

    if (!currentLib.match(/[.]txt$/)) {
      debug('registering library: %s', currentLib);
      otto.register(require(currentLib));
    } else {
      scripts.push(currentLib);
    }
  });
} catch(err) {
  debug('unable to register library "%s" reason: %j', currentLib, err);
  console.error(chalk.red('ERROR: unable to register library "' + currentLib + '"'));
  process.exit(1);
}

if (scripts.length) {
  Promise.resolve(scripts).then(reduce(function (state, srcPath) {
    srcPath = path.resolve(cwd, srcPath);
    if (!fs.existsSync(srcPath)) {
      throw new Error('file could not be loaded: ' + srcPath);
    }

    return otto.run(fs.readFileSync(srcPath, 'utf-8'), state);
  }, argv)).catch(function (err) {
    debug('ERROR %j', err);
    console.error(chalk.red('ERROR: ' + err.message));
    process.exit(1);
  });
} else {
  var content = [];
  process.stdin.resume();
  process.stdin.on('data', function(buf) {
    content.push(buf.toString());
  });
  process.stdin.on('end', function() {
    return otto.run(content.join(''), argv).catch(function (err) {
      debug('ERROR %j', err);
      console.error(chalk.red('ERROR: ' + err.message));
      process.exit(1);
    });
  });
}
