import factory from 'simple-factory';
import mapIn from 'map-in';
import isPromise from 'is-promise';
import map from 'fj-map';
import flatten from 'fj-flatten';

var FINISH = () => FINISH;
var DONE = () => DONE;

class OttomatonAction {
  constructor(matcher, handler) {
    const m = prepareMatcher(matcher);
    if (!m)
      throw new Error(`Invalid matcher: ${ matcher }`);

    this.matcher = m;
    this.handler = handler;
  }
}

// Prepares a matcher by convert it to a function
function prepareMatcher(matcher) {
  if (typeof matcher === 'function')
    return matcher;

  if (typeof matcher === 'string')
    matcher = new RegExp(`^${ matcher.replace(/"[^"]+"/g, '(.+)') }$`);

  if (matcher instanceof RegExp)
    return line => {
      const args = matcher.exec(line);
      if (args)
          args.shift();
      return args;
    };


  if (Array.isArray(matcher)) {
    matcher = matcher.map(prepareMatcher);
    return line => {
      var match = matcher.find(m => Array.isArray(m(line)));
      return match ? match(line) : null;
    };
  }

  throw new Error(matcher);
}

OttomatonAction.FINISH = FINISH;
OttomatonAction.DONE = DONE;

OttomatonAction.build = function(matcher, ottomaton) {
  if (isPromise(matcher))
    return matcher;

  if (typeof matcher === 'function')
    return matcher(ottomaton);

  if (matcher instanceof OttomatonAction)
    return matcher;

  if (Array.isArray(matcher))
    return matcher;

  if (typeof matcher === 'object' && matcher.handler && matcher.matcher)
    return new OttomatonAction(matcher.matcher, matcher.handler);

  if (typeof matcher === 'object')
      return Object.values(mapIn(matcher, (handler, m) => new OttomatonAction(m, handler)));

  throw new Error('invalid matcher arguments: ' + arguments);
};

// Prepares actions by ensuring they are all actually OttomanActions with function matchers
OttomatonAction.prepareActions = function(actions) {
  return Promise.all(actions).then(map(prepareAction)).then(flatten);
};

function prepareAction(action) {
  if (isPromise(action))
    return action.then(prepareAction);

  if (Array.isArray(action))
    return action.map(prepareAction);

  if (action.matcher === FINISH)
    action.matcher = line => line === FINISH ? [] : null;
  else if (action.matcher === DONE)
    action.matcher = line => line === DONE ? [] : null;

  if (!action instanceof OttomatonAction)
    action = Action(action.matcher, action.handler);

  return action;
}

export default factory(OttomatonAction);
