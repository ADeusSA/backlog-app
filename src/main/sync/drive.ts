import fs from 'node:fs'
import { AppError } from '@shared/errors'
import type { Manifest } from './state'
import { isValidManifest, pruneToKeep } from './state'

/**
 * Тонкий клиент Google Drive API v3 на глобальном `fetch` (03 §2, §9; 01 §10).
 * Никаких `googleapis`. Обрабатывает 401 (обновить токен и повторить один раз), 403/429/5xx —
 * экспоненциальный бэкофф с джиттером, с учётом `Retry-After` (03 §7).
 */

export interface DriveAuth {
  /** Валидный (при необходимости обновлённый) access-токен. */
  getAccessToken(): Promise<string>
  /** Принудительное обновление токена — вызывается после 401. */
  refreshAccessToken(): Promise<string>
}

export interface DriveFile {
  id: string
  name: string
  size?: string
  createdTime?: string
  appProperties?: Record<string, string>
}

const API_ROOT = 'https://www.googleapis.com/drive/v3'
const UPLOAD_ROOT = 'https://www.googleapis.com/upload/drive/v3'
/** Выше этого размера — resumable upload (03 §5.2.5). */
const RESUMABLE_THRESHOLD = 5 * 1024 * 1024
const MAX_RETRIES = 5
const BOUNDARY = 'backlog-sync-boundary-7f3a'

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Экспоненциальный бэкофф с джиттером; уважает `Retry-After`, если он есть (03 §7). */
export function computeBackoffMs(
  attempt: number,
  retryAfterSeconds?: number,
  rand: () => number = Math.random
): number {
  if (retryAfterSeconds && retryAfterSeconds > 0) return Math.round(retryAfterSeconds * 1000)
  const base = Math.min(500 * 2 ** attempt, 20_000)
  return Math.round(base + rand() * base * 0.5)
}

function escapeQuery(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

function buildUrl(pathOrUrl: string, query?: Record<string, string>): string {
  const base = pathOrUrl.startsWith('http') ? pathOrUrl : `${API_ROOT}${pathOrUrl}`
  if (!query || Object.keys(query).length === 0) return base
  const url = new URL(base)
  for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value)
  return url.toString()
}

function buildMultipartBody(metadata: Record<string, unknown>, bytes: Uint8Array, mime: string): Buffer {
  const head = `--${BOUNDARY}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${BOUNDARY}\r\nContent-Type: ${mime}\r\n\r\n`
  const tail = `\r\n--${BOUNDARY}--`
  return Buffer.concat([Buffer.from(head, 'utf8'), Buffer.from(bytes), Buffer.from(tail, 'utf8')])
}

/** Тело запроса: в main-процессе доступны только типы Node, без DOM-глобалей. */
type FetchBody = NonNullable<Parameters<typeof fetch>[1]>['body']

interface RequestOptions {
  method?: string
  query?: Record<string, string>
  headers?: Record<string, string>
  body?: FetchBody
}

/** Низкоуровневый клиент: список/чтение/запись файлов Drive поверх `fetch` (03 §9). */
export class DriveClient {
  constructor(
    private readonly auth: DriveAuth,
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly sleepImpl: (ms: number) => Promise<void> = sleep
  ) {}

  private async request(pathOrUrl: string, opts: RequestOptions = {}, attempt = 0): Promise<Response> {
    const token = await this.auth.getAccessToken()
    const url = buildUrl(pathOrUrl, opts.query)
    const res = await this.fetchImpl(url, {
      method: opts.method ?? 'GET',
      headers: { ...(opts.headers ?? {}), Authorization: `Bearer ${token}` },
      body: opts.body
    })
    if (res.status === 401 && attempt < 1) {
      await this.auth.refreshAccessToken()
      return this.request(pathOrUrl, opts, attempt + 1)
    }
    if ((res.status === 429 || res.status === 403 || res.status >= 500) && attempt < MAX_RETRIES) {
      const retryAfter = res.headers.get('retry-after')
      await this.sleepImpl(computeBackoffMs(attempt, retryAfter ? Number(retryAfter) : undefined))
      return this.request(pathOrUrl, opts, attempt + 1)
    }
    return res
  }

  private async json<T>(res: Response, op: string): Promise<T> {
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new AppError('sync_network', `Google Drive (${op}): ${res.status} ${text.slice(0, 300)}`)
    }
    return (await res.json()) as T
  }

  /** `files.list` с автоматической пагинацией (03 §5.3: `pageSize=1000`). */
  async filesList(q: string, fields = 'id,name', pageSize = 1000): Promise<DriveFile[]> {
    const out: DriveFile[] = []
    let pageToken: string | undefined
    do {
      const res = await this.request('/files', {
        query: {
          q,
          fields: `nextPageToken, files(${fields})`,
          pageSize: String(pageSize),
          spaces: 'drive',
          ...(pageToken ? { pageToken } : {})
        }
      })
      const page = await this.json<{ files: DriveFile[]; nextPageToken?: string }>(res, 'files.list')
      out.push(...page.files)
      pageToken = page.nextPageToken
    } while (pageToken)
    return out
  }

  async filesGetMedia(fileId: string): Promise<Buffer> {
    const res = await this.request(`/files/${fileId}`, { query: { alt: 'media' } })
    if (!res.ok) throw new AppError('sync_network', `Google Drive (files.get): ${res.status}`)
    return Buffer.from(await res.arrayBuffer())
  }

  async filesCreateMetadataOnly(metadata: Record<string, unknown>): Promise<DriveFile> {
    const res = await this.request('/files', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
      body: JSON.stringify(metadata),
      query: { fields: 'id,name' }
    })
    return this.json<DriveFile>(res, 'files.create')
  }

  async filesCreateMultipart(metadata: Record<string, unknown>, bytes: Uint8Array, mime: string): Promise<DriveFile> {
    const res = await this.request(`${UPLOAD_ROOT}/files`, {
      method: 'POST',
      headers: { 'Content-Type': `multipart/related; boundary=${BOUNDARY}` },
      body: buildMultipartBody(metadata, bytes, mime),
      query: { uploadType: 'multipart', fields: 'id,name,appProperties' }
    })
    return this.json<DriveFile>(res, 'files.create(multipart)')
  }

  /** Обновление содержимого: multipart для небольших файлов, resumable — выше порога (03 §5.2.5). */
  async filesUpdateContent(
    fileId: string,
    bytes: Uint8Array,
    mime: string,
    metadata: Record<string, unknown> = {}
  ): Promise<DriveFile> {
    if (bytes.byteLength > RESUMABLE_THRESHOLD) return this.updateResumable(fileId, bytes, mime, metadata)
    return this.updateMultipart(fileId, bytes, mime, metadata)
  }

  private async updateMultipart(
    fileId: string,
    bytes: Uint8Array,
    mime: string,
    metadata: Record<string, unknown>
  ): Promise<DriveFile> {
    const res = await this.request(`${UPLOAD_ROOT}/files/${fileId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': `multipart/related; boundary=${BOUNDARY}` },
      body: buildMultipartBody(metadata, bytes, mime),
      query: { uploadType: 'multipart', fields: 'id,name,appProperties' }
    })
    return this.json<DriveFile>(res, 'files.update(multipart)')
  }

  private async updateResumable(
    fileId: string,
    bytes: Uint8Array,
    mime: string,
    metadata: Record<string, unknown>
  ): Promise<DriveFile> {
    const initRes = await this.request(`${UPLOAD_ROOT}/files/${fileId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Type': mime,
        'X-Upload-Content-Length': String(bytes.byteLength)
      },
      body: JSON.stringify(metadata),
      query: { uploadType: 'resumable' }
    })
    if (!initRes.ok) throw new AppError('sync_network', `Google Drive (resumable init): ${initRes.status}`)
    const location = initRes.headers.get('location')
    if (!location) throw new AppError('sync_network', 'Google Drive (resumable): нет заголовка Location')
    // Файлы такого размера умещаются в памяти целиком — передаём одним PUT (валидный частный случай
    // resumable-протокола, Content-Range покрывает весь файл), без чанкования (§ ADR 0003).
    const putRes = await this.request(location, {
      method: 'PUT',
      headers: { 'Content-Type': mime, 'Content-Length': String(bytes.byteLength) },
      body: bytes
    })
    return this.json<DriveFile>(putRes, 'files.update(resumable)')
  }

  async filesUpdateMetadata(fileId: string, metadata: Record<string, unknown>): Promise<DriveFile> {
    const res = await this.request(`/files/${fileId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
      body: JSON.stringify(metadata),
      query: { fields: 'id,name,appProperties' }
    })
    return this.json<DriveFile>(res, 'files.update')
  }

  async filesCopy(fileId: string, metadata: Record<string, unknown>): Promise<DriveFile> {
    const res = await this.request(`/files/${fileId}/copy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
      body: JSON.stringify(metadata),
      query: { fields: 'id,name' }
    })
    return this.json<DriveFile>(res, 'files.copy')
  }

  async filesDelete(fileId: string): Promise<void> {
    const res = await this.request(`/files/${fileId}`, { method: 'DELETE' })
    if (!res.ok && res.status !== 404) throw new AppError('sync_network', `Google Drive (files.delete): ${res.status}`)
  }
}

/* --------------------------------------------------------------- SyncProvider (03 §9) */

export interface AccountInfo {
  email: string | null
}

/**
 * Абстракция провайдера синхронизации (03 §9) — движок (`engine.ts`) работает поверх неё,
 * Google Drive — первая и единственная в итерации 1 реализация. Позволяет подменять провайдер
 * в тестах фейком без сети/Electron.
 */
export interface SyncProvider {
  connect(): Promise<AccountInfo>
  disconnect(): Promise<void>
  readManifest(): Promise<Manifest | null>
  /** Пишется ПОСЛЕДНИМ в протоколе push (03 §5.2.6) — вызывающая сторона следит за порядком. */
  writeManifest(manifest: Manifest): Promise<void>
  downloadDb(destPath: string): Promise<void>
  uploadDb(srcPath: string, appProps: { revision: number; deviceId: string; sha256: string }): Promise<void>
  listImages(): Promise<string[]>
  uploadImage(name: string, srcPath: string): Promise<void>
  downloadImage(name: string, destPath: string): Promise<void>
  deleteImage(name: string): Promise<void>
  copyDbToHistory(historyName: string): Promise<void>
  pruneHistory(keep: number): Promise<void>
  /** Текущие id (для сохранения в `state.json`). */
  getIds(): { folderId: string | null; manifestFileId: string | null; dbFileId: string | null }
}

export interface DriveProviderIds {
  folderId?: string | null
  manifestFileId?: string | null
  dbFileId?: string | null
}

function mimeForImage(name: string): string {
  return name.toLowerCase().endsWith('.png') ? 'image/png' : 'image/webp'
}

/** Реализация `SyncProvider` поверх Google Drive (03 §3, §9). */
export class GoogleDriveProvider implements SyncProvider {
  private folderId: string | null
  private imagesFolderId: string | null = null
  private historyFolderId: string | null = null
  private manifestFileId: string | null
  private dbFileId: string | null
  private imageIds = new Map<string, string>()

  constructor(
    private readonly client: DriveClient,
    ids: DriveProviderIds = {}
  ) {
    this.folderId = ids.folderId ?? null
    this.manifestFileId = ids.manifestFileId ?? null
    this.dbFileId = ids.dbFileId ?? null
  }

  getIds(): { folderId: string | null; manifestFileId: string | null; dbFileId: string | null } {
    return { folderId: this.folderId, manifestFileId: this.manifestFileId, dbFileId: this.dbFileId }
  }

  private async findOrCreateFolder(name: string, parentId: string | null): Promise<string> {
    const parentClause = parentId ? `'${parentId}' in parents` : `'root' in parents`
    const q = `name = '${escapeQuery(name)}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false and ${parentClause}`
    const found = await this.client.filesList(q, 'id,name', 10)
    if (found[0]) return found[0].id
    const created = await this.client.filesCreateMetadataOnly({
      name,
      mimeType: 'application/vnd.google-apps.folder',
      ...(parentId ? { parents: [parentId] } : {})
    })
    return created.id
  }

  /** Находит/создаёт папку `Backlog/`, `images/`, `history/`; ищет существующие manifest/db (03 §3). */
  async connect(): Promise<AccountInfo> {
    this.folderId = await this.findOrCreateFolder('Backlog', null)
    this.imagesFolderId = await this.findOrCreateFolder('images', this.folderId)
    this.historyFolderId = await this.findOrCreateFolder('history', this.folderId)

    const rootFiles = await this.client.filesList(
      `'${this.folderId}' in parents and trashed = false`,
      'id,name'
    )
    this.manifestFileId = rootFiles.find((f) => f.name === 'manifest.json')?.id ?? null
    this.dbFileId = rootFiles.find((f) => f.name === 'backlog.db')?.id ?? null
    // Email аккаунта провайдер не знает — определяется на этапе OAuth (userinfo) и хранится вызывающей стороной.
    return { email: null }
  }

  async disconnect(): Promise<void> {
    this.imageIds.clear()
  }

  async readManifest(): Promise<Manifest | null> {
    if (!this.manifestFileId) return null
    const bytes = await this.client.filesGetMedia(this.manifestFileId)
    try {
      const parsed = JSON.parse(bytes.toString('utf8')) as unknown
      return isValidManifest(parsed) ? parsed : null
    } catch {
      return null
    }
  }

  async writeManifest(manifest: Manifest): Promise<void> {
    const bytes = Buffer.from(JSON.stringify(manifest), 'utf8')
    if (this.manifestFileId) {
      await this.client.filesUpdateContent(this.manifestFileId, bytes, 'application/json')
    } else {
      const created = await this.client.filesCreateMultipart(
        { name: 'manifest.json', parents: this.folderId ? [this.folderId] : undefined },
        bytes,
        'application/json'
      )
      this.manifestFileId = created.id
    }
  }

  async downloadDb(destPath: string): Promise<void> {
    if (!this.dbFileId) throw new AppError('sync_network', 'В облаке ещё нет backlog.db')
    const bytes = await this.client.filesGetMedia(this.dbFileId)
    fs.writeFileSync(destPath, bytes)
  }

  async uploadDb(srcPath: string, appProps: { revision: number; deviceId: string; sha256: string }): Promise<void> {
    const bytes = fs.readFileSync(srcPath)
    const appProperties = {
      revision: String(appProps.revision),
      deviceId: appProps.deviceId,
      sha256: appProps.sha256
    }
    if (this.dbFileId) {
      await this.client.filesUpdateContent(this.dbFileId, bytes, 'application/octet-stream', { appProperties })
    } else {
      const created = await this.client.filesCreateMultipart(
        { name: 'backlog.db', parents: this.folderId ? [this.folderId] : undefined, appProperties },
        bytes,
        'application/octet-stream'
      )
      this.dbFileId = created.id
    }
  }

  async listImages(): Promise<string[]> {
    if (!this.imagesFolderId) throw new AppError('sync_network', 'Не выполнен connect() перед listImages()')
    const files = await this.client.filesList(`'${this.imagesFolderId}' in parents and trashed = false`, 'id,name')
    this.imageIds = new Map(files.map((f) => [f.name, f.id]))
    return files.map((f) => f.name)
  }

  private async ensureImageId(name: string): Promise<string | null> {
    if (this.imageIds.has(name)) return this.imageIds.get(name) ?? null
    await this.listImages()
    return this.imageIds.get(name) ?? null
  }

  async uploadImage(name: string, srcPath: string): Promise<void> {
    if (!this.imagesFolderId) throw new AppError('sync_network', 'Не выполнен connect() перед uploadImage()')
    const bytes = fs.readFileSync(srcPath)
    const created = await this.client.filesCreateMultipart(
      { name, parents: [this.imagesFolderId] },
      bytes,
      mimeForImage(name)
    )
    this.imageIds.set(name, created.id)
  }

  async downloadImage(name: string, destPath: string): Promise<void> {
    const id = await this.ensureImageId(name)
    if (!id) throw new AppError('not_found', `Изображение ${name} не найдено на Диске`)
    const bytes = await this.client.filesGetMedia(id)
    fs.writeFileSync(destPath, bytes)
  }

  async deleteImage(name: string): Promise<void> {
    const id = await this.ensureImageId(name)
    if (!id) return
    await this.client.filesDelete(id)
    this.imageIds.delete(name)
  }

  async copyDbToHistory(historyName: string): Promise<void> {
    if (!this.dbFileId || !this.historyFolderId) return
    await this.client.filesCopy(this.dbFileId, { name: historyName, parents: [this.historyFolderId] })
  }

  async pruneHistory(keep: number): Promise<void> {
    if (!this.historyFolderId) return
    const files = await this.client.filesList(
      `'${this.historyFolderId}' in parents and trashed = false`,
      'id,name,createdTime'
    )
    const sorted = [...files].sort((a, b) => (b.createdTime ?? '').localeCompare(a.createdTime ?? ''))
    const { toRemove } = pruneToKeep(
      sorted.map((f) => f.name),
      keep
    )
    const removeIds = new Set(toRemove)
    for (const file of sorted) {
      if (removeIds.has(file.name)) await this.client.filesDelete(file.id)
    }
  }
}
