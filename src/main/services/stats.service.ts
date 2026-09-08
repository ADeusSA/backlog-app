/** Статистика профиля (06 §1.5, 02 §5): набор агрегатов по `user_game`, одним модулем. */
import { getDb } from '../db/connection'
import type { Db } from '../db/connection'
import { queryCardsRaw } from '../db/repositories/collection.repo'
import { GAME_STATUSES, OWNERSHIPS, type Ownership } from '@shared/constants'
import { type Stats, statsSchema } from '@shared/schema/entities'

interface TotalsRow {
  all: number | null
  inLibrary: number | null
  completed: number | null
  mastered: number | null
  playtimeMinutes: number | null
  avgRating: number | null
  ratedCount: number | null
  reviewCount: number | null
}

function getTotals(db: Db): Stats['totals'] {
  const row = db
    .prepare(
      `SELECT
         COUNT(*) AS "all",
         SUM(status <> 'wishlist') AS inLibrary,
         SUM(status = 'completed') AS completed,
         SUM(is_mastered = 1) AS mastered,
         SUM(playtime_minutes) AS playtimeMinutes,
         AVG(rating) AS avgRating,
         SUM(rating IS NOT NULL) AS ratedCount,
         SUM(review IS NOT NULL AND review <> '') AS reviewCount
       FROM user_game`
    )
    .get() as TotalsRow
  return {
    all: row.all ?? 0,
    inLibrary: row.inLibrary ?? 0,
    completed: row.completed ?? 0,
    mastered: row.mastered ?? 0,
    playtimeMinutes: row.playtimeMinutes ?? 0,
    avgRating: row.avgRating,
    ratedCount: row.ratedCount ?? 0,
    reviewCount: row.reviewCount ?? 0
  }
}

function getByStatus(db: Db): Stats['byStatus'] {
  const rows = db.prepare('SELECT status, COUNT(*) AS count FROM user_game GROUP BY status').all() as Array<{
    status: string
    count: number
  }>
  const byKey = new Map(rows.map((r) => [r.status, r.count]))
  return GAME_STATUSES.map((status) => ({ status, count: byKey.get(status) ?? 0 }))
}

function getCompletedByYear(db: Db): Stats['completedByYear'] {
  const rows = db
    .prepare(
      `SELECT substr(finished_at, 1, 4) AS year, COUNT(*) AS count, SUM(playtime_minutes) AS playtimeMinutes
       FROM user_game WHERE status = 'completed' AND finished_at IS NOT NULL
       GROUP BY year ORDER BY year ASC`
    )
    .all() as Array<{ year: string; count: number; playtimeMinutes: number | null }>
  return rows.map((r) => ({ year: r.year, count: r.count, playtimeMinutes: r.playtimeMinutes ?? 0 }))
}

function getRatingHistogram(db: Db): Stats['ratingHistogram'] {
  const rows = db.prepare('SELECT rating, COUNT(*) AS count FROM user_game WHERE rating IS NOT NULL GROUP BY rating').all() as Array<{
    rating: number
    count: number
  }>
  const byRating = new Map(rows.map((r) => [r.rating, r.count]))
  return Array.from({ length: 10 }, (_, i) => i + 1).map((rating) => ({ rating, count: byRating.get(rating) ?? 0 }))
}

interface TopGenreRow {
  id: string
  name: string
  count: number
  playtimeMinutes: number | null
  avgRating: number | null
}

function getTopGenres(db: Db): Stats['topGenres'] {
  const rows = db
    .prepare(
      `SELECT ge.id AS id, ge.name AS name, COUNT(DISTINCT ug.game_id) AS count,
              SUM(ug.playtime_minutes) AS playtimeMinutes, AVG(ug.rating) AS avgRating
       FROM game_genres gg
       JOIN genres ge ON ge.id = gg.genre_id
       JOIN user_game ug ON ug.game_id = gg.game_id AND ug.status <> 'wishlist'
       GROUP BY ge.id ORDER BY count DESC LIMIT 8`
    )
    .all() as TopGenreRow[]
  return rows.map((r) => ({ id: r.id, name: r.name, count: r.count, playtimeMinutes: r.playtimeMinutes ?? 0, avgRating: r.avgRating }))
}

interface TopPlatformRow {
  id: string
  name: string
  shortName: string
  count: number
  playtimeMinutes: number | null
}

function getTopPlatforms(db: Db): Stats['topPlatforms'] {
  const rows = db
    .prepare(
      `SELECT p.id AS id, p.name AS name, p.short_name AS shortName, COUNT(*) AS count,
              SUM(ug.playtime_minutes) AS playtimeMinutes
       FROM user_game ug JOIN platforms p ON p.id = ug.platform_id
       WHERE ug.status <> 'wishlist'
       GROUP BY p.id ORDER BY count DESC LIMIT 6`
    )
    .all() as TopPlatformRow[]
  return rows.map((r) => ({ ...r, playtimeMinutes: r.playtimeMinutes ?? 0 }))
}

interface TopDeveloperRow {
  id: string
  name: string
  logoFile: string | null
  count: number
  avgRating: number | null
}

function getTopDevelopers(db: Db): Stats['topDevelopers'] {
  const rows = db
    .prepare(
      `SELECT co.id AS id, co.name AS name, logo.file_name AS logoFile,
              COUNT(DISTINCT ug.game_id) AS count, AVG(ug.rating) AS avgRating
       FROM game_companies gc
       JOIN companies co ON co.id = gc.company_id
       JOIN user_game ug ON ug.game_id = gc.game_id AND ug.status = 'completed'
       LEFT JOIN images logo ON logo.id = co.logo_image_id
       WHERE gc.role = 'developer'
       GROUP BY co.id ORDER BY count DESC LIMIT 6`
    )
    .all() as TopDeveloperRow[]
  return rows
}

function getByDecade(db: Db): Stats['byDecade'] {
  return db
    .prepare(
      `SELECT (g.release_year / 10) * 10 AS decade, COUNT(*) AS count
       FROM games g JOIN user_game ug ON ug.game_id = g.id
       WHERE ug.status <> 'wishlist' AND g.release_year IS NOT NULL
       GROUP BY decade ORDER BY decade ASC`
    )
    .all() as Stats['byDecade']
}

function getOwnership(db: Db): Stats['ownership'] {
  const rows = db
    .prepare("SELECT ownership, COUNT(*) AS count FROM user_game WHERE status <> 'wishlist' GROUP BY ownership")
    .all() as Array<{ ownership: string; count: number }>
  const byKey = new Map(rows.map((r) => [r.ownership, r.count]))
  return OWNERSHIPS.map((ownership) => ({ ownership: ownership as Ownership, count: byKey.get(ownership) ?? 0 }))
}

export function getStats(): Stats {
  const db = getDb()
  const topPlaytime = queryCardsRaw(db, 'ug.playtime_minutes > 0', [], { orderBy: 'ug.playtime_minutes DESC', limit: 5 })
  const completedThisYearRow = db
    .prepare("SELECT COUNT(*) AS n FROM user_game WHERE status = 'completed' AND substr(finished_at,1,4) = strftime('%Y','now')")
    .get() as { n: number }
  const addedThisYearRow = db
    .prepare("SELECT COUNT(*) AS n FROM user_game WHERE substr(added_at,1,4) = strftime('%Y','now')")
    .get() as { n: number }

  const stats: Stats = {
    totals: getTotals(db),
    byStatus: getByStatus(db),
    completedByYear: getCompletedByYear(db),
    ratingHistogram: getRatingHistogram(db),
    topGenres: getTopGenres(db),
    topPlatforms: getTopPlatforms(db),
    topDevelopers: getTopDevelopers(db),
    topPlaytime,
    byDecade: getByDecade(db),
    ownership: getOwnership(db),
    completedThisYear: completedThisYearRow.n,
    addedThisYear: addedThisYearRow.n
  }
  return statsSchema.parse(stats)
}
