import Promise from 'native-promise-only';
import reduce from 'promise-reduce';
import flatten from 'fj-flatten';
import defaults from  'defaults';

const debug = require('debug')('ottomaton');

export default Ottomaton;

const Action = Ottomaton.Action = require('./action');
const LineError = Ottomaton.LineError = require('./line-error');

// To support factory pattern
function Ottomaton(opts) {
  return new OttomatonClass(opts);
}

class OttomatonClass {
  constructor(opts) {
    this.opts = defaults(opts, {common: true});
    this.registrations = [];
    this._actions = null;
  }

  // Queue up actions or Promises which resolve to actions or array of actions for later registration
  register(matcher, handler) {
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
        Object.keys(matcher).forEach(function (m) {
          this.register(m, matcher[m]);
        }.bind(this));
      }
    } else {
      throw new Error('invalid arguments');
    }
    return this;
  }

  /**
   * Run all lines through the actions allowing them to mutate the state passed in
   * @param lines
   * @param state
   * @returns the resultant state
   */
  run(lines, state = {}) {
    if (typeof lines === 'string') {
      lines = lines.split(/[\r\n]+/g);
    }

    state.ottomaton = this;

    return this._buildActions().then(actions => {
      const unrecognizedLines = lines.map((line, index) => {
        if (line === Action.FINISH)
          return false;

        return actions.find(action => {
          if (typeof action.matcher !== 'function') {
            throw new Error(`invalid matcher: ${ action.matcher }`);
          }

          return action.matcher(line);
        }) ? false : `Unrecognized Line: #${ index + 1 }: ${ line }`;
      }).filter(Boolean);
      if (unrecognizedLines.length) {
        return Promise.reject(new LineError(unrecognizedLines));
      }
      if (!lines || !any(lines, line => {
        return line === Action.FINISH;
      })) {
        lines.push(Action.FINISH);
      }
      return this._execute(lines, state);
    }).then(result => {
      delete result.ottomaton;
      return result;
    });
  }

  _execute(lines, state = {}) {
    return Promise.resolve(lines).then(reduce((state, line) => {
      return this._executeLine(line, state);
    }, state));
  }

  _executeLine(line, state) {
    let recognized = false;
    let replacement = null;
    state.LINE = line;
    return Promise.resolve(this._actions).then(reduce(function (state, action) {
      if (replacement !== null)
        return state;
      // skip execution
      let args = action.matcher(line);
      if (Array.isArray(args)) {
        recognized = true;
        args = args.length ? this._deref(state, args) : [line];
        let handlerResult;
        const handler = action.handler;
        if (typeof handler === 'function') {
          handlerResult = Promise.resolve(handler.apply(state, args));
        } else if (typeof handler === 'string' || Array.isArray(handler)) {
          handlerResult = Promise.resolve(handler);
        } else {
          throw new Error(`Invalid handler: ${ handler }`);
        }
        return handlerResult.then(result => {
          replacement = result;
          return state;
        });
      }
      return state;
    }.bind(this), state)).then(function (state) {
      if ([
        Action.DONE,
        Action.FINISH
      ].indexOf(line) === -1 && !recognized) {
        throw new LineError(`Unrecognized Line: ${ line }`);
      }
      if ([
        Action.DONE,
        Action.FINISH
      ].indexOf(replacement) !== -1) {
      } else if (typeof replacement === 'string') {
        return this._execute(replacement.split(/[\r\n]+/g), state);
      } else if (Array.isArray(replacement)) {
        return this._execute(replacement, state);
      }
      return state;
    }.bind(this)).then(result => {
      delete result.LINE;
      return result;
    }, err => {
      delete state.LINE;
      throw err;
    });
  }

  _deref(state, refs) {
    return refs.map(ref => {
      let match = /^"(.+)"$/g.exec(ref);
      if (match) {
        return match[1];
      }
      match = /^([A-Z][A-Z0-9]*_)*[A-Z0-9]+$/g.exec(ref);
      if (!match) {
        return ref;
      }
      const val = state[ref];
      if (val === undefined) {
        throw new Error(`Unknown Reference: ${ ref }`);
      }
      return val;
    });
  }

  _buildActions() {
    if (this._actions)
      return Promise.resolve(this._actions);
    if (this.opts.common) {
      // Prepend built-in actions
      this.registrations.unshift([
        // Skip blank lines
        Action(/^\s*$/, Action.DONE),
        // Ignore commented lines
        Action(/^\s*(#|REM )/i, Action.DONE)
      ]);
    }
    return Promise.all(this.registrations.map(expandAction)).then(flatten).then(function (actions) {
      this._actions = actions;
      return actions;
    }.bind(this));
  }
}

function expandAction(action) {
  if (typeof action.then === 'function') {
    return action.then(expandAction);
  } else if (Array.isArray(action)) {
    return action.map(expandAction);
  }
  if (action.matcher === Action.FINISH) {
    action.matcher = function (line) {
      return line === Action.FINISH ? [] : null;
    };
  }
  if (action.matcher === Action.DONE) {
    action.matcher = function (line) {
      return line === Action.DONE ? [] : null;
    };
  }
  if (!action instanceof Action) {
    action = Action(action.matcher, action.handler);
  }
  return action;
}
function any(array, predicate) {
  for (let i = 0; i < array.length; i++) {
    if (predicate(array[i]))
      return true;
  }
  return false;
}