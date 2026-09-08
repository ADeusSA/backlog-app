import Database from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'
import { AppError } from '@shared/errors'
import { SCHEMA_VERSION } from '@shared/constants'
import { emitAppEvent } from '../events'
import { log } from '../log'
import { paths } from '../paths'
import { newId, now } from './utils'

import migration0001 from './migrations/0001_init.sql?raw'
import migration0002 from './migrations/0002_seed.sql?raw'

const MIGRATIONS: Array<{ version: number; name: string; sql: string }> = [
  { version: 1, name: '0001_init', sql: migration0001 },
  { version: 2, name: '0002_seed', sql: migration0002 }
]

export type Db = Database.Database

let db: Db | null = null
let fts5Available = false

function applyPragmas(conn: Db): void {
  conn.pragma('journal_mode = WAL')
  conn.pragma('synchronous = NORMAL')
  conn.pragma('foreign_keys = ON')
  conn.pragma('busy_timeout = 5000')
  conn.pragma('temp_store = MEMORY')
}

function detectFts5(conn: Db): boolean {
  try {
    const row = conn
      .prepare("SELECT sqlite_compileoption_used('ENABLE_FTS5') AS used")
      .get() as { used: number } | undefined
    return row?.used === 1
  } catch {
    return false
  }
}

function currentVersion(conn: Db): number {
  const hasMeta = conn
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'meta'")
    .get()
  if (!hasMeta) return 0
  const row = conn.prepare("SELECT value FROM meta WHERE key = 'schema_version'").get() as
    | { value: string }
    | undefined
  return row ? Number(row.value) : 0
}

function backupBeforeMigrate(dbPath: string): void {
  if (!fs.existsSync(dbPath)) return
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const target = path.join(paths().backupsDir, `pre-migrate-${stamp}.db`)
  try {
    fs.copyFileSync(dbPath, target)
    log.info('[db] pre-migrate backup:', target)
  } catch (err) {
    log.warn('[db] не удалось создать бэкап перед миграцией', err)
  }
}

function migrate(conn: Db, dbPath: string): void {
  const from = currentVersion(conn)
  if (from > SCHEMA_VERSION) {
    throw new AppError(
      'db_schema_too_new',
      `База создана более новой версией приложения (schema_version=${from}). Обновите приложение.`
    )
  }
  if (from === SCHEMA_VERSION) return
  if (from > 0) backupBeforeMigrate(dbPath)

  for (const migration of MIGRATIONS) {
    if (migration.version <= from) continue
    log.info(`[db] миграция ${migration.name}`)
    const run = conn.transaction(() => {
      conn.exec(migration.sql)
      if (migration.version > 1) {
        conn.prepare("UPDATE meta SET value = ? WHERE key = 'schema_version'").run(
          String(migration.version)
        )
      }
    })
    run()
  }
}

function ensureDeviceId(conn: Db): void {
  const row = conn.prepare("SELECT value FROM meta WHERE key = 'device_id'").get() as
    | { value: string }
    | undefined
  if (!row || !row.value) {
    conn
      .prepare("INSERT INTO meta(key, value) VALUES('device_id', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
      .run(newId())
  }
}

/** Открывает базу, применяет миграции. Идемпотентно. */
export function openDb(dbPath = paths().dbPath): Db {
  if (db) return db
  fs.mkdirSync(path.dirname(dbPath), { recursive: true })
  const conn = new Database(dbPath)
  applyPragmas(conn)
  fts5Available = detectFts5(conn)
  if (!fts5Available) log.warn('[db] FTS5 недоступен — поиск деградирует до LIKE')
  migrate(conn, dbPath)
  ensureDeviceId(conn)
  db = conn
  log.info('[db] открыта', dbPath, 'sqlite', conn.prepare('select sqlite_version() v').get())
  return conn
}

export function getDb(): Db {
  if (!db) return openDb()
  return db
}

export function hasFts5(): boolean {
  return fts5Available
}

export function closeDb(): void {
  if (!db) return
  try {
    db.pragma('wal_checkpoint(TRUNCATE)')
  } catch {
    /* ignore */
  }
  db.close()
  db = null
}

/**
 * Заменяет файл базы (pull из облака, восстановление бэкапа) — 01 §6.
 * Все prepared statements пересоздаются, потому что репозитории готовят их лениво.
 */
export function replaceDbFile(sourcePath: string): void {
  const target = paths().dbPath
  closeDb()
  for (const suffix of ['-wal', '-shm']) {
    const side = `${target}${suffix}`
    if (fs.existsSync(side)) fs.rmSync(side)
  }
  fs.copyFileSync(sourcePath, target)
  openDb(target)
  emitAppEvent({ type: 'dbReplaced' })
}

export function readRevision(conn: Db = getDb()): number {
  const row = conn.prepare("SELECT value FROM meta WHERE key = 'db_revision'").get() as
    | { value: string }
    | undefined
  return row ? Number(row.value) : 0
}

export function getMeta(key: string, conn: Db = getDb()): string | null {
  const row = conn.prepare('SELECT value FROM meta WHERE key = ?').get(key) as
    | { value: string }
    | undefined
  return row?.value ?? null
}

export function setMeta(key: string, value: string, conn: Db = getDb()): void {
  conn
    .prepare('INSERT INTO meta(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    .run(key, value)
}

let suppressEvents = 0

/**
 * Единственный способ писать в базу (02 §4): транзакция + инкремент ревизии +
 * событие `dbChanged` для инвалидации кешей UI.
 *
 * @param tables список затронутых таблиц — по нему renderer инвалидирует запросы
 */
export function write<T>(tables: string[], fn: (conn: Db) => T): T {
  const conn = getDb()
  const run = conn.transaction((): T => {
    const result = fn(conn)
    conn
      .prepare("UPDATE meta SET value = CAST(value AS INTEGER) + 1 WHERE key = 'db_revision'")
      .run()
    setMeta('last_local_write_at', now(), conn)
    return result
  })
  // BEGIN IMMEDIATE — писатель занимает базу сразу, чтобы не ловить SQLITE_BUSY на апгрейде блокировки
  const result = run.immediate()
  if (suppressEvents === 0) {
    emitAppEvent({ type: 'dbChanged', tables, revision: readRevision(conn) })
  }
  return result
}

/** Несколько write подряд без событий (миграции данных, импорт). */
export function withoutEvents<T>(fn: () => T): T {
  suppressEvents += 1
  try {
    return fn()
  } finally {
    suppressEvents -= 1
  }
}

/** Удаление сущности первого уровня с записью tombstone (02 §4). */
export function deleteEntity(conn: Db, entityType: string, entityId: string): void {
  conn
    .prepare(
      'INSERT INTO tombstones(entity_type, entity_id, deleted_at) VALUES(?, ?, ?) ' +
        'ON CONFLICT(entity_type, entity_id) DO UPDATE SET deleted_at = excluded.deleted_at'
    )
    .run(entityType, entityId, now())
}

/** Снимок базы для выгрузки в облако / экспорта (01 §6). */
export function snapshotTo(targetPath: string): void {
  const conn = getDb()
  conn.pragma('wal_checkpoint(TRUNCATE)')
  if (fs.existsSync(targetPath)) fs.rmSync(targetPath)
  conn.exec(`VACUUM INTO '${targetPath.replace(/'/g, "''")}'`)
}
