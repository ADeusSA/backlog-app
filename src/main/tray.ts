import { app, Menu, nativeImage, Tray, type BrowserWindow } from 'electron'
import path from 'node:path'
import { getSettings } from './services/settings.service'
import { getSyncEngine } from './sync/engine'
import { log } from './log'

/**
 * Значок в области уведомлений и запуск свёрнутым (06 §8, итерация 2).
 *
 * Подписи меню лежат здесь, а не в словарях renderer: контекстное меню строит
 * Electron в main-процессе, где i18next недоступен. Две локали, четыре строки —
 * дублирование дешевле, чем прокидывать словарь через IPC (см. ADR 0009).
 */

const LABELS = {
  ru: { open: 'Открыть Backlog', sync: 'Синхронизировать сейчас', quit: 'Выход' },
  en: { open: 'Open Backlog', sync: 'Sync now', quit: 'Quit' }
} as const

let tray: Tray | null = null
/** Отличает настоящий выход от закрытия окна в трей. */
let quitting = false
/** Окно приходит извне, чтобы `window.ts` и `tray.ts` не импортировали друг друга. */
let resolveWindow: () => BrowserWindow | null = () => null

export function initTray(getWindow: () => BrowserWindow | null): void {
  resolveWindow = getWindow
  applyTraySettings()
}

export function isQuitting(): boolean {
  return quitting
}

export function setQuitting(value: boolean): void {
  quitting = value
}

function iconPath(): string {
  // В сборке иконка кладётся в resources/ рядом с app.asar (electron-builder → extraResources).
  return app.isPackaged
    ? path.join(process.resourcesPath, 'icon.png')
    : path.join(app.getAppPath(), 'resources', 'icon.png')
}

export function showMainWindow(): void {
  const win = resolveWindow()
  if (!win) return
  if (!win.isVisible()) win.show()
  if (win.isMinimized()) win.restore()
  win.focus()
}

function buildMenu(): Menu {
  const labels = LABELS[getSettings().locale] ?? LABELS.ru
  return Menu.buildFromTemplate([
    { label: labels.open, click: showMainWindow },
    {
      label: labels.sync,
      // Тот же путь, что у канала `sync.now`: pull, который сам выгружает локальные
      // изменения либо сообщает о конфликте (03 §5.1).
      click: () => {
        void getSyncEngine()
          .runPull()
          .catch((err: unknown) => log.warn('[tray] синхронизация не запустилась', err))
      }
    },
    { type: 'separator' },
    {
      label: labels.quit,
      click: () => {
        quitting = true
        app.quit()
      }
    }
  ])
}

function createTray(): void {
  if (tray) return
  const image = nativeImage.createFromPath(iconPath())
  if (image.isEmpty()) {
    log.warn('[tray] иконка не найдена:', iconPath())
    return
  }
  tray = new Tray(image.resize({ width: 16, height: 16 }))
  tray.setToolTip('Backlog')
  tray.on('click', showMainWindow)
  tray.on('double-click', showMainWindow)
  tray.setContextMenu(buildMenu())
}

function destroyTray(): void {
  tray?.destroy()
  tray = null
}

/**
 * Приводит значок в соответствие настройкам. Вызывается при старте и после
 * каждого изменения настроек: выключенный трей не должен оставлять иконку висеть.
 */
export function applyTraySettings(): void {
  const { tray: settings } = getSettings()
  if (settings.enabled) {
    createTray()
    tray?.setContextMenu(buildMenu())
  } else {
    destroyTray()
    // Без значка спрятанное окно уже не вернуть — показываем сразу.
    const win = resolveWindow()
    if (win && !win.isVisible()) showMainWindow()
  }
}

/** Прятать ли окно вместо закрытия (крестик и Alt+F4). */
export function shouldHideOnClose(): boolean {
  const { tray: settings } = getSettings()
  return !quitting && settings.enabled && settings.minimizeOnClose && tray !== null
}

/** Показывать ли окно при старте — 06 §8, «Запускать свёрнутым в трей». */
export function shouldStartHidden(): boolean {
  const { tray: settings } = getSettings()
  return settings.enabled && settings.startMinimized
}
