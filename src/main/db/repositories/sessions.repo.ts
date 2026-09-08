/**
 * Репозиторий журнала сессий (02 §3.9). Только запросы и маппинг в DTO —
 * пересчёт часов, запись активности и достижения живут в `services/sessions.service.ts`.
 */
import type { Db } from '../connection'
import { type ActivityDay, type PlaySessionDto, playSessionDtoSchema } from '@shared/schema/sessions'

export interface SessionRow {
  id: string
  game_id: string
  game_title: string
  cover_file: string | null
  playthrough_id: string | null
  playthrough_title: string | null
  playthrough_number: number | null
  played_on: string
  started_at_time: string | null
  minutes: number
  note: string | null
  created_at: string
  updated_at: string
}

/**
 * У прохождения название необязательное (02 §3.9), поэтому в списках сессий
 * показываем его номер: «#2» вместо пустоты.
 */
function playthroughLabel(row: SessionRow): string | null {
  if (!row.playthrough_id) return null
  return row.playthrough_title ?? `#${row.playthrough_number ?? 1}`
}

function mapSession(row: SessionRow): PlaySessionDto {
  return playSessionDtoSchema.parse({
    id: row.id,
    gameId: row.game_id,
    gameTitle: row.game_title,
    coverFile: row.cover_file,
    playthroughId: row.playthrough_id,
    playthroughTitle: playthroughLabel(row),
    playedOn: row.played_on,
    startedAtTime: row.started_at_time,
    minutes: row.minutes,
    note: row.note,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  })
}

const SELECT_SESSION = `
  SELECT s.id, s.game_id, g.title AS game_title, cov.file_name AS cover_file,
         s.playthrough_id, pt.title AS playthrough_title, pt.number AS playthrough_number,
         s.played_on, s.started_at_time, s.minutes, s.note, s.created_at, s.updated_at
    FROM play_sessions s
    JOIN games g ON g.id = s.game_id
    LEFT JOIN images cov ON cov.id = g.cover_image_id
    LEFT JOIN playthroughs pt ON pt.id = s.playthrough_id`

export interface ListSessionsOptions {
  gameId?: string
  playthroughId?: string
  /** Включительно, 'YYYY-MM-DD'. */
  from?: string
  to?: string
  limit?: number
  offset?: number
}

function whereFor(opts: ListSessionsOptions): { sql: string; params: unknown[] } {
  const clauses: string[] = []
  const params: unknown[] = []
  if (opts.gameId) {
    clauses.push('s.game_id = ?')
    params.push(opts.gameId)
  }
  if (opts.playthroughId) {
    clauses.push('s.playthrough_id = ?')
    params.push(opts.playthroughId)
  }
  if (opts.from) {
    clauses.push('s.played_on >= ?')
    params.push(opts.from)
  }
  if (opts.to) {
    clauses.push('s.played_on <= ?')
    params.push(opts.to)
  }
  return { sql: clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '', params }
}

export function listSessions(db: Db, opts: ListSessionsOptions = {}): PlaySessionDto[] {
  const { sql, params } = whereFor(opts)
  const rows = db
    .prepare(
      `${SELECT_SESSION} ${sql}
       ORDER BY s.played_on DESC, COALESCE(s.started_at_time, '99:99') DESC, s.created_at DESC
       LIMIT ? OFFSET ?`
    )
    .all(...params, opts.limit ?? 100, opts.offset ?? 0) as SessionRow[]
  return rows.map(mapSession)
}

export function getSession(db: Db, id: string): PlaySessionDto | null {
  const row = db.prepare(`${SELECT_SESSION} WHERE s.id = ?`).get(id) as SessionRow | undefined
  return row ? mapSession(row) : null
}

export function countSessions(db: Db, opts: ListSessionsOptions = {}): number {
  const { sql, params } = whereFor(opts)
  const row = db
    .prepare(`SELECT COUNT(*) AS n FROM play_sessions s ${sql}`)
    .get(...params) as { n: number }
  return row.n
}

export interface SessionFields {
  id: string
  gameId: string
  playthroughId: string | null
  playedOn: string
  startedAtTime: string | null
  minutes: number
  note: string | null
  now: string
}

export function insertSession(db: Db, fields: SessionFields): void {
  db.prepare(
    `INSERT INTO play_sessions(id, game_id, playthrough_id, played_on, started_at_time, minutes, note,
                               created_at, updated_at)
     VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    fields.id,
    fields.gameId,
    fields.playthroughId,
    fields.playedOn,
    fields.startedAtTime,
    fields.minutes,
    fields.note,
    fields.now,
    fields.now
  )
}

export function updateSession(db: Db, fields: SessionFields): void {
  db.prepare(
    `UPDATE play_sessions
        SET playthrough_id = ?, played_on = ?, started_at_time = ?, minutes = ?, note = ?, updated_at = ?
      WHERE id = ?`
  ).run(
    fields.playthroughId,
    fields.playedOn,
    fields.startedAtTime,
    fields.minutes,
    fields.note,
    fields.now,
    fields.id
  )
}

export function deleteSession(db: Db, id: string): void {
  db.prepare('DELETE FROM play_sessions WHERE id = ?').run(id)
}

/** Сумма минут по игре — источник `user_game.playtime_minutes` в режиме `sessions`. */
export function sumMinutesForGame(db: Db, gameId: string): number {
  const row = db
    .prepare('SELECT COALESCE(SUM(minutes), 0) AS v FROM play_sessions WHERE game_id = ?')
    .get(gameId) as { v: number }
  return row.v
}

export function sumMinutesForPlaythrough(db: Db, playthroughId: string): number {
  const row = db
    .prepare('SELECT COALESCE(SUM(minutes), 0) AS v FROM play_sessions WHERE playthrough_id = ?')
    .get(playthroughId) as { v: number }
  return row.v
}

/* ------------------------------------------------------- карта активности */

export interface ActivityQuery {
  from: string
  to: string
  gameId?: string
}

export function activityDays(db: Db, query: ActivityQuery): ActivityDay[] {
  const params: unknown[] = [query.from, query.to]
  let extra = ''
  if (query.gameId) {
    extra = 'AND game_id = ?'
    params.push(query.gameId)
  }
  return db
    .prepare(
      `SELECT played_on AS date, SUM(minutes) AS minutes, COUNT(*) AS sessions
         FROM play_sessions
        WHERE played_on BETWEEN ? AND ? ${extra}
        GROUP BY played_on
        ORDER BY played_on ASC`
    )
    .all(...params) as ActivityDay[]
}

export function activityGameCount(db: Db, query: ActivityQuery): number {
  const params: unknown[] = [query.from, query.to]
  let extra = ''
  if (query.gameId) {
    extra = 'AND game_id = ?'
    params.push(query.gameId)
  }
  const row = db
    .prepare(
      `SELECT COUNT(DISTINCT game_id) AS n FROM play_sessions
        WHERE played_on BETWEEN ? AND ? ${extra}`
    )
    .get(...params) as { n: number }
  return row.n
}

/**
 * Все дни с сессиями за всю историю — по ним считаются стрики (09 §3).
 * Окно карты активности здесь не используется: серия не должна обрываться
 * только потому, что пользователь листнул на прошлый год.
 */
export function allPlayedDays(db: Db, gameId?: string): string[] {
  const rows = gameId
    ? (db
        .prepare('SELECT DISTINCT played_on AS d FROM play_sessions WHERE game_id = ? ORDER BY d ASC')
        .all(gameId) as Array<{ d: string }>)
    : (db.prepare('SELECT DISTINCT played_on AS d FROM play_sessions ORDER BY d ASC').all() as Array<{
        d: string
      }>)
  return rows.map((row) => row.d)
}

/** Годы, в которых есть сессии — для переключателя периода над картой. */
export function sessionYears(db: Db, gameId?: string): number[] {
  const rows = gameId
    ? (db
        .prepare(
          "SELECT DISTINCT substr(played_on, 1, 4) AS y FROM play_sessions WHERE game_id = ? ORDER BY y DESC"
        )
        .all(gameId) as Array<{ y: string }>)
    : (db
        .prepare("SELECT DISTINCT substr(played_on, 1, 4) AS y FROM play_sessions ORDER BY y DESC")
        .all() as Array<{ y: string }>)
  return rows.map((row) => Number(row.y)).filter((year) => Number.isFinite(year))
}
