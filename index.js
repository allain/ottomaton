var Promise = require('native-promise-only');
var reduce = require('promise-reduce');
var util = require('util');

module.exports = Ottomaton;

function Ottomaton() {
  if (!(this instanceof Ottomaton)) return new Ottomaton();

  this.actions = [];
}

function OttomatonLineError(lines) {
  Error.call(this);

  this.lines = Array.isArray(lines) ? lines : [lines];

  this.message = 'Line Errors:\n' + lines.join('\n');
}

util.inherits(OttomatonLineError, Error);

Ottomaton.prototype = {
  register: function(matcher, handler) {
    var self = this;

    if (!handler) {
      if (Array.isArray(matcher)) {
        matcher.forEach(this.register.bind(this));
        return this;
      } else if (typeof matcher === 'object') {
        if (matcher.handler && matcher.matcher) {
          handler = matcher.handler;
          matcher = matcher.matcher;
        } else {
          Object.keys(matcher).forEach(function(m) {
            self.register(m, matcher[m]);
          });
          return this;
        }
      } else {
        throw new Error('invalid arguments');
      }
    }

    var m = normalizeMatcher(matcher);
    if (m) {
      this.actions.push({
        matcher: m,
        handler: handler 
      });
    } else {
      throw new Error('invalid matcher type given: ' + typeof matcher);
    } 

    return this;
  },

  run: function(lines, state) {
    state = state || {};

    var actions = this.actions;

    if (typeof lines === 'string') {
      lines = lines.split(/[\r\n]+/g);
    }

    var unrecognizedLines = lines.map(function(line, index) {
      var actionMatches = actions.filter(function(action) {
        return !!action.matcher(line);
      });

      return actionMatches.length ? null : 'Unrecognized Line: #' + (index + 1) + ': ' + line;
    }).filter(Boolean);

    if (unrecognizedLines.length) {
      return Promise.reject(new OttomatonLineError(unrecognizedLines));
    }


    return Promise.resolve(lines).then(reduce(function(state, line) {
      return performLine(state, actions, line);
    }, state));
  },

  _findMatches: function(line) {
    return this.actions.filter(function(action) {
      return action.matcher(line);
    });
  }
};

function performLine(state, actions, line) {
  var recognized;
  var newLine;

  return Promise.resolve(actions).then(reduce(function(state, action) {
    if (newLine) return state; // skip execution

    var args = action.matcher(line);
    if (args) {
      recognized = true;
      return Promise.resolve(action.handler.apply(state, args)).then(function(result) {
        if (typeof result === 'string') {
          newLine = result;
        }
        return state;
      });
    }

    return state;
  }, state)).then(function(state) {
    if (!recognized) throw new OttomatonLineError('Unrecognized Line: ' + line);

    if (newLine) return performLine(state, actions, newLine);

    return state;
  });
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
