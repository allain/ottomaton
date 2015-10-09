import Promise from 'native-promise-only';
import reduce from 'promise-reduce';
import flatten from 'fj-flatten';
import defaults from 'defaults';
import factory from 'simple-factory';
import mapIn from 'map-in';

const debug = require('debug')('ottomaton');

class Ottomaton {
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
    } else if (matcher instanceof Action.Impl) {
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
      const unrecognizedLines = Object.values(mapIn(lines, (line, index) => {
        if (!actions.find(action => action.matcher(line)))
          return `Unrecognized Line: #${ index + 1 }: ${ line }`;
      }).filter(Boolean));

      if (unrecognizedLines.length) {
        debug('unrecognized lines: %j', unrecognizedLines);
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
    const self = this;
    let recognized = false;
    let replacement = null;
    state.LINE = line;
        
    return this._buildActions().then(async function(actions) {
      debug('executing line %s against %d actions', line, actions.length); 
      for (const action of actions) {
        let args = await Promise.resolve(action.matcher(line));
        if (!Array.isArray(args))
          continue;

        recognized = true;

        args = args.length ? self._deref(state, args) : [line];

        let handlerResult;
        const handler = action.handler;
        if (typeof handler === 'function') {
          handlerResult = handler.apply(state, args);
        } else if (typeof handler === 'string' || Array.isArray(handler)) {
          handlerResult = handler;
        } else {
          throw new Error(`Invalid handler: ${ handler }`);
        }

        var result = await Promise.resolve(handlerResult);
        debug('handler resulted in %j', result);
        if (result) {
          replacement = result;
          break;
        }
      }
    }).then(()=> {
      if ([
        Action.DONE,
        Action.FINISH
      ].indexOf(line) === -1 && !recognized) {
        throw new LineError([line]);
      }
       
      if (replacement === undefined) {
        return state;
      }
 
      if (typeof replacement === 'string') {
        return this._execute(replacement.split(/[\r\n]+/g), state);
      }
      
      if (Array.isArray(replacement)) {
        return this._execute(replacement, state);
      }
 
      return state;
    }).then(result => {
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
      if (match) 
        return match[1];
      
      match = /^([A-Z][A-Z0-9]*_)*[A-Z0-9]+$/g.exec(ref);
      if (!match) 
        return ref;
      
      const val = state[ref];
      if (val === undefined) 
        throw new Error(`Unknown Reference: ${ ref }`);

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

    return Promise.all(this.registrations.map(expandAction)).then(flatten).then(actions => {
      this._actions = actions;
      return actions;
    });
  }
}

const Action = Ottomaton.Action = require('./action');
const LineError = Ottomaton.LineError = require('./line-error');


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
  if (!action instanceof Action.Impl) {
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

export default factory(Ottomaton);
