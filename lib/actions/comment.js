var Action = require('../action')

module.exports = Action(/^\s*(#|REM )/i, Action.DONE)
