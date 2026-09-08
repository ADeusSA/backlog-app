import { app, session, shell, type BrowserWindow } from 'electron'
import { AppError } from '@shared/errors'
import { log } from './log'

const isDev = !app.isPackaged

/**
 * CSP (01 §8). В dev нужен доступ к vite-серверу и HMR-сокету,
 * в prod — только собственные файлы и картинки через backlog-img://.
 */
function cspHeader(): string {
  const connect = isDev ? "connect-src 'self' ws: http://localhost:*" : "connect-src 'none'"
  const script = isDev ? "script-src 'self' 'unsafe-inline' http://localhost:*" : "script-src 'self'"
  return [
    "default-src 'self'",
    script,
    "style-src 'self' 'unsafe-inline'",
    'img-src \'self\' backlog-img: blob: data:',
    "font-src 'self' data:",
    connect,
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'"
  ].join('; ')
}

const EXTERNAL_ALLOW_HOSTS = [
  'metacritic.com',
  'opencritic.com',
  'howlongtobeat.com',
  'igdb.com',
  'store.steampowered.com',
  'steamcommunity.com',
  'accounts.google.com',
  'myaccount.google.com',
  'drive.google.com',
  'wikipedia.org',
  'github.com'
]

/** Разрешено ли открыть ссылку в системном браузере (01 §8). */
export function isAllowedExternal(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl)
    if (url.protocol !== 'https:') return false
    const host = url.hostname.toLowerCase()
    return EXTERNAL_ALLOW_HOSTS.some((allowed) => host === allowed || host.endsWith(`.${allowed}`))
  } catch {
    return false
  }
}

export async function openExternal(rawUrl: string): Promise<void> {
  if (!isAllowedExternal(rawUrl)) {
    // Пользовательские ссылки (сайт игры/студии) — тоже https, но домен произвольный:
    // разрешаем любой https, запрещая всё остальное. Схемы file:, javascript: и т.п. отсекаются.
    try {
      const url = new URL(rawUrl)
      if (url.protocol !== 'https:' && url.protocol !== 'http:') {
        throw new AppError('validation', 'Недопустимая схема ссылки')
      }
    } catch {
      throw new AppError('validation', 'Недопустимая ссылка')
    }
  }
  await shell.openExternal(rawUrl)
}

export function applySecurity(): void {
  const ses = session.defaultSession

  ses.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [cspHeader()]
      }
    })
  })

  // Никаких разрешений, кроме чтения буфера обмена (вставка обложки Ctrl+V).
  ses.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(permission === 'clipboard-read' || permission === 'clipboard-sanitized-write')
  })
  ses.setPermissionCheckHandler((_wc, permission) => permission === 'clipboard-read')
}

export function hardenWindow(win: BrowserWindow): void {
  win.webContents.setWindowOpenHandler(({ url }) => {
    void openExternal(url).catch((err) => log.warn('[security] openExternal', err))
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (event, url) => {
    const isDevServer = isDev && url.startsWith('http://localhost')
    if (!url.startsWith('file://') && !isDevServer) {
      event.preventDefault()
      void openExternal(url).catch(() => undefined)
    }
  })
  win.webContents.on('will-attach-webview', (event) => event.preventDefault())
}
