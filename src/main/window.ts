import { app, BrowserWindow, nativeTheme, screen, shell } from 'electron'
import path from 'node:path'
import { writeFileSync } from 'node:fs'
import { getSettings, patchSettings } from './services/settings.service'
import { hardenWindow } from './security'
import { shouldHideOnClose, shouldStartHidden } from './tray'
import { log } from './log'

/** Цвета заголовка окна для обеих тем (04 §2.1, §8) — дублируют --bg-0 и --text-2. */
const TITLEBAR = {
  dark: { color: '#0B0D14', symbolColor: '#9AA3B8' },
  light: { color: '#F3F4F8', symbolColor: '#545B6D' }
} as const

let mainWindow: BrowserWindow | null = null

/** Тема окна: «системная» разворачивается средствами Electron. */
function windowTheme(): 'dark' | 'light' {
  const setting = getSettings().theme
  if (setting !== 'system') return setting
  return nativeTheme.shouldUseDarkColors ? 'dark' : 'light'
}

function boundsAreVisible(x: number, y: number, width: number, height: number): boolean {
  const display = screen.getDisplayMatching({ x, y, width, height })
  const wa = display.workArea
  return x + width > wa.x && y + height > wa.y && x < wa.x + wa.width && y < wa.y + wa.height
}

export function createWindow(): BrowserWindow {
  const settings = getSettings()
  // До создания окна: renderer должен увидеть правильный prefers-color-scheme с первого кадра.
  nativeTheme.themeSource = settings.theme
  const { width, height, x, y, maximized } = settings.window
  const useSavedPos = x != null && y != null && boundsAreVisible(x, y, width, height)

  const win = new BrowserWindow({
    width,
    height,
    ...(useSavedPos ? { x, y } : {}),
    minWidth: 1024,
    minHeight: 680,
    show: false,
    backgroundColor: TITLEBAR[windowTheme()].color,
    autoHideMenuBar: true,
    titleBarStyle: 'hidden',
    titleBarOverlay: { ...TITLEBAR[windowTheme()], height: 44 },
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
      spellcheck: false
    }
  })

  hardenWindow(win)
  if (maximized) win.maximize()

  // В dev-сборке сообщения консоли renderer попадают в data/logs/app.log —
  // иначе ошибки видны только в открытых DevTools (01 §12).
  if (!app.isPackaged) {
    win.webContents.on('console-message', (details) => {
      const line = `[renderer] ${details.message} (${details.lineNumber})`
      if (details.level === 'error') log.error(line)
      else if (details.level === 'warning') log.warn(line)
      else log.info(line)
    })
  }

  // «Запускать свёрнутым в трей» (06 §8): окно создаётся, но не показывается.
  win.on('ready-to-show', () => {
    if (!shouldStartHidden()) win.show()
  })

  // Dev-хук для проверки вида без ручного скриншота: `npx electron . --capture=out.png[:задержка_мс]`.
  const captureArg = process.argv.find((arg) => arg.startsWith('--capture='))
  if (!app.isPackaged && captureArg) {
    const file = captureArg.slice('--capture='.length)
    win.webContents.once('did-finish-load', () => {
      setTimeout(() => {
        void win.webContents
          .capturePage()
          .then((image) => {
            writeFileSync(file, image.toPNG())
            log.info('[window] снимок страницы записан:', file)
          })
          .catch((err) => log.error('[window] снимок не удался', err))
      }, 9000)
    })
  }

  const saveBounds = (): void => {
    if (win.isDestroyed()) return
    const isMax = win.isMaximized()
    const b = isMax ? win.getNormalBounds() : win.getBounds()
    patchSettings({
      window: { width: b.width, height: b.height, x: b.x, y: b.y, maximized: isMax }
    })
  }
  let saveTimer: NodeJS.Timeout | null = null
  const scheduleSave = (): void => {
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(saveBounds, 400)
  }
  win.on('resize', scheduleSave)
  win.on('move', scheduleSave)
  win.on('maximize', scheduleSave)
  win.on('unmaximize', scheduleSave)
  win.on('close', (event) => {
    saveBounds()
    // С включённым треем крестик прячет окно, а не завершает приложение (06 §8).
    if (shouldHideOnClose()) {
      event.preventDefault()
      win.hide()
    }
  })

  win.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })

  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    void win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    void win.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  mainWindow = win
  win.on('closed', () => {
    mainWindow = null
  })
  return win
}

export function getMainWindow(): BrowserWindow | null {
  return mainWindow
}

/**
 * Перекрасить окно под текущую тему (05 §1, 04 §8): системные кнопки заголовка и
 * фон окна, который виден в момент показа и при ресайзе.
 */
export function applyWindowTheme(): void {
  const setting = getSettings().theme
  // themeSource синхронизирует prefers-color-scheme в renderer с явным выбором пользователя.
  // Присваивание только при отличии: иначе Electron заново шлёт 'updated' и мы зациклимся.
  if (nativeTheme.themeSource !== setting) nativeTheme.themeSource = setting
  const theme = TITLEBAR[windowTheme()]
  mainWindow?.setTitleBarOverlay?.({ ...theme, height: 44 })
  mainWindow?.setBackgroundColor(theme.color)
}
