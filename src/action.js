import factory from 'simple-factory';
import mapIn from 'map-in';
import isPromise from 'is-promise';

class OttomatonAction {
  constructor(matcher, handler) {
    const m = normalizeMatcher(matcher);
    if (!m)
      throw new Error(`Invalid matcher: ${ matcher }`);
    this.matcher = m;
    this.handler = handler;
  }
}

OttomatonAction.build = function(matcher, ottomaton) {
  if (isPromise(matcher)) {
    return matcher;
  } else if (typeof matcher === 'function') {
    return matcher(ottomaton);
  } else if (matcher instanceof OttomatonAction) {
    return matcher;
  } else if (Array.isArray(matcher)) {
    return matcher;
  } else if (typeof matcher === 'object') {
    if (matcher.handler && matcher.matcher) {
      return new OttomatonAction(matcher.matcher, matcher.handler);
    } else {
      return Object.values(mapIn(matcher, (handler, m) => new OttomatonAction(m, handler)));
    }
  } else {
    throw new Error('invalid matcher arguments: ' + arguments);
  }
};

OttomatonAction.Impl = OttomatonAction;

OttomatonAction.FINISH = function FINISH() {
  return FINISH;
};

OttomatonAction.DONE = function DONE() {
  return DONE;
};

export default factory(OttomatonAction);

function normalizeMatcher(matcher) {
    let m;
    if (typeof matcher === 'string') {
        m = buildMatcherFromRegExp(new RegExp(`^${ matcher.replace(/"[^"]+"/g, '(.+)') }$`));
    } else if (matcher instanceof RegExp) {
        m = buildMatcherFromRegExp(matcher);
    } else if (typeof matcher === 'function') {
        m = matcher;
    } else if (Array.isArray(matcher)) {
        m = buildCompoundMatcher(matcher.map(normalizeMatcher));
    } else {
        throw new Error(matcher);
    }
    return m;
}

function buildMatcherFromRegExp(regexp) {
    return function (line) {
        const args = regexp.exec(line);
        if (args) {
            args.shift();
        }
        return args;
    };
}

function buildCompoundMatcher(matchers) {
    return function (line) {
      var match = matchers.find(m => Array.isArray(m(line)));

      return match ? match(line) : null;
    };
}