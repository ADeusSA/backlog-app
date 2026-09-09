/** Репозиторий ленты активности (02 §3.13, 06 §1.7). */
import type { Db } from '../connection'
import { type ActivityDto, activityDtoSchema } from '@shared/schema/entities'
import { ACTIVITY_CATEGORIES, type ActivityCategory, type ActivityType } from '@shared/constants'
import { parseJson } from '../utils'

export interface InsertActivityInput {
  id: string
  happenedAt: string
  type: ActivityType
  gameId?: string | null
  entityType?: string | null
  entityId?: string | null
  payload?: Record<string, unknown>
}

export function insertActivity(db: Db, input: InsertActivityInput): void {
  db.prepare(
    'INSERT INTO activity_log(id, happened_at, type, game_id, entity_type, entity_id, payload_json) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(
    input.id,
    input.happenedAt,
    input.type,
    input.gameId ?? null,
    input.entityType ?? null,
    input.entityId ?? null,
    JSON.stringify(input.payload ?? {})
  )
}

interface ActivityRow {
  id: string
  happened_at: string
  type: string
  game_id: string | null
  game_title: string | null
  cover_file: string | null
  entity_type: string | null
  entity_id: string | null
  payload_json: string
}

function mapActivityRow(row: ActivityRow): ActivityDto {
  return activityDtoSchema.parse({
    id: row.id,
    happenedAt: row.happened_at,
    type: row.type,
    gameId: row.game_id,
    gameTitle: row.game_title,
    coverFile: row.cover_file,
    entityType: row.entity_type,
    entityId: row.entity_id,
    payload: parseJson<Record<string, unknown>>(row.payload_json, {})
  })
}

export interface ListActivityOptions {
  limit: number
  gameId?: string
  category?: ActivityCategory
  /** «<happened_at>|<id>» последней показанной записи — берём то, что строго старше (06 §1.7). */
  cursor?: string
}

export function listActivity(db: Db, opts: ListActivityOptions): ActivityDto[] {
  const conditions: string[] = []
  const params: unknown[] = []

  if (opts.gameId) {
    conditions.push('a.game_id = ?')
    params.push(opts.gameId)
  }
  if (opts.category) {
    const types = ACTIVITY_CATEGORIES[opts.category]
    conditions.push(`a.type IN (${types.map(() => '?').join(',')})`)
    params.push(...types)
  }
  const cursor = parseCursor(opts.cursor)
  if (cursor) {
    // Ключевая пагинация по паре (дата, id): смещение по OFFSET сдвигается при новых записях.
    conditions.push('(a.happened_at < ? OR (a.happened_at = ? AND a.id < ?))')
    params.push(cursor.happenedAt, cursor.happenedAt, cursor.id)
  }
  params.push(opts.limit)

  const rows = db
    .prepare(
      `SELECT a.id, a.happened_at, a.type, a.game_id, g.title AS game_title, cov.file_name AS cover_file,
              a.entity_type, a.entity_id, a.payload_json
       FROM activity_log a
       LEFT JOIN games g ON g.id = a.game_id
       LEFT JOIN images cov ON cov.id = g.cover_image_id
       ${conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''}
       ORDER BY a.happened_at DESC, a.id DESC
       LIMIT ?`
    )
    .all(...params) as ActivityRow[]
  return rows.map(mapActivityRow)
}

function parseCursor(cursor: string | undefined): { happenedAt: string; id: string } | null {
  if (!cursor) return null
  const separator = cursor.indexOf('|')
  if (separator <= 0) return null
  return { happenedAt: cursor.slice(0, separator), id: cursor.slice(separator + 1) }
}
