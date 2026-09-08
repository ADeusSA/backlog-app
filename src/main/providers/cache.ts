/**
 * Файловый кеш ответов провайдеров на 24 часа (08 §4): повторный поиск того же
 * названия и повторное открытие карточки не тратят лимит.
 *
 * Лежит в `<dataDir>/providers/cache`, а не в `sync/`, потому что это чисто локальные
 * временные данные: их незачем класть в бэкапы и гонять на Google Диск.
 */
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { providersDir } from '../paths'
import { log } from '../log'

const TTL_MS = 24 * 60 * 60 * 1000

interface Entry<T> {
  at: number
  value: T
}

function cacheDir(): string {
  const dir = path.join(providersDir(), 'cache')
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

function fileFor(key: string): string {
  return path.join(cacheDir(), `${crypto.createHash('sha1').update(key).digest('hex')}.json`)
}

export function readCache<T>(key: string, now = Date.now()): T | null {
  try {
    const file = fileFor(key)
    if (!fs.existsSync(file)) return null
    const entry = JSON.parse(fs.readFileSync(file, 'utf8')) as Entry<T>
    if (now - entry.at > TTL_MS) {
      fs.rmSync(file, { force: true })
      return null
    }
    return entry.value
  } catch (err) {
    log.warn('[providers] не удалось прочитать кеш', err)
    return null
  }
}

export function writeCache<T>(key: string, value: T, now = Date.now()): void {
  try {
    fs.writeFileSync(fileFor(key), JSON.stringify({ at: now, value } satisfies Entry<T>), 'utf8')
  } catch (err) {
    log.warn('[providers] не удалось записать кеш', err)
  }
}

/** Запрос с кешированием: `loader` вызывается только при промахе. */
export async function cached<T>(key: string, loader: () => Promise<T>): Promise<T> {
  const hit = readCache<T>(key)
  if (hit !== null) return hit
  const value = await loader()
  writeCache(key, value)
  return value
}

export function clearCache(): number {
  try {
    const dir = cacheDir()
    const files = fs.readdirSync(dir).filter((name) => name.endsWith('.json'))
    for (const name of files) fs.rmSync(path.join(dir, name), { force: true })
    return files.length
  } catch (err) {
    log.warn('[providers] не удалось очистить кеш', err)
    return 0
  }
}
