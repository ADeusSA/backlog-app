import { net, protocol } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { paths } from './paths'

/** Схема должна быть объявлена до `app.whenReady()` (01 §7). */
export function registerImageScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: 'backlog-img',
      privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, bypassCSP: false }
    }
  ])
}

/**
 * `backlog-img://<file>` → файл строго внутри data/images.
 * Имя файла может быть как `ab/abc….webp`, так и `abc….webp` (тогда подпапка вычисляется).
 */
export function handleImageProtocol(): void {
  protocol.handle('backlog-img', async (request) => {
    try {
      const url = new URL(request.url)
      // Имя файла целиком лежит в пути: backlog-img://img/<ab>/<uuid>.webp.
      // Хост не используется: числовой хост (подпапка «01») Chromium приводил к IPv4.
      const rel = decodeURIComponent(url.pathname).replace(/^\/+/, '')
      const imagesDir = paths().imagesDir
      const resolved = path.resolve(imagesDir, rel)
      if (!resolved.startsWith(path.resolve(imagesDir))) {
        return new Response('Forbidden', { status: 403 })
      }
      if (!fs.existsSync(resolved)) return new Response('Not found', { status: 404 })
      const response = await net.fetch(pathToFileURL(resolved).toString())
      const headers = new Headers(response.headers)
      headers.set('Cache-Control', 'public, max-age=31536000, immutable')
      return new Response(response.body, { status: 200, headers })
    } catch {
      return new Response('Bad request', { status: 400 })
    }
  })
}
