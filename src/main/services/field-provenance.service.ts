/**
 * Происхождение полей каталога (02 §3.11 `field_provenance`, 08 §3 п. 4).
 *
 * Правило одно: поле, значение которого пришло из внешнего источника, помечается этим
 * источником и остаётся незаблокированным — повторный импорт вправе его обновить.
 * Всё остальное считается ручным вводом и блокируется (`locked = 1`), чтобы импорт
 * не затирал то, что пользователь написал сам (08 §7 п. 2).
 */
import type { Db } from '../db/connection'
import { now } from '../db/utils'
import type { ImportProvenance } from '@shared/schema/providers'

export function lockManualFields(conn: Db, entityType: string, entityId: string, fields: string[]): void {
  if (fields.length === 0) return
  const nowTs = now()
  const stmt = conn.prepare(
    `INSERT INTO field_provenance(entity_type, entity_id, field, provider, fetched_at, locked)
     VALUES (?, ?, ?, 'manual', ?, 1)
     ON CONFLICT(entity_type, entity_id, field) DO UPDATE SET provider = 'manual', fetched_at = excluded.fetched_at, locked = 1`
  )
  for (const field of fields) stmt.run(entityType, entityId, field, nowTs)
}

/** Помечает поля как пришедшие от провайдера: `locked = 0`, обновлять можно. */
export function markImportedFields(
  conn: Db,
  entityType: string,
  entityId: string,
  provider: string,
  fields: string[]
): void {
  if (fields.length === 0) return
  const nowTs = now()
  const stmt = conn.prepare(
    `INSERT INTO field_provenance(entity_type, entity_id, field, provider, fetched_at, locked)
     VALUES (?, ?, ?, ?, ?, 0)
     ON CONFLICT(entity_type, entity_id, field) DO UPDATE SET provider = excluded.provider, fetched_at = excluded.fetched_at, locked = 0`
  )
  for (const field of fields) stmt.run(entityType, entityId, field, provider, nowTs)
}

/**
 * Привязка записи к идентификатору у провайдера (`external_ids`). Хранит сырой ответ
 * и его хеш: по нему видно, появились ли новые данные с прошлого импорта (08 §7 п. 3).
 */
export function saveExternalId(
  conn: Db,
  entityType: string,
  entityId: string,
  provenance: ImportProvenance
): void {
  conn
    .prepare(
      `INSERT INTO external_ids(entity_type, entity_id, provider, external_id, url, raw_json, raw_hash, synced_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(entity_type, entity_id, provider) DO UPDATE SET
         external_id = excluded.external_id, url = excluded.url, raw_json = excluded.raw_json,
         raw_hash = excluded.raw_hash, synced_at = excluded.synced_at`
    )
    .run(
      entityType,
      entityId,
      provenance.provider,
      provenance.externalId,
      provenance.url ?? null,
      provenance.rawJson,
      provenance.rawHash,
      now()
    )
}

export interface ExternalIdRow {
  provider: string
  externalId: string
  url: string | null
  rawHash: string | null
  syncedAt: string | null
}

/** Чем заполнена запись — для подвала страницы игры (08 §6). */
export function listExternalIds(conn: Db, entityType: string, entityId: string): ExternalIdRow[] {
  const rows = conn
    .prepare(
      'SELECT provider, external_id, url, raw_hash, synced_at FROM external_ids WHERE entity_type = ? AND entity_id = ? ORDER BY provider'
    )
    .all(entityType, entityId) as Array<{
    provider: string
    external_id: string
    url: string | null
    raw_hash: string | null
    synced_at: string | null
  }>
  return rows.map((row) => ({
    provider: row.provider,
    externalId: row.external_id,
    url: row.url,
    rawHash: row.raw_hash,
    syncedAt: row.synced_at
  }))
}
