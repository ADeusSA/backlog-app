/**
 * Прогресс коллекции на уровне scope, БЕЗ учёта активных фильтров панели (07 §6).
 * Используется и каналом `collection.progress`, и полями `progress`/`playtimeMinutes`/
 * `yearFrom`/`yearTo` результата `collection.query` — они описывают весь scope
 * («100 игр · 412 ч · с 2021»), а не только текущий отфильтрованный срез.
 */
import type { Db } from '../connection'
import type { CollectionScope } from '@shared/schema/filters'
import { MAIN_LINE_CATEGORIES } from '@shared/constants'

export interface ScopeProgress {
  done: number
  total: number
  playtimeMinutes: number
  yearFrom: number | null
  yearTo: number | null
}

const EMPTY: ScopeProgress = { done: 0, total: 0, playtimeMinutes: 0, yearFrom: null, yearTo: null }

interface AggRow {
  done: number | null
  total: number | null
  playtime: number | null
  yearFrom: number | null
  yearTo: number | null
}

export function computeScopeProgress(db: Db, scope: CollectionScope): ScopeProgress {
  switch (scope.kind) {
    case 'library': {
      if (scope.status) {
        const row = db
          .prepare(
            `SELECT COUNT(*) AS total, COUNT(*) AS done, SUM(ug.playtime_minutes) AS playtime,
                    MIN(g.release_year) AS yearFrom, MAX(g.release_year) AS yearTo
             FROM user_game ug JOIN games g ON g.id = ug.game_id
             WHERE ug.status = ?`
          )
          .get(scope.status) as AggRow
        return toProgress(row)
      }
      const row = db
        .prepare(
          `SELECT SUM(ug.status = 'completed') AS done, SUM(ug.status <> 'wishlist') AS total,
                  SUM(ug.playtime_minutes) AS playtime, MIN(g.release_year) AS yearFrom, MAX(g.release_year) AS yearTo
           FROM user_game ug JOIN games g ON g.id = ug.game_id`
        )
        .get() as AggRow
      return toProgress(row)
    }
    case 'list': {
      const row = db
        .prepare(
          `SELECT SUM(CASE WHEN ug.status = 'completed' THEN 1 ELSE 0 END) AS done, COUNT(*) AS total,
                  SUM(COALESCE(ug.playtime_minutes, 0)) AS playtime,
                  MIN(g.release_year) AS yearFrom, MAX(g.release_year) AS yearTo
           FROM list_items li JOIN games g ON g.id = li.game_id LEFT JOIN user_game ug ON ug.game_id = g.id
           WHERE li.list_id = ?`
        )
        .get(scope.listId) as AggRow
      return toProgress(row)
    }
    case 'series': {
      const categoryFilter = scope.includeDlc
        ? '1 = 1'
        : `g.category IN (${MAIN_LINE_CATEGORIES.map(() => '?').join(',')})`
      const categoryParams = scope.includeDlc ? [] : [...MAIN_LINE_CATEGORIES]
      const row = db
        .prepare(
          `SELECT
             SUM(CASE WHEN ${categoryFilter} AND ug.status = 'completed' THEN 1 ELSE 0 END) AS done,
             SUM(CASE WHEN ${categoryFilter} THEN 1 ELSE 0 END) AS total,
             SUM(COALESCE(ug.playtime_minutes, 0)) AS playtime,
             MIN(g.release_year) AS yearFrom, MAX(g.release_year) AS yearTo
           FROM series_games sg JOIN games g ON g.id = sg.game_id LEFT JOIN user_game ug ON ug.game_id = g.id
           WHERE sg.series_id = ?`
        )
        .get(scope.seriesId, ...categoryParams, ...categoryParams) as AggRow
      return toProgress(row)
    }
    case 'company': {
      const roles = scope.roles && scope.roles.length > 0 ? scope.roles : null
      const roleFilter = roles ? ` AND gc.role IN (${roles.map(() => '?').join(',')})` : ''
      const roleParams = roles ?? []
      const myRow = db
        .prepare(
          `SELECT
             COUNT(DISTINCT CASE WHEN ug.status = 'completed' THEN g.id END) AS done,
             COUNT(DISTINCT g.id) AS total,
             SUM(COALESCE(ug.playtime_minutes, 0)) AS playtime
           FROM games g
           JOIN game_companies gc ON gc.game_id = g.id AND gc.company_id = ?${roleFilter}
           JOIN user_game ug ON ug.game_id = g.id AND ug.status <> 'wishlist'`
        )
        .get(scope.companyId, ...roleParams) as { done: number | null; total: number | null; playtime: number | null }
      const yearsRow = db
        .prepare(
          `SELECT MIN(g.release_year) AS yearFrom, MAX(g.release_year) AS yearTo
           FROM games g JOIN game_companies gc ON gc.game_id = g.id AND gc.company_id = ?${roleFilter}`
        )
        .get(scope.companyId, ...roleParams) as { yearFrom: number | null; yearTo: number | null }
      return {
        done: myRow.done ?? 0,
        total: myRow.total ?? 0,
        playtimeMinutes: myRow.playtime ?? 0,
        yearFrom: yearsRow.yearFrom,
        yearTo: yearsRow.yearTo
      }
    }
    case 'search':
    case 'catalog':
      return { ...EMPTY }
  }
}

function toProgress(row: AggRow): ScopeProgress {
  return {
    done: row.done ?? 0,
    total: row.total ?? 0,
    playtimeMinutes: row.playtime ?? 0,
    yearFrom: row.yearFrom,
    yearTo: row.yearTo
  }
}
