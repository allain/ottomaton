var Promise = require('any-promise')
var Action = require('../action')

module.exports = Action(/^SLEEP (\d+)\s*(ms|s|m)$/i, function (duration, units) {
  var factors = {
    'ms': 1,
    's': 1000,
    'm': 1000 * 60
  }

  return new Promise(function (resolve) {
    setTimeout(function () {
      resolve(Action.DONE)
    }, parseInt(duration, 10) * factors[ units ])
  })
})
