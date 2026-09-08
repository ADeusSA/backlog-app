/**
 * Хранилище изображений (02 §3.3, §7; 06 §7.7): sha256-дедупликация, файлы в
 * `<dataDir>/images/<2 первых символа id>/<id>.<ext>`. Ресайз/конвертация в WebP —
 * на стороне renderer (Canvas/OffscreenCanvas); main получает уже готовые байты.
 */
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import type { getDb} from '../db/connection';
import { write } from '../db/connection'
import { newId, now } from '../db/utils'
import { imagePath, paths } from '../paths'
import { AppError } from '@shared/errors'
import { type ImageDto, imageDtoSchema } from '@shared/schema/entities'
import type { ImageKind } from '@shared/constants'

const MIME_EXT: Record<string, string> = {
  'image/webp': 'webp',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/gif': 'gif',
  'image/bmp': 'bmp'
}

const MAX_FETCH_BYTES = 25 * 1024 * 1024

interface ImageRow {
  id: string
  kind: string
  file_name: string
  mime: string
  width: number
  height: number
  size_bytes: number
  dominant_color: string | null
  created_at: string
}

function mapImageRow(row: ImageRow): ImageDto {
  return imageDtoSchema.parse({
    id: row.id,
    kind: row.kind as ImageKind,
    fileName: row.file_name,
    mime: row.mime,
    width: row.width,
    height: row.height,
    sizeBytes: row.size_bytes,
    dominantColor: row.dominant_color,
    createdAt: row.created_at
  })
}

export interface SaveImageInput {
  bytes: Uint8Array
  kind: ImageKind
  mime: string
  width: number
  height: number
  dominantColor?: string | null
  sourceUrl?: string | null
}

export function saveImage(input: SaveImageInput): ImageDto {
  const sha256 = crypto.createHash('sha256').update(input.bytes).digest('hex')

  return write(['images'], (conn) => {
    const existing = conn.prepare('SELECT * FROM images WHERE sha256 = ?').get(sha256) as ImageRow | undefined
    if (existing) return mapImageRow(existing)

    const ext = MIME_EXT[input.mime.toLowerCase()] ?? 'bin'
    const id = newId()
    const fileName = `${id.slice(0, 2)}/${id}.${ext}`
    const absolutePath = imagePath(fileName)
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true })
    fs.writeFileSync(absolutePath, input.bytes)

    const nowTs = now()
    conn
      .prepare(
        `INSERT INTO images(id, kind, file_name, mime, width, height, size_bytes, sha256, dominant_color,
                             source, source_url, attribution, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'manual', ?, NULL, ?)`
      )
      .run(id, input.kind, fileName, input.mime, input.width, input.height, input.bytes.byteLength, sha256, input.dominantColor ?? null, input.sourceUrl ?? null, nowTs)

    const row = conn.prepare('SELECT * FROM images WHERE id = ?').get(id) as ImageRow
    return mapImageRow(row)
  })
}

/** Скачивает изображение по URL (только https) — used перед `images.save` (06 §7.7). */
export async function fetchImageFromUrl(
  url: string
): Promise<{ bytes: Uint8Array<ArrayBuffer>; mime: string }> {
  const parsed = new URL(url)
  if (parsed.protocol !== 'https:') {
    throw new AppError('validation', 'Разрешены только https-ссылки на изображения')
  }
  const res = await fetch(url)
  if (!res.ok) throw new AppError('io', `Не удалось скачать изображение (HTTP ${res.status})`)
  const contentType = res.headers.get('content-type') ?? ''
  if (!contentType.toLowerCase().startsWith('image/')) {
    throw new AppError('image_unsupported', `Ссылка не ведёт на изображение (${contentType || 'unknown'})`)
  }
  const contentLength = res.headers.get('content-length')
  if (contentLength && Number(contentLength) > MAX_FETCH_BYTES) {
    throw new AppError('image_too_large', 'Файл больше 25 МБ')
  }
  const buf = await res.arrayBuffer()
  if (buf.byteLength > MAX_FETCH_BYTES) {
    throw new AppError('image_too_large', 'Файл больше 25 МБ')
  }
  return { bytes: new Uint8Array(buf), mime: contentType.split(';')[0]?.trim() ?? 'application/octet-stream' }
}

export function deleteImage(id: string): void {
  write(['images'], (conn) => {
    const row = conn.prepare('SELECT file_name FROM images WHERE id = ?').get(id) as { file_name: string } | undefined
    if (!row) return
    // FK images(...)  ON DELETE SET NULL — ссылки в games/companies/series/lists/profile обнуляются автоматически.
    conn.prepare('DELETE FROM images WHERE id = ?').run(id)
    const abs = imagePath(row.file_name)
    if (fs.existsSync(abs)) fs.rmSync(abs)
  })
}

/** Собирает id всех изображений, на которые есть хоть одна ссылка из каталога/профиля. */
function collectReferencedImageIds(db: ReturnType<typeof getDb>): Set<string> {
  const ids = new Set<string>()
  const addColumn = (sql: string): void => {
    const rows = db.prepare(sql).all() as Array<{ image_id: string | null }>
    for (const row of rows) if (row.image_id) ids.add(row.image_id)
  }
  addColumn('SELECT cover_image_id AS image_id FROM games WHERE cover_image_id IS NOT NULL')
  addColumn('SELECT backdrop_image_id AS image_id FROM games WHERE backdrop_image_id IS NOT NULL')
  addColumn('SELECT logo_image_id AS image_id FROM games WHERE logo_image_id IS NOT NULL')
  addColumn('SELECT logo_image_id AS image_id FROM companies WHERE logo_image_id IS NOT NULL')
  addColumn('SELECT banner_image_id AS image_id FROM companies WHERE banner_image_id IS NOT NULL')
  addColumn('SELECT cover_image_id AS image_id FROM series WHERE cover_image_id IS NOT NULL')
  addColumn('SELECT banner_image_id AS image_id FROM series WHERE banner_image_id IS NOT NULL')
  addColumn('SELECT cover_image_id AS image_id FROM lists WHERE cover_image_id IS NOT NULL')
  addColumn('SELECT avatar_image_id AS image_id FROM profile WHERE avatar_image_id IS NOT NULL')
  addColumn('SELECT banner_image_id AS image_id FROM profile WHERE banner_image_id IS NOT NULL')
  return ids
}

/** Удаляет строки/файлы изображений, на которые никто не ссылается (02 §4). */
export function gcImages(): { removed: number; freedBytes: number } {
  return write(['images'], (conn) => {
    const referenced = collectReferencedImageIds(conn)
    const all = conn.prepare('SELECT id, file_name, size_bytes FROM images').all() as Array<{
      id: string
      file_name: string
      size_bytes: number
    }>
    let removed = 0
    let freedBytes = 0
    const del = conn.prepare('DELETE FROM images WHERE id = ?')
    for (const img of all) {
      if (referenced.has(img.id)) continue
      del.run(img.id)
      const abs = imagePath(img.file_name)
      if (fs.existsSync(abs)) fs.rmSync(abs)
      removed += 1
      freedBytes += img.size_bytes
    }
    return { removed, freedBytes }
  })
}

/** На случай будущей отладки — путь к папке изображений. */
export function imagesDir(): string {
  return paths().imagesDir
}
