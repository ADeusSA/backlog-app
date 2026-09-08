import { app, dialog } from 'electron'
import { handle } from './register'
import { getSettings, patchSettings } from '../services/settings.service'
import { moveDataDir } from '../services/data-dir.service'
import { applyTraySettings } from '../tray'
import { getMainWindow, setTitleBarTheme } from '../window'

export function registerSettingsIpc(): void {
  handle('settings.get', () => getSettings())

  handle('settings.patch', (patch) => {
    const next = patchSettings(patch)
    if (patch.tray || patch.locale) applyTraySettings()
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

  handle('settings.moveDataDir', ({ dir }) => {
    moveDataDir(dir)
    // Пути вычисляются до app.whenReady() и уже указывают на старую папку — только перезапуск.
    app.relaunch()
    app.exit(0)
    return { ok: true as const }
  })
}
