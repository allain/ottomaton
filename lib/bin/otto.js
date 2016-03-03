#!/usr/bin/env node

var debug = require('debug')('ottomaton')
var chalk = require('chalk')
var getStdin = require('get-stdin')
var Promise = require('any-promise')
var fs = require('fs')
var path = require('path')
var eachSeries = require('../each-series')
var objectValues = require('object-values')

var Ottomaton = require('..')

var argv = require('minimist')(process.argv.slice(2))
if (argv.version) {
  console.log(require('../package.json').version)
  process.exit(0)
}

var otto = Ottomaton(argv)

var currentLib
var cwd = process.cwd()
var scripts = []
try {
  [].concat(argv._).forEach(libPath => {
    currentLib = path.resolve(cwd, libPath)

    if (!currentLib.match(/[.]txt$/)) {
      debug('registering library: %s', currentLib)
      otto.register(require(currentLib))
    } else {
      scripts.push(currentLib)
    }
  })
} catch (err) {
  debug('unable to register library "%s" reason: %j', currentLib, err)
  console.error(chalk.red(`ERROR: unable to register library "${ currentLib }"`))
  process.exit(1)
}

function runScripts (scripts, state) {
  return eachSeries(scripts, script => {
    return otto.run(script, state)
  }).then(() => state)
}

function loadScriptFiles (scriptPaths, state) {
  return objectValues(scriptPaths.map(srcPath => {
    srcPath = path.resolve(cwd, srcPath)
    if (!fs.existsSync(srcPath))
      throw new Error(`file could not be loaded: ${ srcPath }`)

    return fs.readFileSync(srcPath, 'utf-8')
  }))
}

var displayError = err => {
  console.error(chalk.red(`ERROR: ${ err.message }`))
  process.exit(1)
}

var startKeys = Object.keys(argv)

var finish = state => {
  var outputState = {}

  Object.keys(state).forEach(function (key) {
    // Ignore keys that were passed in
    if (startKeys.indexOf(key) === -1 && key !== 'html') {
      outputState[key] = state[key]
    }
  })

  if (argv.output === 'json') {
    console.log(JSON.stringify(outputState))
  } else {
    Object.keys(outputState).forEach(function (key) {
      console.log(key, '=', outputState[key])
    })
  }

  // So that any process.stdin.once('data', ...) don't call the prcess to lock up.
  process.stdin.unref()
}

if (scripts.length) {
  runScripts(loadScriptFiles(scripts), argv).then(finish, displayError)
} else {
  getStdin().then(function (src) {
    runScripts([src], argv)
  }).then(finish, displayError)
}
