var Promise = require('any-promise')
var keypress = require('keypress')

var Action = require('../action')

module.exports = Action(/^WAIT FOR KEYSTROKE\s*(.*)$/, function () {
  return new Promise(function (resolve) {
    console.log('Press any key...')
    keypress(process.stdin)

    process.stdin.once('keypress', function (chunk, key) {
      if (key.name === 'escape') {
        return resolve(Action.FINISH)
      }

      resolve()
    })

    process.stdin.setRawMode(true)
    process.stdin.resume()
  })
})
