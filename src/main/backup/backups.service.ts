import fs from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import { AppError } from '@shared/errors'
import type { BackupDto } from '@shared/schema/settings'
import { paths } from '../paths'
import { log } from '../log'
import { replaceDbFile, snapshotTo } from '../db/connection'
import { getSettings } from '../services/settings.service'

/**
 * Локальные бэкапы (02 §7, 06 §8, 10 §4 A11): снимок `VACUUM INTO`, имя
 * `backlog-YYYYMMDD-HHMM.db`, хранить N последних (настройка, по умолчанию 10).
 * `pre-migrate-*.db` создаёт `db/connection.ts`; здесь они только перечисляются.
 */

const KINDS_FILE = 'kinds.json'
type RegularKind = Extract<BackupDto['kind'], 'auto' | 'manual'>

function kindsFilePath(dir: string): string {
  return path.join(dir, KINDS_FILE)
}

function readKinds(dir: string): Record<string, BackupDto['kind']> {
  try {
    const raw = fs.readFileSync(kindsFilePath(dir), 'utf8')
    return JSON.parse(raw) as Record<string, BackupDto['kind']>
  } catch {
    return {}
  }
}

function rememberKind(dir: string, fileName: string, kind: RegularKind): void {
  const kinds = readKinds(dir)
  kinds[fileName] = kind
  try {
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(kindsFilePath(dir), `${JSON.stringify(kinds, null, 2)}\n`, 'utf8')
  } catch (err) {
    log.warn('[backups] не удалось записать kinds.json', err)
  }
}

/** Файлы `pre-pull-*`/`conflict-*` (создаёт `sync/engine.ts`) отображаются как «pre-restore». */
function inferKind(fileName: string, kinds: Record<string, BackupDto['kind']>): BackupDto['kind'] {
  const known = kinds[fileName]
  if (known) return known
  if (fileName.startsWith('pre-migrate-')) return 'pre-migrate'
  if (fileName.startsWith('pre-pull-') || fileName.startsWith('pre-restore-') || fileName.startsWith('conflict-')) {
    return 'pre-restore'
  }
  return 'auto'
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function dailyStamp(date = new Date()): string {
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}`
}

export function listBackups(dir = paths().backupsDir): BackupDto[] {
  if (!fs.existsSync(dir)) return []
  const kinds = readKinds(dir)
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.db'))
    .map((fileName) => {
      const st = fs.statSync(path.join(dir, fileName))
      return {
        fileName,
        createdAt: st.mtime.toISOString(),
        sizeBytes: st.size,
        kind: inferKind(fileName, kinds)
      }
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

/** Снимок текущей базы (`VACUUM INTO`, без WAL) в `backups/`. */
export function createBackup(kind: RegularKind = 'manual', dir = paths().backupsDir): BackupDto {
  fs.mkdirSync(dir, { recursive: true })
  const fileName = `backlog-${dailyStamp()}.db`
  snapshotTo(path.join(dir, fileName))
  rememberKind(dir, fileName, kind)
  pruneRegularBackups(dir)
  const st = fs.statSync(path.join(dir, fileName))
  return { fileName, createdAt: st.mtime.toISOString(), sizeBytes: st.size, kind }
}

/**
 * Хранить не более `keep` бэкапов `auto`/`manual` (настройка `backups.keep`, по умолчанию 10).
 * `pre-migrate`/`pre-restore` не удаляются автоматически (03 §7) — показываются в настройках.
 */
export function pruneRegularBackups(dir = paths().backupsDir, keep = getSettings().backups.keep): void {
  const kinds = readKinds(dir)
  const regular = listBackups(dir).filter((b) => {
    const kind = inferKind(b.fileName, kinds)
    return kind === 'auto' || kind === 'manual'
  })
  for (const stale of regular.slice(Math.max(keep, 0))) {
    try {
      fs.rmSync(path.join(dir, stale.fileName))
    } catch (err) {
      log.warn('[backups] не удалось удалить старый бэкап', stale.fileName, err)
    }
  }
}

/** Раз в день, если включено `backups.daily` и сегодняшнего автобэкапа ещё нет. */
export function ensureDailyBackup(dir = paths().backupsDir, dbPath = paths().dbPath): void {
  const settings = getSettings()
  if (!settings.backups.daily) return
  if (!fs.existsSync(dbPath)) return
  const kinds = readKinds(dir)
  const today = dailyStamp().slice(0, 8)
  const hasToday = listBackups(dir).some(
    (b) => inferKind(b.fileName, kinds) === 'auto' && b.fileName.startsWith(`backlog-${today}-`)
  )
  if (hasToday) return
  try {
    createBackup('auto', dir)
    log.info('[backups] создан ежедневный автобэкап')
  } catch (err) {
    log.warn('[backups] не удалось создать ежедневный автобэкап', err)
  }
}

function assertSafeFileName(fileName: string): void {
  if (!/^[\w.-]+\.db$/.test(fileName)) {
    throw new AppError('validation', 'Недопустимое имя файла бэкапа')
  }
}

export function deleteBackup(fileName: string, dir = paths().backupsDir): void {
  assertSafeFileName(fileName)
  const full = path.join(dir, fileName)
  if (!fs.existsSync(full)) throw new AppError('not_found', 'Файл бэкапа не найден')
  fs.rmSync(full)
}

function assertIntegrity(dbFilePath: string): void {
  let conn: Database.Database | null = null
  try {
    conn = new Database(dbFilePath, { readonly: true })
    const row = conn.prepare('PRAGMA integrity_check').get() as { integrity_check: string }
    if (row.integrity_check !== 'ok') {
      throw new AppError('io', 'Файл бэкапа повреждён (integrity_check) — восстановление отменено')
    }
  } finally {
    conn?.close()
  }
}

/** `backups.restore` (10 §4 A11): бэкап текущей базы → атомарная замена → `dbReplaced`. */
export function restoreBackup(
  fileName: string,
  dir = paths().backupsDir,
  dbPath = paths().dbPath,
  doReplace: (source: string) => void = replaceDbFile
): void {
  assertSafeFileName(fileName)
  const source = path.join(dir, fileName)
  if (!fs.existsSync(source)) throw new AppError('not_found', 'Файл бэкапа не найден')
  assertIntegrity(source)
  if (fs.existsSync(dbPath)) createBackup('manual', dir)
  doReplace(source)
}
