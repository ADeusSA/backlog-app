import fs from 'node:fs'
import path from 'node:path'
import { safeStorage } from 'electron'
import { AppError } from '@shared/errors'
import { log } from '../log'
import { paths } from '../paths'

/**
 * Хранение токенов Google (03 §2, §7; 01 §10).
 * - `refresh_token` шифруется `safeStorage.encryptString` (Windows DPAPI) и пишется в
 *   `data/sync/token.bin`. Расшифровать может только этот пользователь Windows на этом ПК —
 *   при переносе папки на другой ПК потребуется повторный вход (ожидаемое поведение).
 * - `access_token` — только в памяти этого модуля, с обновлением по истечении.
 * - Ничего из этого никогда не попадает в логи или в БД.
 */

function tokenFilePath(dir = paths().syncDir): string {
  return path.join(dir, 'token.bin')
}

/** Доступно ли шифрование ОС. Проверять после `app.whenReady()` (01 §10). */
export function isEncryptionAvailable(): boolean {
  try {
    return safeStorage.isEncryptionAvailable()
  } catch {
    return false
  }
}

/** Сохраняет refresh-токен зашифрованным. Бросает `sync_disabled`, если шифрование недоступно. */
export function saveRefreshToken(token: string, dir = paths().syncDir): void {
  if (!isEncryptionAvailable()) {
    throw new AppError(
      'sync_disabled',
      'Синхронизация недоступна: защищённое хранилище Windows (DPAPI) не отвечает на этом ПК.'
    )
  }
  fs.mkdirSync(dir, { recursive: true })
  const encrypted = safeStorage.encryptString(token)
  fs.writeFileSync(tokenFilePath(dir), encrypted)
}

/** Читает и расшифровывает refresh-токен; `null`, если токена нет или расшифровать не удалось. */
export function loadRefreshToken(dir = paths().syncDir): string | null {
  try {
    const file = tokenFilePath(dir)
    if (!fs.existsSync(file)) return null
    if (!isEncryptionAvailable()) return null
    const encrypted = fs.readFileSync(file)
    const value = safeStorage.decryptString(encrypted)
    return value.length > 0 ? value : null
  } catch (err) {
    log.warn('[sync] не удалось расшифровать сохранённый токен', err)
    return null
  }
}

export function hasStoredRefreshToken(dir = paths().syncDir): boolean {
  return fs.existsSync(tokenFilePath(dir))
}

/** Удаляет файл токена (выход из аккаунта, `data.wipe`). */
export function clearRefreshToken(dir = paths().syncDir): void {
  try {
    const file = tokenFilePath(dir)
    if (fs.existsSync(file)) fs.rmSync(file)
  } catch (err) {
    log.warn('[sync] не удалось удалить файл токена', err)
  }
  clearCachedAccessToken()
}

/* ------------------------------------------------------------ access token (в памяти) */

interface CachedAccessToken {
  value: string
  expiresAt: number
}

let cached: CachedAccessToken | null = null
/** Небольшой запас, чтобы не пользоваться токеном за секунды до истечения. */
const EXPIRY_SKEW_MS = 30_000

export function getCachedAccessToken(now = Date.now()): string | null {
  if (!cached) return null
  if (cached.expiresAt - EXPIRY_SKEW_MS <= now) return null
  return cached.value
}

export function setCachedAccessToken(value: string, expiresInSeconds: number, now = Date.now()): void {
  cached = { value, expiresAt: now + expiresInSeconds * 1000 }
}

export function clearCachedAccessToken(): void {
  cached = null
}
