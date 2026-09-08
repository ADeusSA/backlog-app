import { app, BrowserWindow } from 'electron'
import { resolvePaths } from './paths'
import { registerImageScheme, handleImageProtocol } from './protocol'
import { applySecurity } from './security'
import { createWindow, getMainWindow } from './window'
import { closeDb, getDb, openDb } from './db/connection'
import { registerAllIpc } from './ipc'
import { initLog, log } from './log'
import { flushBeforeQuit, isQuitFlushDone } from './sync/scheduler'

// Пути и схема протокола должны быть готовы до app.whenReady() (01 §8).
resolvePaths()
registerImageScheme()
initLog()

app.setAppUserModelId('dev.barmin.backlog')

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    const win = getMainWindow()
    if (win) {
      if (win.isMinimized()) win.restore()
      win.focus()
    }
  })

  app.whenReady().then(() => {
    applySecurity()
    handleImageProtocol()

    try {
      openDb()
    } catch (err) {
      log.error('[app] не удалось открыть базу', err)
    }

    registerAllIpc()

    // Dev-флаг для ручной проверки и скриншотов: `npx electron . --seed-demo`
    // наполняет пустую базу демо-контентом (ТЗ 05 §8, тот же набор, что в мастере).
    if (!app.isPackaged && process.argv.includes('--seed-demo')) {
      void import('./db/seed/demo')
        .then(({ seedDemoData }) => {
          const empty = (getDb().prepare('SELECT COUNT(*) AS c FROM games').get() as { c: number }).c === 0
          if (empty) log.info('[app] демо-данные:', seedDemoData())
        })
        .catch((err) => log.error('[app] не удалось наполнить демо-данные', err))
    }

    createWindow()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  app.on('window-all-closed', () => {
    app.quit()
  })

  // Перед закрытием базы ждём (≤ 30 с) завершения отложенной выгрузки в облако (03 §7; 05 §1) —
  // иначе push мог бы упасть на закрытом соединении. flushBeforeQuit() идемпотентна.
  app.on('before-quit', (event) => {
    if (isQuitFlushDone()) {
      closeDb()
      return
    }
    event.preventDefault()
    void flushBeforeQuit().finally(() => {
      closeDb()
      app.quit()
    })
  })
}

process.on('uncaughtException', (err) => log.error('[main] uncaught', err))
process.on('unhandledRejection', (err) => log.error('[main] unhandled rejection', err))
