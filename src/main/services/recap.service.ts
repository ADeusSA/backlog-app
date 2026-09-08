/**
 * «Итоги года» (00-TZ §6 п.10, 10 §1): сводка за календарный год.
 *
 * Часы, сессии и дни берутся из `play_sessions` — как и карта активности (ADR 0008),
 * поэтому у игр в режиме «по журналу» год считается по фактическим датам, а не по
 * общему счётчику часов, который не привязан ко времени.
 */
import { getDb } from '../db/connection'
import type { Db } from '../db/connection'
import { longestStreak } from './sessions-stats'
import { type Recap, type RecapGame, recapSchema } from '@shared/schema/recap'

function bounds(year: number): { from: string; to: string } {
  return { from: `${year}-01-01`, to: `${year}-12-31` }
}

/** Годы, о которых есть что рассказать: сессии либо пройденные игры. */
function recapYears(db: Db): number[] {
  const rows = db
    .prepare(
      `SELECT DISTINCT substr(played_on, 1, 4) AS y FROM play_sessions
       UNION
       SELECT DISTINCT substr(finished_at, 1, 4) AS y FROM user_game
        WHERE status = 'completed' AND finished_at IS NOT NULL
       ORDER BY y DESC`
    )
    .all() as Array<{ y: string }>
  return rows.map((row) => Number(row.y)).filter((year) => Number.isFinite(year))
}

interface CountsRow {
  completed: number | null
  mastered: number | null
  avgRating: number | null
  ratedCount: number | null
}

function counts(db: Db, year: number): CountsRow {
  return db
    .prepare(
      `SELECT SUM(status = 'completed') AS completed,
              SUM(is_mastered = 1) AS mastered,
              AVG(rating) AS avgRating,
              SUM(rating IS NOT NULL) AS ratedCount
         FROM user_game
        WHERE finished_at IS NOT NULL AND substr(finished_at, 1, 4) = ?`
    )
    .get(String(year)) as CountsRow
}

function addedCount(db: Db, year: number): number {
  const row = db
    .prepare('SELECT COUNT(*) AS n FROM user_game WHERE substr(added_at, 1, 4) = ?')
    .get(String(year)) as { n: number }
  return row.n
}

interface SessionTotalsRow {
  minutes: number | null
  sessions: number | null
  days: number | null
}

function sessionTotals(db: Db, year: number): SessionTotalsRow {
  const { from, to } = bounds(year)
  return db
    .prepare(
      `SELECT SUM(minutes) AS minutes, COUNT(*) AS sessions, COUNT(DISTINCT played_on) AS days
         FROM play_sessions WHERE played_on BETWEEN ? AND ?`
    )
    .get(from, to) as SessionTotalsRow
}

function bestMonth(db: Db, year: number): Recap['bestMonth'] {
  const { from, to } = bounds(year)
  const row = db
    .prepare(
      `SELECT CAST(substr(played_on, 6, 2) AS INTEGER) AS month, SUM(minutes) AS minutes
         FROM play_sessions WHERE played_on BETWEEN ? AND ?
        GROUP BY month ORDER BY minutes DESC LIMIT 1`
    )
    .get(from, to) as { month: number; minutes: number } | undefined
  return row ?? null
}

function yearStreak(db: Db, year: number): number {
  const { from, to } = bounds(year)
  const rows = db
    .prepare(
      'SELECT DISTINCT played_on AS d FROM play_sessions WHERE played_on BETWEEN ? AND ? ORDER BY d ASC'
    )
    .all(from, to) as Array<{ d: string }>
  return longestStreak(rows.map((row) => row.d))
}

function topByHours(db: Db, year: number): RecapGame[] {
  const { from, to } = bounds(year)
  const rows = db
    .prepare(
      `SELECT g.id AS id, g.title AS title, cov.file_name AS coverFile, SUM(s.minutes) AS minutes
         FROM play_sessions s
         JOIN games g ON g.id = s.game_id
         LEFT JOIN images cov ON cov.id = g.cover_image_id
        WHERE s.played_on BETWEEN ? AND ?
        GROUP BY g.id ORDER BY minutes DESC LIMIT 5`
    )
    .all(from, to) as Array<{ id: string; title: string; coverFile: string | null; minutes: number }>
  return rows.map((row) => ({ ...row, rating: null }))
}

function topRated(db: Db, year: number): RecapGame[] {
  const rows = db
    .prepare(
      `SELECT g.id AS id, g.title AS title, cov.file_name AS coverFile, ug.rating AS rating
         FROM user_game ug
         JOIN games g ON g.id = ug.game_id
         LEFT JOIN images cov ON cov.id = g.cover_image_id
        WHERE ug.rating IS NOT NULL AND ug.finished_at IS NOT NULL
          AND substr(ug.finished_at, 1, 4) = ?
        ORDER BY ug.rating DESC, g.title ASC LIMIT 3`
    )
    .all(String(year)) as Array<{ id: string; title: string; coverFile: string | null; rating: number }>
  return rows.map((row) => ({ ...row, minutes: null }))
}

function genres(db: Db, year: number): Recap['genres'] {
  return db
    .prepare(
      `SELECT ge.name AS name, COUNT(DISTINCT ug.game_id) AS count
         FROM game_genres gg
         JOIN genres ge ON ge.id = gg.genre_id
         JOIN user_game ug ON ug.game_id = gg.game_id
        WHERE ug.status = 'completed' AND substr(ug.finished_at, 1, 4) = ?
        GROUP BY ge.id ORDER BY count DESC, ge.name ASC LIMIT 5`
    )
    .all(String(year)) as Recap['genres']
}

function edgeCompleted(db: Db, year: number, order: 'ASC' | 'DESC'): Recap['firstCompleted'] {
  const row = db
    .prepare(
      `SELECT g.title AS title, ug.finished_at AS date
         FROM user_game ug JOIN games g ON g.id = ug.game_id
        WHERE ug.status = 'completed' AND substr(ug.finished_at, 1, 4) = ?
        ORDER BY ug.finished_at ${order}, g.sort_title ${order} LIMIT 1`
    )
    .get(String(year)) as { title: string; date: string } | undefined
  return row ?? null
}

/** `db` подменяется в тестах базой в памяти; в приложении всегда открытое соединение. */
export function getRecap(year: number, db: Db = getDb()): Recap {
  const totals = sessionTotals(db, year)
  const row = counts(db, year)
  const completed = row.completed ?? 0
  const minutes = totals.minutes ?? 0
  const added = addedCount(db, year)

  return recapSchema.parse({
    year,
    years: recapYears(db),
    hasData: completed > 0 || minutes > 0 || added > 0,
    completed,
    added,
    mastered: row.mastered ?? 0,
    minutes,
    sessions: totals.sessions ?? 0,
    days: totals.days ?? 0,
    bestStreak: yearStreak(db, year),
    bestMonth: bestMonth(db, year),
    avgRating: row.avgRating,
    ratedCount: row.ratedCount ?? 0,
    topByHours: topByHours(db, year),
    topRated: topRated(db, year),
    genres: genres(db, year),
    firstCompleted: edgeCompleted(db, year, 'ASC'),
    lastCompleted: edgeCompleted(db, year, 'DESC')
  })
}
