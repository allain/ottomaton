var Promise = require('native-promise-only');
var reduce = require('promise-reduce');

module.exports = Ottomaton;

var Action = Ottomaton.Action = require('./lib/action');
var LineError = Ottomaton.LineError = require('./lib/line-error');

function Ottomaton() {
  if (!(this instanceof Ottomaton)) return new Ottomaton();

  this.actions = [];
}

Ottomaton.prototype = {
  register: function(matcher, handler) {
    var self = this;

    var action;

    if (handler) {
      action = new Action(matcher, handler);
    } else if (matcher instanceof Action) {
      action = matcher; 
    } else if (Array.isArray(matcher)) {
      matcher.forEach(this.register.bind(this));
    } else if (typeof matcher === 'object') {
      if (matcher.handler && matcher.matcher) {
        action = new Action(matcher.matcher, matcher.handler);
      } else {
        Object.keys(matcher).forEach(function(m) {
          self.register(m, matcher[m]);
        });
      }
    } else {
      throw new Error('invalid arguments');
    }

    if (action) {
      this.actions.push(action);
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
      return Promise.reject(new LineError(unrecognizedLines));
    }


    return Promise.resolve(lines).then(reduce(function(state, line) {
      return performLine(actions, line);
    }, state));

    function performLine(actions, line) {
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
        if (!recognized) throw new LineError('Unrecognized Line: ' + line);

        if (newLine) return performLine(actions, newLine);

        return state;
      });
    }
  },

  _findMatches: function(line) {
    return this.actions.filter(function(action) {
      return action.matcher(line);
    });
  }
};

