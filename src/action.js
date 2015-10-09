import factory from 'simple-factory';

class OttomatonAction {
  constructor(matcher, handler) {
    const m = normalizeMatcher(matcher);
    if (!m)
      throw new Error(`Invalid matcher: ${ matcher }`);
    this.matcher = m;
    this.handler = handler;
  }
}


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