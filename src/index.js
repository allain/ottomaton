import Promise from 'native-promise-only';
import reduce from 'promise-reduce';
import flatten from 'fj-flatten';
import defaults from 'defaults';
import factory from 'simple-factory';
import mapIn from 'map-in';
import isPromise from 'is-promise';

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
    this.registrations = [].concat(this.opts.common ? COMMON_ACTIONS : []);
    this._actions = null;
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
  register(matcher, handler) {
    if (handler) {
      this.registrations.push(Action(matcher, handler));
    } else {
      let action = Action.build(matcher, this);
      this.registrations = this.registrations.concat(action);
    }

    return this;
  }

  // Run all lines throug the actions allowing them to mutate the state passed in.
  async run(lines, state={}) {
    if (typeof lines === 'string') {
      lines = lines.split(/[\r\n]+/g);
    }

    state.ottomaton = this;

    const actions = this._actions = await Action.flattenActions(this.registrations);

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

    if (typeof state !== 'object') throw new Error('state must be an object: ' + state);

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

      args = args.length ? deref(state, args) : [line];

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

}

function deref(state, refs) {
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

Ottomaton.Action = Action;
Ottomaton.LineError = LineError;

export default factory(Ottomaton);


