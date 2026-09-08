/** Заглушка electron-log для юнит-тестов. */
const noop = (): void => undefined

const log = {
  debug: noop,
  info: noop,
  warn: noop,
  error: noop,
  transports: {
    file: { resolvePathFn: noop, maxSize: 0, level: 'info' },
    console: { level: 'warn' }
  },
  errorHandler: { startCatching: noop }
}

export default log
