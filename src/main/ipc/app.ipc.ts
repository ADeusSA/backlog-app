import { app, dialog, shell } from 'electron'
import { writeFileSync } from 'node:fs'
import { handle } from './register'
import { paths } from '../paths'
import { openExternal } from '../security'
import { getMainWindow } from '../window'
import { getDb, hasFts5 } from '../db/connection'
import { AppError } from '@shared/errors'
import { log } from '../log'

export function registerAppIpc(): void {
  handle('app.getPaths', () => {
    const p = paths()
    return {
      dataDir: p.dataDir,
      imagesDir: p.imagesDir,
      dbPath: p.dbPath,
      backupsDir: p.backupsDir,
      logsDir: p.logsDir,
      portable: p.portable,
      version: app.getVersion()
    }
  })

  handle('app.getVersion', () => {
    const row = getDb().prepare('select sqlite_version() as v').get() as { v: string }
    return {
      app: app.getVersion(),
      electron: process.versions.electron ?? '',
      chrome: process.versions.chrome ?? '',
      node: process.versions.node ?? '',
      sqlite: row.v,
      fts5: hasFts5()
    }
  })

  handle('app.openExternal', async ({ url }) => {
    await openExternal(url)
    return { ok: true as const }
  })

  handle('app.openPath', async ({ target }) => {
    const p = paths()
    const dir =
      target === 'logs'
        ? p.logsDir
        : target === 'backups'
          ? p.backupsDir
          : target === 'images'
            ? p.imagesDir
            : p.dataDir
    await shell.openPath(dir)
    return { ok: true as const }
  })

  handle('app.log', ({ level, message, data }) => {
    log[level](`[renderer] ${message}`, data ?? '')
    return { ok: true as const }
  })

  /**
   * Снимок области окна в PNG — экспорт «итогов года» (10 §1). Область приходит
   * из `getBoundingClientRect()` карточки: capturePage работает в тех же CSS-пикселях,
   * а масштаб экрана Electron учитывает сам.
   */
  handle('app.capturePng', async ({ rect, fileName }) => {
    const win = getMainWindow()
    if (!win) throw new AppError('unknown', 'Окно недоступно')
    const image = await win.webContents.capturePage(rect)
    if (image.isEmpty()) throw new AppError('unknown', 'Не удалось снять изображение')

    const options = {
      defaultPath: fileName.replace(/[\\/:*?"<>|]/g, ' ').trim() || 'recap.png',
      filters: [{ name: 'PNG', extensions: ['png'] }]
    }
    const result = await dialog.showSaveDialog(win, options)
    if (result.canceled || !result.filePath) return null
    writeFileSync(result.filePath, image.toPNG())
    return { path: result.filePath }
  })

  handle('app.relaunch', () => {
    app.relaunch()
    app.exit(0)
    return { ok: true as const }
  })
}
