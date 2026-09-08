import { dialog } from 'electron'
import { handle } from './register'
import { getSettings, patchSettings } from '../services/settings.service'
import { getMainWindow, setTitleBarTheme } from '../window'
import { AppError } from '@shared/errors'

export function registerSettingsIpc(): void {
  handle('settings.get', () => getSettings())

  handle('settings.patch', (patch) => {
    const next = patchSettings(patch)
    if (patch.theme) {
      setTitleBarTheme(next.theme === 'light' ? '#F3F4F8' : '#0B0D14', next.theme === 'light' ? '#4B5163' : '#9AA3B8')
    }
    return next
  })

  handle('settings.chooseDataDir', async () => {
    const win = getMainWindow()
    const result = win
      ? await dialog.showOpenDialog(win, { properties: ['openDirectory', 'createDirectory'] })
      : await dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'] })
    return { dir: result.canceled ? null : (result.filePaths[0] ?? null) }
  })

  handle('settings.moveDataDir', () => {
    // Перенос папки данных выполняется вместе с блоком синхронизации/бэкапов (06 §8).
    throw new AppError('not_implemented', 'Перенос папки данных появится в следующей сборке')
  })
}
