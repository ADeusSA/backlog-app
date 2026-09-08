import { app, dialog } from 'electron'
import { handle } from './register'
import { AppError } from '@shared/errors'
import { getMainWindow } from '../window'
import { createBackup, deleteBackup, ensureDailyBackup, listBackups, restoreBackup } from '../backup/backups.service'
import { exportData, importData } from '../backup/export-import.service'
import { wipeAllData } from '../backup/wipe.service'

/** Каналы `backups.*`, `exportImport.*`, `data.wipe` (06 §8, 10 §4 A11/A12; 01 §5). */

function dateStamp(date = new Date()): string {
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`
}

export function registerBackupsIpc(): void {
  // Раз в день, если ещё не было автобэкапа сегодня (02 §7, 06 §8).
  ensureDailyBackup()

  handle('backups.list', () => listBackups())

  handle('backups.create', () => createBackup('manual'))

  handle('backups.restore', ({ fileName }) => {
    restoreBackup(fileName)
    return { ok: true as const }
  })

  handle('backups.delete', ({ fileName }) => {
    deleteBackup(fileName)
    return { ok: true as const }
  })

  handle('exportImport.export', async () => {
    const win = getMainWindow()
    const options = {
      defaultPath: `Backlog-export-${dateStamp()}.zip`,
      filters: [{ name: 'Архив Backlog', extensions: ['zip'] }]
    }
    const result = win ? await dialog.showSaveDialog(win, options) : await dialog.showSaveDialog(options)
    if (result.canceled || !result.filePath) return null
    return exportData(result.filePath)
  })

  handle('exportImport.import', async () => {
    const win = getMainWindow()
    const options: Electron.OpenDialogOptions = {
      properties: ['openFile'],
      filters: [{ name: 'Архив Backlog', extensions: ['zip'] }]
    }
    const result = win ? await dialog.showOpenDialog(win, options) : await dialog.showOpenDialog(options)
    const filePath = result.canceled ? undefined : result.filePaths[0]
    if (!filePath) return { imported: false }
    return importData(filePath)
  })

  handle('data.wipe', ({ confirm }) => {
    if (confirm !== 'УДАЛИТЬ') {
      throw new AppError('validation', 'Неверное слово подтверждения')
    }
    wipeAllData()
    // Данных больше нет — перезапускаем на чистое состояние (аналог `app.relaunch` из app.ipc.ts).
    app.relaunch()
    app.exit(0)
    return { ok: true as const }
  })
}
