var Promise = require('native-promise-only');
var reduce = require('promise-reduce');
var flatten = require('fj-flatten');
var defaults = require('defaults');

module.exports = Ottomaton;

var Action = Ottomaton.Action = require('./lib/action');
var LineError = Ottomaton.LineError = require('./lib/line-error');

function Ottomaton(opts) {
  if (!(this instanceof Ottomaton)) return new Ottomaton(opts);

  this.opts = defaults(opts, {common: true});

  this.registrations = [];
}

Ottomaton.prototype = {
  // Queue up actions or Promises which resolve to actions or array of actions for later registration
  register: function(matcher, handler) {
    if (handler) {
      this.registrations.push(new Action(matcher, handler));
    } else if (matcher && typeof matcher.then === 'function') {
      this.registrations.push(matcher);
    } else if (typeof matcher === 'function') {
      this.registrations.push(matcher(this));
    } else if (matcher instanceof Action) {
      this.registrations.push(matcher);
    } else if (Array.isArray(matcher)) {
      matcher.forEach(this.register.bind(this));
    } else if (typeof matcher === 'object') {
      if (matcher.handler && matcher.matcher) {
        this.registrations.push(new Action(matcher.matcher, matcher.handler));
      } else {
        Object.keys(matcher).forEach(function(m) {
          this.register(m, matcher[m]);
        }.bind(this));
      }
    } else {
      throw new Error('invalid arguments');
    }

    return this;
  },

  run: function(lines, state) {
    state = state || {};

    if (this.opts.common) {
      this.registrations.unshift([
        // Skip blank lines
        Action(/^\s*$/, function() {
          return 'DONE';
        }),

        // Ignore commented lines
        Action(/^\s*(#|REM )/i, function() {
          return 'DONE';
        }),
      ]);
    }


    return Promise.all(this.registrations).then(flatten).then(function(actions) {
      if (typeof lines === 'string') {
        lines = lines.split(/[\r\n]+/g);
      }

      var unrecognizedLines = lines.map(function (line, index) {
        if (line === 'FINISH') return false;

        if (any(actions, function(action) {
          return action.matcher(line);
        })) {
          return false;
        } else {
          return 'Unrecognized Line: #' + (index + 1) + ': ' + line;
        }
      }).filter(Boolean);

      if (unrecognizedLines.length) {
        throw new LineError(unrecognizedLines);
      }

      if (!lines || !any(lines, function(line) {
        return /^FINISH$/i.test(line);
      })) {
        lines.push('FINISH');
      }

      return Promise.resolve(lines).then(reduce(function (state, line) {
        return performLine(actions, line);
      }, state));

      function performLine(actions, line) {
        var recognized;
        var newLine;

        return Promise.resolve(actions).then(reduce(function (state, action) {
          if (newLine) return state; // skip execution

          var args = action.matcher(line);
          if (args) {
            recognized = true;
            return Promise.resolve(action.handler.apply(state, args)).then(function (result) {
              if (typeof result === 'string') {
                newLine = result;
              }
              return state;
            });
          }

          return state;
        }, state)).then(function (state) {
          if (!line.match(/^FINISH|DONE$/i) && !recognized) {
            throw new LineError('Unrecognized Line: ' + line);
          }

          if (newLine && !newLine.match(/^FINISH|DONE$/)) return performLine(actions, newLine);

          return state;
        });
      }
    });
  }
};

function any(array, predicate) {
  for (var i=0; i < array.length; i++) {
    if (predicate(array[i])) return true;
  }
  return false;
}

