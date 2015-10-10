import Promise from 'native-promise-only';
import reduce from 'promise-reduce';
import flatten from 'fj-flatten';
import defaults from 'defaults';
import factory from 'simple-factory';
import mapIn from 'map-in';

const debug = require('debug')('ottomaton');

const Action = require('./action');
const LineError = require('./line-error');

const COMMON_ACTIONS = [
  // Skip blank lines
  Action(/^\s*$/, Action.DONE),

  // Ignore commented lines
  Action(/^\s*(#|REM )/i, Action.DONE)
];

class Ottomaton {
  constructor(opts) {
    this.opts = defaults(opts, {common: true});
    this.registrations = [];
    this._actions = null;
  }

  register(matcher, handler) {
    if (handler) {
      this.registrations.push(Action(matcher, handler));
    } else if (matcher && typeof matcher.then === 'function') {
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
        Object.keys(matcher).forEach(m => this.register(m, matcher[m]));
      }
    } else {
      throw new Error('invalid matcher arguments: ' + arguments);
    }

    return this;
  }

  // Run all lines throug the actions allowing them to mutate the state passed in.
  async run(lines, state={}) {
    if (typeof lines === 'string') {
      lines = lines.split(/[\r\n]+/g);
    }

    state.ottomaton = this;

    const registrations = this.opts.common ? COMMON_ACTIONS.concat(this.registrations) : this.registrations;
    const actions = this._actions = await Promise.all(registrations.map(expandAction)).then(flatten);

    const unrecognizedLine = lines.find(line => {
      return !actions.find(action => action.matcher(line));
    });

    if (unrecognizedLine) {
      debug('unrecognized line: %j', unrecognizedLine);
      throw new LineError(`Unrecognized Line: ${ unrecognizedLine }`);
    }

    lines.push(Action.FINISH);

    var result = await this._execute(lines, state);
    delete result.ottomaton;
    return result;
  }

  async _execute(lines, state = {}) {
    for (let i = 0; i < lines.length; i++) {
      var line = lines[i];

      state.LINE = line;

      var result = await this._executeLine(line, state);
      delete state.LINE;
      if (result === Action.FINISH) {
        break;
      }
    }

    return state;
  }

  async _executeLine(line, state) {
    const self = this;

    let recognized = false;
    let replacement = null;

    debug('executing line %s against %d actions', line, this._actions.length);
    for (const action of this._actions) {
      var args;
      if (action.matcher === Action.FINISH) {
        args = (line === Action.FINISH) ? [] : null;
      } else {
        args = await Promise.resolve(action.matcher(line));
        if (!Array.isArray(args))
          continue;
      }

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

      var result = await handlerResult;
      if (result) {
        replacement = result;
        if (replacement === Action.DONE)
          break;
      }
    }

    if (replacement && [Action.DONE, Action.FINISH].indexOf(replacement) !== -1) {
      return replacement;
    }

    if ([Action.DONE, Action.FINISH].indexOf(line) !== -1) {
      return line;
    }

    if(!recognized) {
      throw new LineError([line]);
    }

    if (replacement === undefined) {
      return state;
    }

    if (typeof replacement === 'string') {
      return self._execute(replacement.split(/[\r\n]+/g), state);
    }

    if (Array.isArray(replacement)) {
      return self._execute(replacement, state);
    }
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
}

Ottomaton.Action = Action;
Ottomaton.LineError = LineError;

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

function complainAboutLine(errored, line) {
  if (errored) {
    throw new LineError(line || errored);
  }
}

export default factory(Ottomaton);



