const winston = require('winston')
const util = require('util')

const isProd = require('./is-prod')

// LOOT_LOGGER_DEBUG=1 writes detailed event logs to debug-logs.txt.
function isDebug() {
  return process.env.LOOT_LOGGER_DEBUG === '1'
}

const { combine, timestamp, printf, errors } = winston.format

const logger = winston.createLogger({
  format: combine(
    timestamp(),
    errors({ stack: true }),
    printf((params) => {
      const { timestamp, level, message } = params
      const extra = params[Symbol.for('splat')]

      if (extra) {
        return `${timestamp} [${level}]: ${
          typeof message === 'string' ? message : util.format(message)
        } ${util.format(extra)}`
      }

      return `${timestamp} [${level}]: ${
        typeof message === 'string' ? message : util.format(message)
      }`
    })
  ),
  transports: [
    new winston.transports.File({
      level: isDebug() ? 'debug' : isProd() ? 'error' : 'debug',
      maxFiles: 2,
      maxsize: 1024 * 1024 * 5, // 10mb
      tailable: true,
      filename: 'debug-logs.txt',
      zippedArchive: true,
      handleExceptions: true,
      handleRejections: true
    }),
    new winston.transports.Console({
      level: isDebug() ? 'debug' : isProd() ? 'error' : 'silly',
      handleExceptions: true,
      handleRejections: true
    })
  ]
})

module.exports = logger
