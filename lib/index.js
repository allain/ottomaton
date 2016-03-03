var Promise = require('any-promise')
var flatter = require('fj-flatten')
var defaults = require('defaults')
var reduce = require('promise-reduce')
var eachSeries = require('./each-series')

var debug = require('debug')('ottomaton')

var Action = require('./action')

var COMMON_ACTIONS = [
  require('./actions/comment'),
  require('./actions/assign-variable'),
  require('./actions/sleep'),
  require('./actions/wait-for-keystroke')
]

function Ottomaton (opts) {
  if (!(this instanceof Ottomaton))
    return new Ottomaton(opts)

  this.opts = defaults(opts, { common: true, extraState: {} })
  this.registrations = [].concat(this.opts.common ? COMMON_ACTIONS : [])
  this.extraState = this.opts.extraState

  this.extraState.ottomaton = this

  this._actions = null
}

/**
 * Registers an action for later use during run.
 *
 * Supports many call strategies:
 *
 * Single simple object
 * register({matcher: ..., handler: ...})
 *
 * A hash of text matchers, to their respective handlers
 * register({TEXT1: handler, TEXT2: handler, ...})
 *
 * A promise which will eventually resolve to an array or hash or Actions
 * register(Promise)
 */
Ottomaton.prototype.register = function (matcher, handler) {
  if (handler) {
    this.registrations.push(Action(matcher, handler))
  } else {
    var action = Action.build(matcher, this)
    this.registrations = this.registrations.concat(action)
  }

  return this
}

// Run all lines throug the actions allowing them to mutate the state passed in.
Ottomaton.prototype.run = function (lines, state) {
  state = state || {}
  if (typeof lines === 'string') {
    lines = lines.split(/[\r\n]+/g)
  }

  // Only examine and perform lines that happen before the FINISH
  var newLines = []
  for (var i = 0; i < lines.length; i++) {
    var line = lines[ i ]
    if (line === Action.FINISH || line === 'FINISH')
      break

    if (line)
      newLines.push(line)
  }
  lines = newLines

  this.extraState.deref = name => deref(state, [ name ])[ 0 ]

  return Action.prepareActions(this.registrations)
    .then(actions => {
      debug('Actions prepared %d', actions.length)

      this._actions = actions

      Object.assign(state, this.extraState)

      checkLines(actions, lines)

      var failure
      return this._execute(lines, state)
        .catch(err => failure = err)
        .then(() => {
          debug('done executing lines')

          return this._executeLine(Action.FINISH, state).catch(err => {
            debug('An ERROR Occured running FINISH: ', err.stack || err)
          // nothing to do here
          })
        }).then(() => {
        Object.keys(this.extraState).forEach(prop => delete state[ prop ])

        if (failure) throw failure

        return state
      })
    })
}

Ottomaton.prototype._execute = function (lines, state) {
  state = state || {}

  debug('executing lines against %d actions', this._actions.length)

  return eachSeries(lines, line => {
    state.LINE = line

    return this._executeLine(line, state)
      .then(result => {
        delete state.LINE
        return result !== Action.FINISH
      })
  }).then(() => {
    return state
  })
}

Ottomaton.prototype._executeLine = function (line, state) {
  if (typeof state !== 'object') throw new Error('state must be an object: ' + state)

  var recognized = false
  var replacement = null

  if (line === Action.FINISH)
    debug('executing line FINISH')
  else
    debug('executing line %s', line)

  var handleResult = (result) => {
    if (result) {
      replacement = result
      if (replacement === Action.DONE) {
        debug('DONE => false')
        return false
      }
    }

    if (replacement && [ Action.DONE, Action.FINISH ].indexOf(replacement) !== -1) {
      return replacement
    }

    if ([ Action.DONE, Action.FINISH ].indexOf(line) !== -1) {
      return line
    }

    if (!recognized) {
      throw new Error(`Unrecognized Line: ${ line }`)
    }

    if (replacement === undefined) {
      return state
    }

    if (typeof replacement === 'string') {
      return this._execute(replacement.split(/[\r\n]+/g), state)
    }

    if (Array.isArray(replacement)) {
      return this._execute(replacement, state)
    }
  }

  return eachSeries(this._actions, action => {
    return Promise.resolve(parseArgsIfMatch(action, line))
      .then(args => {
        if (args === null) return state

        args = args.length ? args : [ line ]
        if (!action.opts || action.opts.deref !== false) {
          args = deref(state, args)
        }

        if (!args) return false

        recognized = true

        var handler = action.handler
        if (typeof handler === 'string' || Array.isArray(handler)) {
          return handleResult(handler)
        }

        if (typeof handler === 'function') {
          return Promise.resolve(handler.apply(state, args)).then(handleResult)
        }

        throw new Error(`Invalid handler: ${ handler }`)
      })
  })
}

function checkLines (actions, lines) {
  var unrecognizedLine = lines.find(line => !actions.find(action => action.matcher(line)))

  if (unrecognizedLine) {
    debug('unrecognized line: %j', unrecognizedLine)
    throw new Error(`Unrecognized Line: ${ unrecognizedLine }`)
  }
}

function parseArgsIfMatch (action, line) {
  if (line === Action.FINISH)
    return action.matcher === Action.FINISH ? Action.FINISH : null

  return Promise.resolve(action.matcher(line)).then(args => {
    return Array.isArray(args) ? args : null
  })
}

function deref (state, refs) {
  return refs.map(ref => {
    var match = /^"(.+)"$/g.exec(ref)
    if (match)
      return match[ 1 ]

    match = /^([A-Z][A-Z0-9]*_)*[A-Z][A-Z0-9]+$/g.exec(ref)
    if (!match)
      return ref

    var val = state[ ref ]
    if (val === undefined)
      throw new Error(`Unknown Reference: ${ ref }`)

    return val
  })
}

Ottomaton.Action = Action

module.exports = Ottomaton
