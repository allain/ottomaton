module.exports = OttomatonAction;

function OttomatonAction(matcher, handler) {
  if (!(this instanceof OttomatonAction)) return new OttomatonAction(matcher, handler);

  var m = normalizeMatcher(matcher);
  if (!m) throw new Error('Invalid matcher: ' + matcher);

  this.matcher = m;

  this.handler = handler;
}

OttomatonAction.FINISH = function () {
  return FINISH;
};
OttomatonAction.DONE = function DONE() {
  return DONE;
};

function normalizeMatcher(matcher) {
  var m;

  if (typeof matcher === 'string') {
    m = buildMatcherFromRegExp(new RegExp('^' + matcher.replace(/"[^"]+"/g, '(.+)') + '$'));
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
    var args = regexp.exec(line);
    if (args) {
      args.shift();
    }

    return args;
  };
}

function buildCompoundMatcher(matchers) {
  return function (line) {
    for (var i = 0; i < matchers.length; i++) {
      var args = matchers[i](line);
      if (Array.isArray(args)) {
        return args;
      }
    }

    return null;
  };
}

