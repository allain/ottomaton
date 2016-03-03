var Action = require('../..').Action

module.exports = [
  Action('Print "PARAM"', function (paramName) {
    console.log(this[paramName])
  })
]
