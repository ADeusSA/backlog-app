/** Репозиторий прохождений (02 §3.9): несколько прохождений одной игры, NG+, реплеи. */
import type { Db } from '../connection'
import { toBool } from '../utils'
import { type PlaythroughDto, playthroughDtoSchema } from '@shared/schema/sessions'
import type { PlaythroughStatus } from '@shared/constants'

export interface PlaythroughRow {
  id: string
  game_id: string
  number: number
  title: string | null
  platform_id: string | null
  platform_name: string | null
  status: string
  is_replay: number
  is_mastered: number
  rating: number | null
  playtime_minutes: number
  started_at: string | null
  finished_at: string | null
  notes: string | null
  session_count: number
  created_at: string
  updated_at: string
}

function mapPlaythrough(row: PlaythroughRow): PlaythroughDto {
  return playthroughDtoSchema.parse({
    id: row.id,
    gameId: row.game_id,
    number: row.number,
    title: row.title,
    platformId: row.platform_id,
    platformName: row.platform_name,
    status: row.status as PlaythroughStatus,
    isReplay: toBool(row.is_replay),
    isMastered: toBool(row.is_mastered),
    rating: row.rating,
    playtimeMinutes: row.playtime_minutes,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    notes: row.notes,
    sessionCount: row.session_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  })
}

const SELECT_PLAYTHROUGH = `
  SELECT p.*, pl.name AS platform_name,
         (SELECT COUNT(*) FROM play_sessions s WHERE s.playthrough_id = p.id) AS session_count
    FROM playthroughs p
    LEFT JOIN platforms pl ON pl.id = p.platform_id`

export function listPlaythroughs(db: Db, gameId: string): PlaythroughDto[] {
  const rows = db
    .prepare(`${SELECT_PLAYTHROUGH} WHERE p.game_id = ? ORDER BY p.number ASC`)
    .all(gameId) as PlaythroughRow[]
  return rows.map(mapPlaythrough)
}

export function getPlaythrough(db: Db, id: string): PlaythroughDto | null {
  const row = db.prepare(`${SELECT_PLAYTHROUGH} WHERE p.id = ?`).get(id) as PlaythroughRow | undefined
  return row ? mapPlaythrough(row) : null
}

/** Следующий порядковый номер прохождения для игры (02 §3.9: `number`). */
export function nextPlaythroughNumber(db: Db, gameId: string): number {
  const row = db
    .prepare('SELECT COALESCE(MAX(number), 0) AS v FROM playthroughs WHERE game_id = ?')
    .get(gameId) as { v: number }
  return row.v + 1
}

export interface PlaythroughFields {
  id: string
  gameId: string
  number: number
  title: string | null
  platformId: string | null
  status: PlaythroughStatus
  isReplay: boolean
  isMastered: boolean
  rating: number | null
  playtimeMinutes: number
  startedAt: string | null
  finishedAt: string | null
  notes: string | null
  now: string
}

export function insertPlaythrough(db: Db, fields: PlaythroughFields): void {
  db.prepare(
    `INSERT INTO playthroughs(id, game_id, number, title, platform_id, status, is_replay, is_mastered,
                              rating, playtime_minutes, started_at, finished_at, notes, created_at, updated_at)
     VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    fields.id,
    fields.gameId,
    fields.number,
    fields.title,
    fields.platformId,
    fields.status,
    fields.isReplay ? 1 : 0,
    fields.isMastered ? 1 : 0,
    fields.rating,
    fields.playtimeMinutes,
    fields.startedAt,
    fields.finishedAt,
    fields.notes,
    fields.now,
    fields.now
  )
}

export function updatePlaythrough(db: Db, fields: PlaythroughFields): void {
  db.prepare(
    `UPDATE playthroughs
        SET title = ?, platform_id = ?, status = ?, is_replay = ?, is_mastered = ?, rating = ?,
            playtime_minutes = ?, started_at = ?, finished_at = ?, notes = ?, updated_at = ?
      WHERE id = ?`
  ).run(
    fields.title,
    fields.platformId,
    fields.status,
    fields.isReplay ? 1 : 0,
    fields.isMastered ? 1 : 0,
    fields.rating,
    fields.playtimeMinutes,
    fields.startedAt,
    fields.finishedAt,
    fields.notes,
    fields.now,
    fields.id
  )
}

/** Обновляет только сумму часов — вызывается после записи/удаления сессии. */
export function setPlaythroughMinutes(db: Db, id: string, minutes: number, now: string): void {
  db.prepare('UPDATE playthroughs SET playtime_minutes = ?, updated_at = ? WHERE id = ?').run(
    minutes,
    now,
    id
  )
}

/**
 * Удаляет прохождение. Сессии остаются в журнале: `play_sessions.playthrough_id`
 * объявлен как `ON DELETE SET NULL` (02 §3.9) — часы игры от этого не меняются.
 */
export function deletePlaythrough(db: Db, id: string): void {
  db.prepare('DELETE FROM playthroughs WHERE id = ?').run(id)
}
