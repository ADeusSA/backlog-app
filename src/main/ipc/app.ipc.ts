import { app, shell } from 'electron'
import { handle } from './register'
import { paths } from '../paths'
import { openExternal } from '../security'
import { getDb, hasFts5 } from '../db/connection'
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

  handle('app.relaunch', () => {
    app.relaunch()
    app.exit(0)
    return { ok: true as const }
  })
}
