var Promise = require('native-promise-only');
var reduce = require('promise-reduce');
var defaults = require('defaults');

module.exports = Ottomaton;

function Ottomaton(opts) {
  if (!(this instanceof Ottomaton)) return new Ottomaton(opts);

  opts = defaults(opts, {
    actions: []
  });

  this.actions = [];

  opts.actions.forEach(this.register.bind(this));
}

Ottomaton.prototype = {
  register: function(matcher, handler) {
    var self = this;

    if (!handler) {
      if (typeof matcher === 'object') {
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
    var actions = this.actions;
    return Promise.resolve(lines).then(reduce(function(state, line) {
      return performLine(state, actions, line);
    }, state || {}));
  },

  _findMatches: function(line) {
    return this.actions.filter(function(action) {
      return action.matcher(line);
    });
  }
};

function performLine(state, actions, line) {
  var recognized = false;

  return Promise.resolve(actions).then(reduce(function(state, action) {
    var args = action.matcher(line);
    if (args) {
      recognized = true;
      return Promise.resolve(action.handler.apply(state, args)).then(function() {
        return state;
      });
    }

    return state;
  }, state)).then(function(result) {
    if (!recognized) throw new Error('Unrecognized line: ' + line);

    return result;
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
