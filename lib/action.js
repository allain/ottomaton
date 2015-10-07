module.exports = OttomatonAction;

function OttomatonAction(matcher, handler) {
  var m = normalizeMatcher(matcher);
  if (!m) throw new Error('Invalid matcher type: ' + typeof matcher);

  this.matcher = m;
  this.handler = handler;
}

function normalizeMatcher(matcher) {
  var m;

  if (typeof matcher === 'string') {
    m = buildMatcherFromRegExp(new RegExp('^' + matcher.replace(/"[^"]+"/g, '(.+)') + '$'));
  } else if (matcher instanceof RegExp) {
    m = buildMatcherFromRegExp(matcher);
  } else if (typeof matcher === 'function') {
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

