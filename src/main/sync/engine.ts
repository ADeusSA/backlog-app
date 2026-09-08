import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import Database from 'better-sqlite3'
import { app } from 'electron'
import { AppError } from '@shared/errors'
import { SCHEMA_VERSION } from '@shared/constants'
import type { Settings, SettingsPatch, SyncState } from '@shared/schema/settings'
import { emitAppEvent } from '../events'
import { log } from '../log'
import { paths } from '../paths'
import { getDb, getMeta, readRevision, replaceDbFile, setMeta, snapshotTo } from '../db/connection'
import { now } from '../db/utils'
import { getSettings, patchSettings } from '../services/settings.service'
import { GoogleDriveProvider, DriveClient, type DriveProviderIds, type SyncProvider } from './drive'
import { createDriveAuth, signIn as oauthSignIn, signOut as oauthSignOut } from './oauth'
import { isConfigured } from './google.config'
import { hasStoredRefreshToken } from './tokens'
import {
  appendSyncLog,
  buildHistorySnapshotName,
  clearSyncLog,
  clearSyncState,
  decideInitialReconciliation,
  decideSync,
  diffImages,
  findRemoteNamesForDeletedIds,
  readSyncLog,
  readSyncState,
  writeSyncState,
  type Manifest,
  type SyncLogEntry,
  type SyncStateFile
} from './state'

/**
 * Движок синхронизации (03 §5–§7) поверх абстракции `SyncProvider` (03 §9). Все зависящие от
 * Electron/сети/файловой системы вещи заведены через `SyncEngineDeps`, что позволяет тестировать
 * протокол (push/pull/конфликты) на фейковом провайдере и временной SQLite-базе без сети.
 */

export const HISTORY_KEEP = 10

export interface EnginePaths {
  dbPath: string
  imagesDir: string
  backupsDir: string
  syncDir: string
  snapshotsDir: string
}

export interface SyncEngineDeps {
  /** Строит провайдер, сохраняя ранее известные id (folderId/manifestFileId/dbFileId). */
  makeProvider: (ids: DriveProviderIds) => SyncProvider
  /** Выполняет OAuth-вход и сохраняет refresh-токен; возвращает e-mail аккаунта. */
  doSignIn: () => Promise<{ email: string | null }>
  doSignOut: () => Promise<void>
  isConfigured: () => boolean
  hasSignedIn: () => boolean
  /** Атомарная подмена файла БД (обычно `db/connection.ts#replaceDbFile`). */
  replaceDbFile: (sourcePath: string) => void
  paths: () => EnginePaths
  getSettings: () => Settings
  patchSettings: (patch: SettingsPatch) => Settings
  deviceId: string
  deviceName: string
  appVersion: string
  knownSchemaVersion: number
}

interface PendingConflict {
  manifest: Manifest
  stateSnapshot: SyncStateFile
}

/** Параметры выгрузки; `force` ставится только при разрешении конфликта (03 §6). */
interface PushOptions {
  force?: boolean
}

function sha256File(filePath: string): string {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex')
}

/** Открывает файл только на чтение и проверяет `PRAGMA integrity_check` (03 §7). */
function assertIntegrity(dbPath: string): void {
  let conn: Database.Database | null = null
  try {
    conn = new Database(dbPath, { readonly: true })
    const row = conn.prepare('PRAGMA integrity_check').get() as { integrity_check: string }
    if (row.integrity_check !== 'ok') {
      throw new AppError('io', 'Скачанная база не прошла проверку целостности. Локальная база не изменена.')
    }
  } finally {
    conn?.close()
  }
}

function toFlatImageName(img: { id: string; fileName: string }): string {
  return `${img.id}${path.extname(img.fileName)}`
}

function queryLocalImages(): Array<{ id: string; fileName: string }> {
  return getDb()
    .prepare('SELECT id, file_name AS fileName FROM images')
    .all() as Array<{ id: string; fileName: string }>
}

function queryDeletedImageIds(sinceIso: string | null): string[] {
  const rows = sinceIso
    ? (getDb()
        .prepare("SELECT entity_id AS id FROM tombstones WHERE entity_type = 'image' AND deleted_at > ?")
        .all(sinceIso) as Array<{ id: string }>)
    : (getDb().prepare("SELECT entity_id AS id FROM tombstones WHERE entity_type = 'image'").all() as Array<{
        id: string
      }>)
  return rows.map((r) => r.id)
}

/** До 4 одновременных операций (03 §7); `onDone` — для прогресса (03 §8, сценарий A7). */
async function runWithConcurrency<T>(
  items: readonly T[],
  limit: number,
  worker: (item: T) => Promise<void>,
  onDone?: (completed: number, total: number) => void
): Promise<void> {
  let index = 0
  let completed = 0
  async function next(): Promise<void> {
    const i = index++
    if (i >= items.length) return
    await worker(items[i] as T)
    completed += 1
    onDone?.(completed, items.length)
    return next()
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) || 0 }, () => next()))
}

function stamp(): string {
  return now().replace(/[:.]/g, '-')
}

function describeError(err: unknown): string {
  if (err instanceof AppError) return err.message
  if (err instanceof Error) return err.message
  return String(err)
}

function isNetworkError(err: unknown): boolean {
  const code = err && typeof err === 'object' && 'code' in err ? (err as { code?: string }).code : undefined
  if (code && ['ENOTFOUND', 'ECONNREFUSED', 'ECONNRESET', 'EAI_AGAIN', 'ETIMEDOUT'].includes(code)) return true
  if (err instanceof TypeError && /fetch/i.test(err.message)) return true
  return false
}

/** Задержки повторов push при ошибке (03 §5.2.8): 1, 2, 5, 15 минут, далее повторяем последнюю. */
const PUSH_RETRY_DELAYS_MS = [60_000, 120_000, 300_000, 900_000]

export class SyncEngine {
  private status: SyncState
  private providerPromise: Promise<SyncProvider> | null = null
  private busy = false
  private pendingConflict: PendingConflict | null = null
  private retryAttempt = 0
  private retryTimer: ReturnType<typeof setTimeout> | null = null

  constructor(private readonly deps: SyncEngineDeps) {
    const configuredAndSignedIn = deps.isConfigured() && deps.hasSignedIn()
    this.status = {
      status: configuredAndSignedIn ? 'idle' : 'disabled',
      accountEmail: configuredAndSignedIn ? deps.getSettings().sync.accountEmail : null,
      lastPushAt: null,
      lastPullAt: null,
      lastError: null,
      pendingChanges: false,
      progress: null
    }
  }

  getState(): SyncState {
    return { ...this.status, pendingChanges: this.computePendingChanges() }
  }

  getLog(): SyncLogEntry[] {
    return readSyncLog(this.deps.paths().syncDir)
  }

  isSignedIn(): boolean {
    return this.deps.isConfigured() && this.deps.hasSignedIn()
  }

  private computePendingChanges(): boolean {
    if (!this.deps.hasSignedIn()) return false
    try {
      const state = readSyncState(this.deps.paths().syncDir)
      return readRevision() > state.lastPushedRevision
    } catch {
      return false
    }
  }

  private appendLog(kind: string, message: string): void {
    appendSyncLog({ at: now(), kind, message }, this.deps.paths().syncDir)
  }

  private setStatus(patch: Partial<SyncState>): void {
    this.status = { ...this.status, ...patch }
    emitAppEvent({ type: 'syncState', state: this.getState() })
  }

  private ensureProvider(): Promise<SyncProvider> {
    if (this.providerPromise) return this.providerPromise
    this.providerPromise = (async () => {
      const state = readSyncState(this.deps.paths().syncDir)
      const provider = this.deps.makeProvider({
        folderId: state.folderId,
        manifestFileId: state.manifestFileId,
        dbFileId: state.dbFileId
      })
      await provider.connect()
      return provider
    })()
    return this.providerPromise
  }

  private readyToSync(): boolean {
    return this.isSignedIn() && this.status.status !== 'conflict'
  }

  private handleError(kind: string, err: unknown): void {
    const message = describeError(err)
    this.appendLog(kind, `ошибка: ${message}`)
    this.setStatus({ status: isNetworkError(err) ? 'offline' : 'error', lastError: message, progress: null })
    if (!(err instanceof AppError)) log.error(`[sync] ${kind}`, err)
  }

  private scheduleRetry(): void {
    if (this.retryTimer) clearTimeout(this.retryTimer)
    const delay = PUSH_RETRY_DELAYS_MS[Math.min(this.retryAttempt, PUSH_RETRY_DELAYS_MS.length - 1)] as number
    this.retryAttempt += 1
    this.retryTimer = setTimeout(() => {
      void this.runPush()
    }, delay)
    if (typeof this.retryTimer.unref === 'function') this.retryTimer.unref()
  }

  /* ------------------------------------------------------------------------ вход/выход */

  async signIn(): Promise<SyncState> {
    if (!this.deps.isConfigured()) {
      throw new AppError(
        'sync_disabled',
        'Синхронизация не настроена сборкой: заполните src/main/sync/google.config.ts (docs/03-sync-google-drive.md §11).'
      )
    }
    if (this.busy) throw new AppError('conflict', 'Синхронизация уже выполняется')
    this.busy = true
    this.providerPromise = null
    this.setStatus({ status: 'syncing', lastError: null, progress: null })
    try {
      const result = await this.deps.doSignIn()
      const provider = await this.ensureProvider()
      const settings = this.deps.getSettings()
      this.deps.patchSettings({ sync: { ...settings.sync, enabled: true, accountEmail: result.email } })
      this.setStatus({ accountEmail: result.email })
      this.appendLog('signIn', 'подключение к Google Диску выполнено')
      await this.reconcileInitial(provider)
    } catch (err) {
      this.handleError('signIn', err)
    } finally {
      this.busy = false
    }
    return this.getState()
  }

  async signOut(): Promise<SyncState> {
    if (this.busy) throw new AppError('conflict', 'Синхронизация уже выполняется')
    this.busy = true
    try {
      await this.deps.doSignOut()
      this.providerPromise = null
      this.pendingConflict = null
      const dir = this.deps.paths().syncDir
      clearSyncState(dir)
      clearSyncLog(dir)
      const settings = this.deps.getSettings()
      this.deps.patchSettings({ sync: { ...settings.sync, enabled: false, accountEmail: null } })
      this.setStatus({
        status: 'disabled',
        accountEmail: null,
        lastError: null,
        lastPushAt: null,
        lastPullAt: null,
        progress: null
      })
    } finally {
      this.busy = false
    }
    return this.getState()
  }

  /** Первичное согласование при подключении аккаунта (03 §5.4). */
  private async reconcileInitial(provider: SyncProvider): Promise<void> {
    const manifest = await provider.readManifest()
    const localRevision = readRevision()
    const decision = decideInitialReconciliation({ remoteExists: manifest !== null, localRevision })
    if (decision === 'push') {
      await this.runPushSafely(provider)
    } else if (decision === 'pull' && manifest) {
      await this.applyRemoteSnapshot(provider, manifest)
    } else if (manifest) {
      // Обе базы непустые — тот же диалог выбора, что и при конфликте (§5.4 использует
      // тот же набор карточек/кнопок, что и §6; отдельного канала IPC для этого случая нет).
      this.pendingConflict = { manifest, stateSnapshot: readSyncState(this.deps.paths().syncDir) }
      this.setStatus({ status: 'conflict', progress: null })
      this.appendLog('initial', 'на Диске уже есть данные — нужен выбор пользователя')
    }
  }

  /* --------------------------------------------------------------------------- pull/push */

  /** Pull — при запуске и по кнопке «Синхронизировать сейчас» (03 §5.1). */
  async runPull(): Promise<SyncState> {
    if (!this.readyToSync()) return this.getState()
    if (this.busy) return this.getState()
    this.busy = true
    try {
      const provider = await this.ensureProvider()
      const manifest = await provider.readManifest()
      const localRevision = readRevision()
      const state = readSyncState(this.deps.paths().syncDir)

      if (!manifest) {
        if (localRevision > state.lastPushedRevision) await this.runPushSafely(provider)
        else this.setStatus({ status: 'idle', progress: null })
        return this.getState()
      }
      if (manifest.schemaVersion > this.deps.knownSchemaVersion) {
        this.setStatus({
          status: 'error',
          lastError: 'В облаке база более новой версии приложения. Обновите приложение — синхронизация приостановлена.',
          progress: null
        })
        this.appendLog('pull', 'пауза: schemaVersion облака новее приложения')
        return this.getState()
      }

      const decision = decideSync({
        localRevision,
        lastPushedRevision: state.lastPushedRevision,
        baseRevision: state.base.revision,
        remoteRevision: manifest.revision,
        remoteSchemaVersion: manifest.schemaVersion,
        knownSchemaVersion: this.deps.knownSchemaVersion
      })

      if (decision.action === 'noop') {
        this.setStatus({ status: 'idle', progress: null })
      } else if (decision.action === 'push') {
        await this.runPushSafely(provider)
      } else if (decision.action === 'pull') {
        await this.applyRemoteSnapshot(provider, manifest)
      } else if (decision.action === 'conflict') {
        this.pendingConflict = { manifest, stateSnapshot: state }
        this.setStatus({ status: 'conflict', progress: null })
        this.appendLog('conflict', 'изменения на двух устройствах')
      } else {
        this.setStatus({ status: 'error', lastError: 'Обновите приложение.', progress: null })
      }
    } catch (err) {
      this.handleError('pull', err)
    } finally {
      this.busy = false
    }
    return this.getState()
  }

  /* Параметры выгрузки; `force` используется только при разрешении конфликта (03 §6). */

  /** Push — по дебаунсу/таймеру/выходу/кнопке (03 §5.2). Не пересекается с pull/конфликтом. */
  async runPush(): Promise<SyncState> {
    if (!this.readyToSync()) return this.getState()
    if (this.busy) return this.getState()
    this.busy = true
    try {
      const provider = await this.ensureProvider()
      await this.runPushSafely(provider)
    } finally {
      this.busy = false
    }
    return this.getState()
  }

  private async runPushSafely(provider: SyncProvider, options: PushOptions = {}): Promise<void> {
    try {
      await this.doPush(provider, options)
      this.retryAttempt = 0
    } catch (err) {
      this.handleError('push', err)
      this.scheduleRetry()
    }
  }

  /**
   * @param options.force — выгрузка после разрешения конфликта в пользу локальной версии:
   * проверка расхождения ревизий пропускается, иначе push снова обнаружил бы тот же конфликт
   * и приложение зависло бы в состоянии `conflict`. Облачная версия при этом не теряется:
   * шаг 4 копирует её в `history/` на Диске (а при `keep_both` — ещё и в локальные `backups/`).
   */
  private async doPush(provider: SyncProvider, options: PushOptions = {}): Promise<void> {
    const p = this.deps.paths()
    const localRevision = readRevision()
    const state = readSyncState(p.syncDir)
    if (!options.force && localRevision <= state.lastPushedRevision) {
      this.setStatus({ status: 'idle', progress: null })
      return
    }
    this.setStatus({ status: 'syncing', progress: 0.05, lastError: null })

    // 1. Кто-то писал параллельно — конфликт, push отменяется (§5.2.1).
    const manifest = await provider.readManifest()
    if (!options.force && manifest && manifest.revision !== state.base.revision) {
      this.pendingConflict = { manifest, stateSnapshot: state }
      this.setStatus({ status: 'conflict', progress: null })
      this.appendLog('conflict', 'параллельная запись при попытке выгрузки')
      return
    }

    // 2. checkpoint + VACUUM INTO + sha256 (§5.2.2).
    fs.mkdirSync(p.snapshotsDir, { recursive: true })
    const outgoingPath = path.join(p.snapshotsDir, 'outgoing.db')
    snapshotTo(outgoingPath)
    const sha256 = sha256File(outgoingPath)
    const sizeBytes = fs.statSync(outgoingPath).size
    this.setStatus({ progress: 0.2 })

    // 3. Картинки: докачать недостающие, удалить помеченные к удалению (§5.2.3).
    const localImages = queryLocalImages()
    const remoteImageNames = manifest ? await provider.listImages() : state.remoteImages
    const localFlat = localImages.map((img) => ({ ...img, flat: toFlatImageName(img) }))
    const { toUpload } = diffImages(
      localFlat.map((i) => i.flat),
      remoteImageNames
    )
    await runWithConcurrency(toUpload, 4, async (flatName) => {
      const found = localFlat.find((i) => i.flat === flatName)
      if (found) await provider.uploadImage(flatName, path.join(p.imagesDir, found.fileName))
    })
    const deletedIds = queryDeletedImageIds(state.lastPushAt)
    const toDeleteNames = findRemoteNamesForDeletedIds(deletedIds, remoteImageNames)
    for (const nameToDelete of toDeleteNames) await provider.deleteImage(nameToDelete)
    const finalRemoteImages = [...remoteImageNames.filter((n) => !toDeleteNames.includes(n)), ...toUpload]
    this.setStatus({ progress: 0.55 })

    // 4. Предыдущий backlog.db → history/ ДО перезаписи (§5.2.4).
    if (manifest) {
      await provider.copyDbToHistory(buildHistorySnapshotName(manifest.updatedAt, manifest.revision, manifest.deviceName))
    }
    this.setStatus({ progress: 0.7 })

    // 5. Загрузить outgoing.db поверх текущего (§5.2.5).
    await provider.uploadDb(outgoingPath, { revision: localRevision, deviceId: this.deps.deviceId, sha256 })
    this.setStatus({ progress: 0.9 })

    // 6. manifest.json — ПОСЛЕДНИМ (§5.2.6).
    const updatedAt = now()
    const newManifest: Manifest = {
      format: 1,
      schemaVersion: this.deps.knownSchemaVersion,
      revision: localRevision,
      deviceId: this.deps.deviceId,
      deviceName: this.deps.deviceName,
      updatedAt,
      db: { fileId: provider.getIds().dbFileId ?? '', sha256, sizeBytes },
      images: { count: finalRemoteImages.length, totalBytes: 0 },
      appVersion: this.deps.appVersion
    }
    await provider.writeManifest(newManifest)

    // 7. Обновить состояние, обрезать history/ (§5.2.7).
    const ids = provider.getIds()
    writeSyncState(
      {
        folderId: ids.folderId,
        manifestFileId: ids.manifestFileId,
        dbFileId: ids.dbFileId,
        base: { revision: localRevision, sha256, updatedAt },
        lastPushedRevision: localRevision,
        lastPullAt: state.lastPullAt,
        lastPushAt: updatedAt,
        remoteImages: finalRemoteImages,
        pendingImageDeletes: []
      },
      p.syncDir
    )
    await provider.pruneHistory(HISTORY_KEEP)
    setMeta('last_sync_push_at', updatedAt)
    fs.rmSync(outgoingPath, { force: true })
    this.appendLog('push', `выгружено (ревизия ${localRevision})`)
    this.setStatus({ status: 'idle', lastPushAt: updatedAt, progress: null, lastError: null })
  }

  /** Применяет удалённый снимок (§5.1.4, §7): бэкап → replaceDbFile → докачка картинок. */
  private async applyRemoteSnapshot(
    provider: SyncProvider,
    manifest: Manifest,
    opts: { backupPrefix?: string } = {}
  ): Promise<void> {
    const p = this.deps.paths()
    fs.mkdirSync(p.snapshotsDir, { recursive: true })
    const incomingPath = path.join(p.snapshotsDir, 'incoming.db')
    this.setStatus({ status: 'syncing', progress: 0.1, lastError: null })

    await provider.downloadDb(incomingPath)
    const sha256 = sha256File(incomingPath)
    if (sha256 !== manifest.db.sha256) {
      fs.rmSync(incomingPath, { force: true })
      throw new AppError('io', 'Скачанный файл базы повреждён (несовпадение контрольной суммы). Локальная база не изменена.')
    }
    assertIntegrity(incomingPath)
    this.setStatus({ progress: 0.4 })

    fs.mkdirSync(p.backupsDir, { recursive: true })
    if (fs.existsSync(p.dbPath)) {
      fs.copyFileSync(p.dbPath, path.join(p.backupsDir, `${opts.backupPrefix ?? 'pre-pull'}-${stamp()}.db`))
    }

    this.deps.replaceDbFile(incomingPath)
    fs.rmSync(incomingPath, { force: true })
    this.setStatus({ progress: 0.6 })

    const localImages = queryLocalImages()
    const remoteImageNames = await provider.listImages()
    const { toDownload } = diffImages(
      localImages.map((img) => toFlatImageName(img)),
      remoteImageNames
    )
    await runWithConcurrency(
      toDownload,
      4,
      async (flatName) => {
        const row = localImages.find((img) => toFlatImageName(img) === flatName)
        const dest = path.join(p.imagesDir, row ? row.fileName : flatName)
        fs.mkdirSync(path.dirname(dest), { recursive: true })
        await provider.downloadImage(flatName, dest)
      },
      (completed, total) => {
        emitAppEvent({ type: 'progress', job: 'sync-pull', value: completed / total, message: `картинок ${completed}/${total}` })
      }
    )
    if (toDownload.length > 0) emitAppEvent({ type: 'imagesDownloaded', count: toDownload.length })

    const updatedAt = now()
    const ids = provider.getIds()
    const prevState = readSyncState(p.syncDir)
    writeSyncState(
      {
        folderId: ids.folderId,
        manifestFileId: ids.manifestFileId,
        dbFileId: ids.dbFileId,
        base: { revision: manifest.revision, sha256, updatedAt: manifest.updatedAt },
        lastPushedRevision: readRevision(),
        lastPullAt: updatedAt,
        lastPushAt: prevState.lastPushAt,
        remoteImages: remoteImageNames,
        pendingImageDeletes: []
      },
      p.syncDir
    )
    setMeta('last_sync_pull_at', updatedAt)
    this.appendLog('pull', `загружено (ревизия ${manifest.revision})`)
    this.setStatus({ status: 'idle', lastPullAt: updatedAt, progress: null, lastError: null })
  }

  /* ------------------------------------------------------------------------- конфликты */

  /**
   * Разрешение конфликта (03 §6): `local` — облачная версия уходит в history/ (автоматически при
   * push), затем push; `remote` — локальная в `backups/conflict-*.db`, затем pull; `keep_both` —
   * то же, что `local`, но облачная версия ДОПОЛНИТЕЛЬНО сохраняется в локальные `backups/`
   * (двойная сохранность: history/ на Диске + backups/ локально).
   */
  async resolveConflict(choice: 'local' | 'remote' | 'keep_both'): Promise<SyncState> {
    const pending = this.pendingConflict
    if (!pending) throw new AppError('validation', 'Нет активного конфликта для разрешения')
    if (this.busy) throw new AppError('conflict', 'Синхронизация уже выполняется')
    this.busy = true
    try {
      const provider = await this.ensureProvider()
      if (choice === 'keep_both') {
        const p = this.deps.paths()
        fs.mkdirSync(p.snapshotsDir, { recursive: true })
        const tmp = path.join(p.snapshotsDir, 'conflict-remote.db')
        await provider.downloadDb(tmp)
        fs.mkdirSync(p.backupsDir, { recursive: true })
        fs.copyFileSync(tmp, path.join(p.backupsDir, `conflict-remote-${stamp()}.db`))
        fs.rmSync(tmp, { force: true })
      }
      this.pendingConflict = null
      if (choice === 'remote') {
        await this.applyRemoteSnapshot(provider, pending.manifest, { backupPrefix: 'conflict' })
      } else {
        // force: локальная версия объявлена победившей, расхождение ревизий больше не блокирует push
        await this.runPushSafely(provider, { force: true })
      }
      this.appendLog('conflict-resolved', choice)
    } catch (err) {
      this.handleError('conflict', err)
    } finally {
      this.busy = false
    }
    return this.getState()
  }

  dispose(): void {
    if (this.retryTimer) clearTimeout(this.retryTimer)
  }
}

/* ---------------------------------------------------------------------- singleton (prod) */

let singleton: SyncEngine | null = null

function getDeviceId(): string {
  return getMeta('device_id') ?? 'unknown-device'
}

/** Единственный экземпляр движка на процесс main (см. `sync.ipc.ts`, `scheduler.ts`). */
export function getSyncEngine(): SyncEngine {
  if (singleton) return singleton
  singleton = new SyncEngine({
    makeProvider: (ids) => new GoogleDriveProvider(new DriveClient(createDriveAuth()), ids),
    doSignIn: () => oauthSignIn(),
    doSignOut: () => oauthSignOut(),
    isConfigured,
    hasSignedIn: () => hasStoredRefreshToken(),
    replaceDbFile,
    paths: () => paths(),
    getSettings,
    patchSettings,
    deviceId: getDeviceId(),
    deviceName: os.hostname(),
    appVersion: app.getVersion(),
    knownSchemaVersion: SCHEMA_VERSION
  })
  return singleton
}

/** Только для тестов/повторной инициализации после смены настроек. */
export function resetSyncEngine(): void {
  singleton?.dispose()
  singleton = null
}
