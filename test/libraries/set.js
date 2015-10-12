var Action = require('../..').Action;

module.exports = [
  Action(/^(.*) = (.*)$/, function(varName, value) {
    this[varName] = value;
  }, {deref: false})
];
