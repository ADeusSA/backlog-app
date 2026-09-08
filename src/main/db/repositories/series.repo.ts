/**
 * Репозиторий серий/франшиз (02 §3.6, 06 §4). DTO собирается одним запросом с
 * коррелированными подзапросами — по аналогии с `games.repo`/`collection.repo`.
 */
import type { Db } from '../connection'
import { type SeriesDto, seriesDtoSchema } from '@shared/schema/entities'
import { MAIN_LINE_CATEGORIES, type GameStatus, type SeriesKind } from '@shared/constants'

const MAIN_LINE_IN_SQL = `(${MAIN_LINE_CATEGORIES.map((c) => `'${c}'`).join(',')})`

/** Список колонок DTO серии — переиспользуется и в `companies.repo` (вкладка «Серии»). */
export const SERIES_DTO_COLUMNS_SQL = `
  s.id AS id,
  s.name AS name,
  s.slug AS slug,
  s.sort_name AS sortName,
  s.kind AS kind,
  s.description AS description,
  s.cover_image_id AS coverImageId,
  cover.file_name AS coverFile,
  s.banner_image_id AS bannerImageId,
  banner.file_name AS bannerFile,
  cover.dominant_color AS dominantColor,
  s.parent_series_id AS parentSeriesId,
  parent.name AS parentSeriesName,
  (SELECT COUNT(*) FROM series_games sg WHERE sg.series_id = s.id) AS gameCount,
  (SELECT COUNT(*) FROM series_games sg JOIN user_game ug ON ug.game_id = sg.game_id
     WHERE sg.series_id = s.id AND ug.status = 'completed') AS completedCount,
  (SELECT COUNT(*) FROM series_games sg JOIN games g2 ON g2.id = sg.game_id
     WHERE sg.series_id = s.id AND g2.category IN ${MAIN_LINE_IN_SQL}) AS mainLineCount,
  (SELECT MIN(g2.release_year) FROM series_games sg JOIN games g2 ON g2.id = sg.game_id WHERE sg.series_id = s.id) AS yearFrom,
  (SELECT MAX(g2.release_year) FROM series_games sg JOIN games g2 ON g2.id = sg.game_id WHERE sg.series_id = s.id) AS yearTo,
  (SELECT COALESCE(SUM(ug.playtime_minutes), 0) FROM series_games sg LEFT JOIN user_game ug ON ug.game_id = sg.game_id
     WHERE sg.series_id = s.id) AS playtimeMinutes,
  s.created_at AS createdAt,
  s.updated_at AS updatedAt
`

export const SERIES_DTO_FROM_SQL = `
  FROM series s
  LEFT JOIN images cover ON cover.id = s.cover_image_id
  LEFT JOIN images banner ON banner.id = s.banner_image_id
  LEFT JOIN series parent ON parent.id = s.parent_series_id
`

interface SeriesRow {
  id: string
  name: string
  slug: string
  sortName: string
  kind: string
  description: string | null
  coverImageId: string | null
  coverFile: string | null
  bannerImageId: string | null
  bannerFile: string | null
  dominantColor: string | null
  parentSeriesId: string | null
  parentSeriesName: string | null
  gameCount: number
  completedCount: number
  mainLineCount: number
  yearFrom: number | null
  yearTo: number | null
  playtimeMinutes: number
  createdAt: string
  updatedAt: string
}

function mapSeriesRow(row: SeriesRow, coverMosaic?: string[]): SeriesDto {
  return seriesDtoSchema.parse({
    ...row,
    kind: row.kind as SeriesKind,
    coverMosaic
  })
}

/** До 4 обложек игр серии (по позиции) — для мозаики карточки, если у серии нет своей обложки (06 §1.6, §4.1). */
export function getSeriesCoverMosaic(db: Db, seriesId: string, limit = 4): string[] {
  const rows = db
    .prepare(
      `SELECT img.file_name AS fileName FROM series_games sg
       JOIN games g ON g.id = sg.game_id
       LEFT JOIN images img ON img.id = g.cover_image_id
       WHERE sg.series_id = ? AND img.file_name IS NOT NULL
       ORDER BY sg.position LIMIT ?`
    )
    .all(seriesId, limit) as Array<{ fileName: string }>
  return rows.map((r) => r.fileName)
}

export function getSeriesDto(db: Db, id: string): SeriesDto | null {
  const row = db.prepare(`SELECT ${SERIES_DTO_COLUMNS_SQL} ${SERIES_DTO_FROM_SQL} WHERE s.id = ?`).get(id) as
    | SeriesRow
    | undefined
  if (!row) return null
  return mapSeriesRow(row, getSeriesCoverMosaic(db, id))
}

const SORT_EXPR: Record<'name' | 'games' | 'latest' | 'progress', string> = {
  name: 's.sort_name ASC',
  games: 'gameCount DESC, s.sort_name ASC',
  latest: '(yearTo IS NULL) ASC, yearTo DESC, s.sort_name ASC',
  progress: '(CASE WHEN gameCount > 0 THEN CAST(completedCount AS REAL) / gameCount ELSE -1 END) DESC, s.sort_name ASC'
}

export function listSeries(db: Db, opts: { q?: string; sort: 'name' | 'games' | 'latest' | 'progress' }): SeriesDto[] {
  const where: string[] = []
  const params: unknown[] = []
  if (opts.q?.trim()) {
    where.push('s.name LIKE ? ESCAPE \'\\\'')
    params.push(`%${opts.q.trim().replace(/[\\%_]/g, (c) => `\\${c}`)}%`)
  }
  const sql =
    `SELECT ${SERIES_DTO_COLUMNS_SQL} ${SERIES_DTO_FROM_SQL}` +
    (where.length > 0 ? ` WHERE ${where.join(' AND ')}` : '') +
    ` ORDER BY ${SORT_EXPR[opts.sort]}`
  const rows = db.prepare(sql).all(...params) as SeriesRow[]
  return rows.map((row) => mapSeriesRow(row, getSeriesCoverMosaic(db, row.id)))
}

export function getSeriesChildren(db: Db, parentId: string): SeriesDto[] {
  const rows = db
    .prepare(`SELECT ${SERIES_DTO_COLUMNS_SQL} ${SERIES_DTO_FROM_SQL} WHERE s.parent_series_id = ? ORDER BY s.sort_name`)
    .all(parentId) as SeriesRow[]
  return rows.map((row) => mapSeriesRow(row, getSeriesCoverMosaic(db, row.id)))
}

export function seriesExists(db: Db, id: string): boolean {
  return db.prepare('SELECT 1 FROM series WHERE id = ?').get(id) != null
}

export function seriesSlugTaken(db: Db, slug: string, excludeId?: string): boolean {
  return db.prepare('SELECT id FROM series WHERE slug = ? AND id <> ?').get(slug, excludeId ?? '') != null
}

export interface SeriesEditData {
  name: string
  kind: string
  sortName: string
  slug: string
  description: string | null
  coverImageId: string | null
  bannerImageId: string | null
  parentSeriesId: string | null
}

export function getSeriesEditData(db: Db, id: string): SeriesEditData | null {
  const row = db
    .prepare(
      `SELECT name, kind, sort_name AS sortName, slug, description, cover_image_id AS coverImageId,
              banner_image_id AS bannerImageId, parent_series_id AS parentSeriesId
       FROM series WHERE id = ?`
    )
    .get(id) as SeriesEditData | undefined
  return row ?? null
}

export interface SeriesWriteColumns {
  name: string
  kind: string
  sortName: string
  slug: string
  description: string | null
  coverImageId: string | null
  bannerImageId: string | null
  parentSeriesId: string | null
}

export function insertSeriesRow(db: Db, id: string, c: SeriesWriteColumns, nowTs: string): void {
  db.prepare(
    `INSERT INTO series(id, name, slug, sort_name, kind, description, cover_image_id, banner_image_id,
                         parent_series_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, c.name, c.slug, c.sortName, c.kind, c.description, c.coverImageId, c.bannerImageId, c.parentSeriesId, nowTs, nowTs)
}

export function updateSeriesRow(db: Db, id: string, c: SeriesWriteColumns, nowTs: string): void {
  db.prepare(
    `UPDATE series SET name = ?, slug = ?, sort_name = ?, kind = ?, description = ?, cover_image_id = ?,
                       banner_image_id = ?, parent_series_id = ?, updated_at = ?
     WHERE id = ?`
  ).run(c.name, c.slug, c.sortName, c.kind, c.description, c.coverImageId, c.bannerImageId, c.parentSeriesId, nowTs, id)
}

export function deleteSeriesRow(db: Db, id: string): void {
  db.prepare('DELETE FROM series WHERE id = ?').run(id)
}

/* ------------------------------------------------------- состав серии (series_games) */

export interface SeriesGameRow {
  gameId: string
  position: number
  label: string | null
  title: string
  releaseYear: number | null
  releaseDate: string | null
  coverFile: string | null
  status: string | null
}

export function getSeriesGames(db: Db, seriesId: string): SeriesGameRow[] {
  return db
    .prepare(
      `SELECT sg.game_id AS gameId, sg.position AS position, sg.label AS label, g.title AS title,
              g.release_year AS releaseYear, g.release_date AS releaseDate, cov.file_name AS coverFile,
              ug.status AS status
       FROM series_games sg
       JOIN games g ON g.id = sg.game_id
       LEFT JOIN images cov ON cov.id = g.cover_image_id
       LEFT JOIN user_game ug ON ug.game_id = sg.game_id
       WHERE sg.series_id = ?
       ORDER BY sg.position`
    )
    .all(seriesId) as SeriesGameRow[]
}

/** Перезаписывает позиции 1..N в порядке `orderedGameIds` (02 §4). Двухфазно — иначе конфликт `uq_series_games_pos`. */
export function renumberSeriesGames(db: Db, seriesId: string, orderedGameIds: string[]): void {
  const tempStmt = db.prepare('UPDATE series_games SET position = ? WHERE series_id = ? AND game_id = ?')
  orderedGameIds.forEach((gameId, i) => tempStmt.run(-(i + 1), seriesId, gameId))
  orderedGameIds.forEach((gameId, i) => tempStmt.run(i + 1, seriesId, gameId))
}

export function addGamesToSeries(db: Db, seriesId: string, gameIds: string[]): number {
  const maxRow = db.prepare('SELECT COALESCE(MAX(position), 0) AS p FROM series_games WHERE series_id = ?').get(seriesId) as {
    p: number
  }
  let next = maxRow.p
  const insert = db.prepare('INSERT OR IGNORE INTO series_games(series_id, game_id, position, is_primary) VALUES (?, ?, ?, 1)')
  let added = 0
  for (const gameId of gameIds) {
    next += 1
    const info = insert.run(seriesId, gameId, next)
    if (info.changes > 0) added += 1
    else next -= 1 // игра уже была в серии — не расходуем позицию
  }
  return added
}

export function removeGamesFromSeries(db: Db, seriesId: string, gameIds: string[]): void {
  if (gameIds.length === 0) return
  const ph = gameIds.map(() => '?').join(',')
  db.prepare(`DELETE FROM series_games WHERE series_id = ? AND game_id IN (${ph})`).run(seriesId, ...gameIds)
  const remaining = db
    .prepare('SELECT game_id AS gameId FROM series_games WHERE series_id = ? ORDER BY position')
    .all(seriesId) as Array<{ gameId: string }>
  renumberSeriesGames(db, seriesId, remaining.map((r) => r.gameId))
}

export function setSeriesGameLabel(db: Db, seriesId: string, gameId: string, label: string | null): void {
  db.prepare('UPDATE series_games SET label = ? WHERE series_id = ? AND game_id = ?').run(label, seriesId, gameId)
}

/** Перенумерация по дате выхода (06 §4.2 «Автонумерация»). NULL-даты — в конец. */
export function autoNumberSeries(db: Db, seriesId: string): void {
  const rows = db
    .prepare(
      `SELECT sg.game_id AS gameId FROM series_games sg JOIN games g ON g.id = sg.game_id
       WHERE sg.series_id = ?
       ORDER BY (g.release_date IS NULL) ASC, g.release_date ASC, g.sort_title ASC`
    )
    .all(seriesId) as Array<{ gameId: string }>
  renumberSeriesGames(db, seriesId, rows.map((r) => r.gameId))
}

export interface TimelineEntry {
  gameId: string
  title: string
  year: number | null
  coverFile: string | null
  status: GameStatus | null
}

export function getSeriesTimeline(db: Db, seriesId: string): TimelineEntry[] {
  const rows = db
    .prepare(
      `SELECT g.id AS gameId, g.title AS title, g.release_year AS year, cov.file_name AS coverFile, ug.status AS status
       FROM series_games sg
       JOIN games g ON g.id = sg.game_id
       LEFT JOIN images cov ON cov.id = g.cover_image_id
       LEFT JOIN user_game ug ON ug.game_id = sg.game_id
       WHERE sg.series_id = ?
       ORDER BY (g.release_date IS NULL) ASC, g.release_date ASC, sg.position ASC`
    )
    .all(seriesId) as TimelineEntry[]
  return rows
}
