var Action = require('../action')

module.exports = Action(/^(.*) = (.*)$/, function (varName, value) {
  this[ varName ] = this.deref(value)
}, { deref: false })
