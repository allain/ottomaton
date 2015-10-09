import util from 'util';

class OttomatonLineError extends Error {
  constructor(lines) {
  	lines = [].concat(lines);

  	let message = `Line Errors:\n${ lines.join('\n') }`;
    super(message);

    this.lines = Array.isArray(lines) ? lines : [lines];
    this.message = message;
  }
}

export default OttomatonLineError;
