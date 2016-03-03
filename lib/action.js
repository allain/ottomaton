var Promise = require('any-promise')

var isPromise = require('is-promise')
var map = require('fj-map')
var flatten = require('fj-flatten')
var objectValues = require('object-values')

var FINISH = () => FINISH
var DONE = () => DONE

function Action (matcher, handler, opts) {
  if (!(this instanceof Action))
    return new Action(matcher, handler, opts)

  opts = opts || {}
  var m = prepareMatcher(matcher)
  if (!m)
    throw new Error(`Invalid matcher: ${ matcher }`)

  this.matcher = m
  this.handler = handler
  this.opts = opts
}

// Prepares a matcher by converting it to a function if needed
function prepareMatcher (matcher) {
  if (typeof matcher === 'function')
    return matcher

  if (typeof matcher === 'string')
    matcher = new RegExp(`^${ matcher.replace(/"[^"]+"/g, '(.+)') }$`)

  if (matcher instanceof RegExp)
    return line => {
      var args = matcher.exec(line)
      if (args)
        args.shift()
      return args
  }

  if (Array.isArray(matcher)) {
    matcher = matcher.map(prepareMatcher)

    return line => {
      var match = matcher.find(m => Array.isArray(m(line)))
      return match ? match(line) : null
    }
  }

  throw new Error('Count not prepare action using matcher', matcher)
}

Action.FINISH = FINISH
Action.DONE = DONE

Action.build = function build (matcher, ottomaton) {
  if (isPromise(matcher))
    return matcher

  if (typeof matcher === 'function')
    return matcher(ottomaton)

  if (matcher instanceof Action)
    return matcher

  if (Array.isArray(matcher))
    return matcher.map(m => build(m, ottomaton))

  if (typeof matcher === 'object' && matcher.handler && matcher.matcher)
    return new Action(matcher.matcher, matcher.handler)

  if (typeof matcher === 'object') {
    return Object.keys(matcher).map(m => new Action(m, matcher[m]))
  }

  throw new Error('invalid matcher arguments: ' + arguments)
}

// Prepares actions by ensuring they are all actually OttomanActions with function matchers
Action.prepareActions = function (actions) {
  return Promise.all(actions).then(map(prepareAction)).then(flatten)
}

function prepareAction (action) {
  if (!action) throw new Error('Invalid action: ' + action)

  if (isPromise(action))
    return action.then(prepareAction)

  if (Array.isArray(action))
    return action.map(prepareAction)

  if (action.matcher === DONE)
    action.matcher = line => line === DONE ? [] : null

  if (!action instanceof Action) {
    action = Action(action.matcher, action.handler)
  }

  return action
}

module.exports = Action
