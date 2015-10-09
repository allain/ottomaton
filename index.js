var Promise = require('native-promise-only');
var reduce = require('promise-reduce');
var flatten = require('fj-flatten');
var defaults = require('defaults');

module.exports = Ottomaton;

var Action = Ottomaton.Action = require('./lib/action');
var LineError = Ottomaton.LineError = require('./lib/line-error');

function Ottomaton(opts) {
  if (!(this instanceof Ottomaton)) return new Ottomaton(opts);

  this.opts = defaults(opts, {common: true});

  this.registrations = [];
  this._actions = null;
}

Ottomaton.prototype = {
  // Queue up actions or Promises which resolve to actions or array of actions for later registration
  register: function(matcher, handler) {
    if (handler) {
      this.registrations.push(Action(matcher, handler));
      return this;
    } 
    
    // Single param registrations
    if (matcher && typeof matcher.then === 'function') {
      this.registrations.push(matcher);
    } else if (typeof matcher === 'function') {
      this.registrations.push(matcher(this));
    } else if (matcher instanceof Action) {
      this.registrations.push(matcher);
    } else if (Array.isArray(matcher)) {
      this.registrations.push(matcher);
    } else if (typeof matcher === 'object') {
      if (matcher.handler && matcher.matcher) {
        this.registrations.push(Action(matcher.matcher, matcher.handler));
      } else {
        Object.keys(matcher).forEach(function(m) {
          this.register(m, matcher[m]);
        }.bind(this));
      }
    } else {
      throw new Error('invalid arguments');
    }

    return this;
  },

  run: function(lines, state) {
    if (typeof lines === 'string') {
      lines = lines.split(/[\r\n]+/g);
    }
    state = state || {};
    state.ottomaton = this;

    return this._buildActions().then(function(actions) {
      var unrecognizedLines = lines.map(function (line, index) {
        if (line === Action.FINISH) return false;

        if (any(actions, function(action) {
          if (typeof action.matcher !== 'function') {
            throw new Error('invalid matcher: ' + action.matcher);
          }

          return action.matcher(line);
        })) {
          return false;
        } else {
          return 'Unrecognized Line: #' + (index + 1) + ': ' + line;
        }
      }).filter(Boolean);

      if (unrecognizedLines.length) {
        return Promise.reject(new LineError(unrecognizedLines));
      }

      if (!lines || !any(lines, function(line) {
        return line === Action.FINISH;
      })) {
        lines.push(Action.FINISH);
      }

      return this._execute(lines, state);
    }.bind(this)).then(function(result) {
      delete result.ottomaton;
      return result;
    });
  },
  
  _execute: function(lines, state) {
    state = state || {};

    if (typeof lines === 'string') {
      lines = lines.split(/[\r\n]+/g);
    }

    return Promise.resolve(lines).then(reduce(function (state, line) {
      return this._executeLine(line, state);
    }.bind(this), state));
  },

  _executeLine: function(line, state) {
    var recognized = false;
    var replacement = null;

    return Promise.resolve(this._actions).then(reduce(function (state, action) {
      if (replacement !== null) return state; // skip execution

      var args = action.matcher(line);
      if (Array.isArray(args)) {
        recognized = true;
        args = args.length ? this._deref(state, args) : [line];
        var handlerResult;
        var handler = action.handler;

        if (typeof handler === 'function') {
          handlerResult = Promise.resolve(handler.apply(state, args));
        } else if (typeof handler === 'string' || Array.isArray(handler)) {
          handlerResult = Promise.resolve(handler);
        } else {
          throw new Error('Invalid handler: ' + handler);
        }

        return handlerResult.then(function (result) {
          if (typeof result === 'string' || Array.isArray(result)) {
            replacement = result;
          }

          return state;
        });
      }

      return state;
    }.bind(this), state)).then(function (state) {
      if ([Action.DONE, Action.FINISH].indexOf(line) === -1 && !recognized) {
        throw new LineError('Unrecognized Line: ' + line);
      }

      if (typeof replacement === 'string' && [Action.DONE, Action.FINISH].indexOf(replacement) === -1) {
        return this._execute(replacement, state);
      } else if (Array.isArray(replacement)) {
        return this._execute(replacement, state);
      }

      return state;
    }.bind(this));
  },

  _deref: function(state, refs) {
    return refs.map(function(ref) {
      var match = /^"(.+)"$/g.exec(ref);
      if (match) {
        return match[1];
      }

      match = /^([A-Z][A-Z0-9]*_)*[A-Z0-9]+$/g.exec(ref);
      if (!match) {
        return ref;
      }

      var val = state[ref];
      if (val === undefined) {
        throw new Error('Unknown Reference: ' + ref);
      }

      return val;
    });
  },

  _buildActions: function() {
    if (this._actions) return Promise.resolve(this._actions);

    if (this.opts.common) {
      // Prepend built-in actions
      this.registrations.unshift([
        // Skip blank lines
        Action(/^\s*$/, function() {
          return Action.DONE;
        }),

        // Ignore commented lines
        Action(/^\s*(#|REM )/i, function() {
          return Action.DONE;
        })
      ]);
    }

    return Promise.all(this.registrations.map(expandAction)).then(flatten).then(function(actions) {
      this._actions = actions;
      return actions;
    }.bind(this));
  }
};

function expandAction(action) {
  if (typeof action.then === 'function') {
    return action.then(expandAction);
  }

  if (Array.isArray(action)) {
    return action.map(expandAction);
  } else if (Array.isArray(action.matcher)) {
    return action.matcher.map(function(m) {
      return Action(m, action.handler); // In case it returns a promise
    });
  } else {
    return action;
  }
}

function any(array, predicate) {
  for (var i=0; i < array.length; i++) {
    if (predicate(array[i])) return true;
  }
  return false;
}

