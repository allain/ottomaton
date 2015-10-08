module.exports = OttomatonAction;

function OttomatonAction(matcher, handler) {
  if (!(this instanceof OttomatonAction)) return new OttomatonAction(matcher, handler);

  var m = normalizeMatcher(matcher);
  if (!m) throw new Error('Invalid matcher: ' + matcher);

  this.matcher = m;
  this.handler = handler;
}

OttomatonAction.FINISH = '{FINISH}';
OttomatonAction.DONE = '{DONE}';

function normalizeMatcher(matcher) {
  var m;

  if (typeof matcher === 'string') {
    m = buildMatcherFromRegExp(new RegExp('^' + matcher.replace(/"[^"]+"/g, '(.+)') + '$'));
  } else if (matcher instanceof RegExp) {
    m = buildMatcherFromRegExp(matcher);
  } else if (typeof matcher === 'function') {
    m = matcher;
  } else if (Array.isArray(matcher)) {
    // The elements of this array will be validated when expanded by the Ottomaton.register function
    m = matcher;
  }

  return m;
}

function buildMatcherFromRegExp(regexp) {
  return function(line) {
    var args = regexp.exec(line);
    if (args)  {
      args.shift();
    }

    return args;
  };  
}

