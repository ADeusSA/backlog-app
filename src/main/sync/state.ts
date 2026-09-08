import fs from 'node:fs'
import path from 'node:path'
import { paths } from '../paths'
import { log } from '../log'

/**
 * Локальное состояние синхронизации `data/sync/state.json` (03 §3) и чистая логика протокола
 * (§4–§6), не зависящая от Electron/сети — легко покрывается юнит-тестами.
 */

export interface SyncBase {
  revision: number
  sha256: string | null
  updatedAt: string | null
}

export interface SyncStateFile {
  folderId: string | null
  manifestFileId: string | null
  dbFileId: string | null
  /** Удалённое состояние на момент последней успешной синхронизации (03 §3). */
  base: SyncBase
  lastPushedRevision: number
  lastPullAt: string | null
  lastPushAt: string | null
  /** Кеш листинга images/ на Диске. */
  remoteImages: string[]
  pendingImageDeletes: string[]
}

export function defaultSyncState(): SyncStateFile {
  return {
    folderId: null,
    manifestFileId: null,
    dbFileId: null,
    base: { revision: 0, sha256: null, updatedAt: null },
    lastPushedRevision: 0,
    lastPullAt: null,
    lastPushAt: null,
    remoteImages: [],
    pendingImageDeletes: []
  }
}

function stateFilePath(dir: string): string {
  return path.join(dir, 'state.json')
}

export function readSyncState(dir = paths().syncDir): SyncStateFile {
  try {
    const raw = fs.readFileSync(stateFilePath(dir), 'utf8')
    const parsed = JSON.parse(raw) as Partial<SyncStateFile>
    const base = defaultSyncState()
    return {
      ...base,
      ...parsed,
      base: { ...base.base, ...parsed.base },
      remoteImages: Array.isArray(parsed.remoteImages) ? parsed.remoteImages : [],
      pendingImageDeletes: Array.isArray(parsed.pendingImageDeletes) ? parsed.pendingImageDeletes : []
    }
  } catch {
    return defaultSyncState()
  }
}

export function writeSyncState(state: SyncStateFile, dir = paths().syncDir): void {
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(stateFilePath(dir), `${JSON.stringify(state, null, 2)}\n`, 'utf8')
}

/** Полный сброс состояния синхронизации (выход из аккаунта, `data.wipe`). */
export function clearSyncState(dir = paths().syncDir): void {
  try {
    const file = stateFilePath(dir)
    if (fs.existsSync(file)) fs.rmSync(file)
  } catch (err) {
    log.warn('[sync] не удалось удалить state.json', err)
  }
}

/* ------------------------------------------------------------------- манифест (03 §3) */

export interface Manifest {
  format: number
  schemaVersion: number
  revision: number
  deviceId: string
  deviceName: string
  updatedAt: string
  db: { fileId: string; sha256: string; sizeBytes: number }
  images: { count: number; totalBytes: number }
  appVersion: string
}

export function isValidManifest(value: unknown): value is Manifest {
  if (!value || typeof value !== 'object') return false
  const m = value as Record<string, unknown>
  return (
    typeof m['schemaVersion'] === 'number' &&
    typeof m['revision'] === 'number' &&
    typeof m['deviceId'] === 'string' &&
    typeof m['updatedAt'] === 'string' &&
    typeof m['db'] === 'object' &&
    m['db'] !== null &&
    typeof (m['db'] as Record<string, unknown>)['fileId'] === 'string' &&
    typeof (m['db'] as Record<string, unknown>)['sha256'] === 'string'
  )
}

/* ------------------------------------------------------------------- протокол (03 §4–§6) */

export type SyncAction =
  | { action: 'noop' }
  | { action: 'push' }
  | { action: 'pull' }
  | { action: 'conflict' }
  | { action: 'schema_too_new'; remoteSchemaVersion: number }

export interface DecideSyncParams {
  /** L — локальная ревизия (meta.db_revision). */
  localRevision: number
  /** Ревизия, которую мы последний раз успешно выгрузили в облако. */
  lastPushedRevision: number
  /** B — state.base.revision: что мы последний раз видели в облаке. */
  baseRevision: number
  /** R — ревизия из удалённого manifest.json. */
  remoteRevision: number
  remoteSchemaVersion: number
  knownSchemaVersion: number
}

/**
 * Решение протокола pull/push (03 §4–§6):
 * - schemaVersion манифеста новее, чем знает приложение → `schema_too_new` (пауза).
 * - `R == B` (облако не менялось): есть локальные изменения → `push`, иначе → `noop`.
 * - `R != B` (облако менялось): нет локальных изменений → `pull`; есть — `conflict`.
 */
export function decideSync(params: DecideSyncParams): SyncAction {
  if (params.remoteSchemaVersion > params.knownSchemaVersion) {
    return { action: 'schema_too_new', remoteSchemaVersion: params.remoteSchemaVersion }
  }
  const hasLocalChanges = params.localRevision > params.lastPushedRevision
  const hasRemoteChanges = params.remoteRevision !== params.baseRevision
  if (!hasRemoteChanges) return hasLocalChanges ? { action: 'push' } : { action: 'noop' }
  return hasLocalChanges ? { action: 'conflict' } : { action: 'pull' }
}

export type InitialReconciliation = 'push' | 'pull' | 'ask'

/**
 * Первичное согласование при подключении аккаунта (03 §5.4).
 * «Локальная пустая» — ревизия не превышает сидовую (только справочники, ни одной пользовательской записи).
 */
export function decideInitialReconciliation(params: {
  remoteExists: boolean
  localRevision: number
  seedRevision?: number
}): InitialReconciliation {
  const seedRevision = params.seedRevision ?? 0
  if (!params.remoteExists) return 'push'
  const localIsEmpty = params.localRevision <= seedRevision
  if (localIsEmpty) return 'pull'
  return 'ask'
}

/** Разница списков картинок на Диске и локально (03 §5.3) — сравнение по именам, без хешей. */
export function diffImages(
  localFileNames: readonly string[],
  remoteFileNames: readonly string[]
): { toUpload: string[]; toDownload: string[] } {
  const local = new Set(localFileNames)
  const remote = new Set(remoteFileNames)
  const toUpload = localFileNames.filter((f) => !remote.has(f))
  const toDownload = remoteFileNames.filter((f) => !local.has(f))
  return { toUpload, toDownload }
}

/** Список файлов history/ к удалению, чтобы оставить не более `keep` последних (по убыванию новизны). */
export function pruneToKeep(sortedNewestFirst: readonly string[], keep: number): { toRemove: string[] } {
  return { toRemove: sortedNewestFirst.slice(Math.max(keep, 0)) }
}

/**
 * Удалённые локально картинки (`tombstones`, entity_type='image') не хранят расширение файла,
 * поэтому имя на Диске (`id.ext`) ищем по префиксу id в актуальном листинге `images/` (03 §5.3).
 */
export function findRemoteNamesForDeletedIds(
  deletedIds: readonly string[],
  remoteImages: readonly string[]
): string[] {
  const idSet = new Set(deletedIds)
  return remoteImages.filter((name) => {
    const dot = name.lastIndexOf('.')
    const id = dot >= 0 ? name.slice(0, dot) : name
    return idSet.has(id)
  })
}

/** Имя файла в `history/`: `backlog-2026-09-07T12-31-05Z-r1532-<device>.db` (03 §3). */
export function buildHistorySnapshotName(updatedAtIso: string, revision: number, deviceName: string): string {
  const stamp = updatedAtIso.replace(/\.\d{3}Z$/, 'Z').replace(/:/g, '-')
  const safeDevice = deviceName.replace(/[^a-zA-Z0-9_-]+/g, '_')
  return `backlog-${stamp}-r${revision}-${safeDevice}.db`
}

/* ------------------------------------------------------------------------- журнал (03 §8) */

export interface SyncLogEntry {
  at: string
  kind: string
  message: string
}

const LOG_LIMIT = 20

function logFilePath(dir: string): string {
  return path.join(dir, 'log.json')
}

export function readSyncLog(dir = paths().syncDir): SyncLogEntry[] {
  try {
    const raw = fs.readFileSync(logFilePath(dir), 'utf8')
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (e): e is SyncLogEntry =>
        !!e && typeof e === 'object' && typeof (e as SyncLogEntry).at === 'string' && typeof (e as SyncLogEntry).kind === 'string'
    )
  } catch {
    return []
  }
}

/** Дописывает запись и обрезает журнал до последних 20 (03 §8). Без персональных данных. */
export function appendSyncLog(entry: SyncLogEntry, dir = paths().syncDir): SyncLogEntry[] {
  const list = [...readSyncLog(dir), entry].slice(-LOG_LIMIT)
  try {
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(logFilePath(dir), `${JSON.stringify(list, null, 2)}\n`, 'utf8')
  } catch (err) {
    log.warn('[sync] не удалось записать журнал синхронизации', err)
  }
  return list
}

export function clearSyncLog(dir = paths().syncDir): void {
  try {
    const file = logFilePath(dir)
    if (fs.existsSync(file)) fs.rmSync(file)
  } catch {
    /* не критично */
  }
}
