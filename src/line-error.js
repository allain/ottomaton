var util = require('util');

module.exports = OttomatonLineError;

function OttomatonLineError(lines) {
  Error.call(this);

  this.lines = Array.isArray(lines) ? lines : [lines];

  this.message = 'Line Errors:\n' + this.lines.join('\n');
}

util.inherits(OttomatonLineError, Error);

