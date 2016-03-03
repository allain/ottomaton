var Promise = require('any-promise')
var reduce = require('promise-reduce')

module.exports = function eachSeries (items, fn) {
  return Promise.resolve(items)
    .then(reduce((keepGoing, item) => {
      return keepGoing && Promise.resolve(fn(item)).then(goOn => {
        return goOn !== false
      })
    }, true))
}
