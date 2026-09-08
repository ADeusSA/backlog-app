import log from 'electron-log/main'
import path from 'node:path'
import { paths } from './paths'

/** Логирование в `<dataDir>/logs/app.log`, ротация 5 × 2 МБ (01 §12). */
export function initLog(): void {
  log.transports.file.resolvePathFn = () => path.join(paths().logsDir, 'app.log')
  log.transports.file.maxSize = 2 * 1024 * 1024
  log.transports.file.level = process.env.NODE_ENV === 'development' ? 'debug' : 'info'
  log.transports.console.level = process.env.NODE_ENV === 'development' ? 'debug' : 'warn'
  log.errorHandler.startCatching({ showDialog: false })
}

export { log }
