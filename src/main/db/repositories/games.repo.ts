/**
 * Репозиторий каталога игр: карточка (переиспользует билдер коллекции), полная страница
 * игры «одним запросом» (06 §6.4) и служебные выборки для формы модерации (06 §7.3).
 */
import type { Db } from '../connection'
import { parseJson, toBool } from '../utils'
import { queryCardsRaw, queryCollectionCards } from './collection.repo'
import { getUserGameDto } from './user-game.repo'
import { getTagsForGame } from './taxonomy.repo'
import { listExternalIds } from '../../services/field-provenance.service'
import {
  type ActivityType,
  CATEGORIES_WITH_PARENT,
  type GameCategory,
  type ReleaseDatePrecision,
  type ReleaseStatus
} from '@shared/constants'
import { type GameDetail, gameDetailSchema } from '@shared/schema/entities'

export interface GameRow {
  id: string
  title: string
  sort_title: string
  slug: string
  alt_titles_json: string
  category: string
  parent_game_id: string | null
  release_date: string | null
  release_date_precision: string
  release_year: number | null
  release_status: string
  summary: string | null
  storyline: string | null
  cover_image_id: string | null
  backdrop_image_id: string | null
  logo_image_id: string | null
  metacritic_score: number | null
  metacritic_url: string | null
  opencritic_score: number | null
  igdb_rating: number | null
  hltb_main_min: number | null
  hltb_extra_min: number | null
  hltb_complete_min: number | null
  age_rating: string | null
  website: string | null
  created_at: string
  updated_at: string
}

export function getGameRow(db: Db, id: string): GameRow | undefined {
  return db.prepare('SELECT * FROM games WHERE id = ?').get(id) as GameRow | undefined
}

export function gameExists(db: Db, id: string): boolean {
  return getGameRow(db, id) != null
}

export function slugTaken(db: Db, slug: string, excludeId?: string): boolean {
  const row = db.prepare('SELECT id FROM games WHERE slug = ? AND id <> ?').get(slug, excludeId ?? '') as { id: string } | undefined
  return row != null
}

/* --------------------------------------------------------- страница игры (06 §6.4) */

const DLC_CATEGORIES: GameCategory[] = ['dlc', 'expansion', 'standalone_expansion', 'bundle', 'mod', 'episode', 'season']
const EDITION_CATEGORIES: GameCategory[] = ['remake', 'remaster', 'port']

export function getGameDetail(db: Db, id: string): GameDetail | null {
  const row = getGameRow(db, id)
  if (!row) return null

  const parent = row.parent_game_id
    ? (db
        .prepare('SELECT g.id, g.title, cov.file_name AS coverFile FROM games g LEFT JOIN images cov ON cov.id = g.cover_image_id WHERE g.id = ?')
        .get(row.parent_game_id) as { id: string; title: string; coverFile: string | null } | undefined)
    : undefined

  const companies = db
    .prepare(
      `SELECT co.id, co.name, gc.role, co.country_code AS countryCode, cov.file_name AS logoFile
       FROM game_companies gc JOIN companies co ON co.id = gc.company_id
       LEFT JOIN images cov ON cov.id = co.logo_image_id
       WHERE gc.game_id = ? ORDER BY gc.role, co.sort_name`
    )
    .all(id) as Array<{ id: string; name: string; role: string; countryCode: string | null; logoFile: string | null }>

  const genres = db
    .prepare(
      `SELECT ge.id, ge.name, gg.is_primary AS isPrimary FROM game_genres gg
       JOIN genres ge ON ge.id = gg.genre_id WHERE gg.game_id = ? ORDER BY gg.is_primary DESC, ge.name`
    )
    .all(id) as Array<{ id: string; name: string; isPrimary: number }>

  const platforms = db
    .prepare(
      `SELECT p.id, p.name, p.short_name AS shortName FROM game_platforms gp
       JOIN platforms p ON p.id = gp.platform_id WHERE gp.game_id = ? ORDER BY p.sort_order`
    )
    .all(id) as Array<{ id: string; name: string; shortName: string }>

  const modes = db
    .prepare(`SELECT m.id, m.name FROM game_modes gm JOIN modes m ON m.id = gm.mode_id WHERE gm.game_id = ? ORDER BY m.sort_order`)
    .all(id) as Array<{ id: string; name: string }>

  const seriesRow = db
    .prepare(
      `SELECT sg.series_id AS seriesId, sg.position AS position, sg.label AS label, s.name AS name
       FROM series_games sg JOIN series s ON s.id = sg.series_id WHERE sg.game_id = ? AND sg.is_primary = 1 LIMIT 1`
    )
    .get(id) as { seriesId: string; position: number; label: string | null; name: string } | undefined

  let series: GameDetail['series'] = null
  if (seriesRow) {
    const totalRow = db.prepare('SELECT COUNT(*) AS n FROM series_games WHERE series_id = ?').get(seriesRow.seriesId) as { n: number }
    const games = queryCollectionCards(db, {
      scope: { kind: 'series', seriesId: seriesRow.seriesId },
      filters: {},
      sort: { field: 'position', dir: 'asc' }
    })
    series = { id: seriesRow.seriesId, name: seriesRow.name, position: seriesRow.position, total: totalRow.n, label: seriesRow.label, games }
  }

  const dlc = queryCardsRaw(db, 'g.parent_game_id = ? AND g.category IN (' + DLC_CATEGORIES.map(() => '?').join(',') + ')', [
    id,
    ...DLC_CATEGORIES
  ])
  const editions = queryCardsRaw(db, 'g.parent_game_id = ? AND g.category IN (' + EDITION_CATEGORIES.map(() => '?').join(',') + ')', [
    id,
    ...EDITION_CATEGORIES
  ])

  const developerIds = companies.filter((c) => c.role === 'developer').map((c) => c.id)
  const sameDeveloper =
    developerIds.length > 0
      ? queryCardsRaw(
          db,
          `g.id <> ? AND g.id IN (SELECT game_id FROM game_companies WHERE role = 'developer' AND company_id IN (${developerIds
            .map(() => '?')
            .join(',')}))`,
          [id, ...developerIds],
          { orderBy: 'g.release_date DESC, g.sort_title ASC', limit: 6 }
        )
      : []

  const lists = db
    .prepare(
      `SELECT l.id, l.name, l.color, l.icon FROM list_items li JOIN lists l ON l.id = li.list_id WHERE li.game_id = ? ORDER BY l.sort_order`
    )
    .all(id) as Array<{ id: string; name: string; color: string | null; icon: string | null }>

  const activityRows = db
    .prepare('SELECT id, happened_at AS happenedAt, type, payload_json AS payloadJson FROM activity_log WHERE game_id = ? ORDER BY happened_at DESC LIMIT 100')
    .all(id) as Array<{ id: string; happenedAt: string; type: string; payloadJson: string }>

  const detail: GameDetail = {
    id: row.id,
    title: row.title,
    sortTitle: row.sort_title,
    slug: row.slug,
    altTitles: parseJson<string[]>(row.alt_titles_json, []),
    category: row.category as GameCategory,
    parent: parent ? { id: parent.id, title: parent.title, coverFile: parent.coverFile } : null,
    releaseDate: row.release_date,
    releaseDatePrecision: row.release_date_precision as ReleaseDatePrecision,
    releaseYear: row.release_year,
    releaseStatus: row.release_status as ReleaseStatus,
    summary: row.summary,
    storyline: row.storyline,
    coverImageId: row.cover_image_id,
    coverFile: null,
    backdropImageId: row.backdrop_image_id,
    backdropFile: null,
    logoImageId: row.logo_image_id,
    logoFile: null,
    dominantColor: null,
    metacriticScore: row.metacritic_score,
    metacriticUrl: row.metacritic_url,
    opencriticScore: row.opencritic_score,
    igdbRating: row.igdb_rating,
    hltbMainMin: row.hltb_main_min,
    hltbExtraMin: row.hltb_extra_min,
    hltbCompleteMin: row.hltb_complete_min,
    ageRating: row.age_rating,
    website: row.website,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    companies: companies.map((c) => ({
      id: c.id,
      name: c.name,
      role: c.role as GameDetail['companies'][number]['role'],
      countryCode: c.countryCode,
      logoFile: c.logoFile
    })),
    genres: genres.map((g) => ({ id: g.id, name: g.name, isPrimary: toBool(g.isPrimary) })),
    platforms,
    modes,
    tags: getTagsForGame(db, id),
    userGame: getUserGameDto(db, id),
    series,
    dlc,
    editions,
    sameDeveloper,
    lists,
    activity: activityRows.map((a) => ({
      id: a.id,
      happenedAt: a.happenedAt,
      type: a.type as ActivityType,
      payload: parseJson<Record<string, unknown>>(a.payloadJson, {})
    })),
    sources: listExternalIds(db, 'game', id).map((source) => ({
      provider: source.provider,
      url: source.url,
      syncedAt: source.syncedAt
    }))
  }
  // Изображения (обложка/фон/лого/dominant_color) подставляются отдельно, чтобы не плодить
  // одинаковые LEFT JOIN images — один запрос на все три id сразу.
  applyImageFiles(db, detail)
  return gameDetailSchema.parse(detail)
}

function applyImageFiles(db: Db, detail: GameDetail): void {
  const ids = [detail.coverImageId, detail.backdropImageId, detail.logoImageId].filter((v): v is string => v != null)
  if (ids.length === 0) return
  const rows = db
    .prepare(`SELECT id, file_name AS fileName, dominant_color AS dominantColor FROM images WHERE id IN (${ids.map(() => '?').join(',')})`)
    .all(...ids) as Array<{ id: string; fileName: string; dominantColor: string | null }>
  const byId = new Map(rows.map((r) => [r.id, r]))
  if (detail.coverImageId) {
    const img = byId.get(detail.coverImageId)
    detail.coverFile = img?.fileName ?? null
    detail.dominantColor = img?.dominantColor ?? null
  }
  if (detail.backdropImageId) detail.backdropFile = byId.get(detail.backdropImageId)?.fileName ?? null
  if (detail.logoImageId) detail.logoFile = byId.get(detail.logoImageId)?.fileName ?? null
}

/* -------------------------------------------------------- быстрый поиск / похожие */

export function quickSearchGames(db: Db, q: string, opts: { limit: number; onlyLibrary?: boolean; excludeIds?: string[] }): ReturnType<typeof queryCardsRaw> {
  const like = `%${q.trim().replace(/[\\%_]/g, (c) => `\\${c}`)}%`
  const parts = ["(g.title LIKE ? ESCAPE '\\' OR g.alt_titles_json LIKE ? ESCAPE '\\')"]
  const params: unknown[] = [like, like]
  if (opts.onlyLibrary) parts.push('g.id IN (SELECT game_id FROM user_game)')
  if (opts.excludeIds && opts.excludeIds.length > 0) {
    parts.push(`g.id NOT IN (${opts.excludeIds.map(() => '?').join(',')})`)
    params.push(...opts.excludeIds)
  }
  return queryCardsRaw(db, parts.join(' AND '), params, { orderBy: 'g.sort_title ASC, g.id ASC', limit: opts.limit })
}

export function findSimilarTitles(db: Db, title: string, excludeId?: string): Array<{ id: string; title: string; releaseYear: number | null }> {
  const like = `%${title.trim().replace(/[\\%_]/g, (c) => `\\${c}`)}%`
  const rows = db
    .prepare(
      `SELECT id, title, release_year AS releaseYear FROM games
       WHERE title LIKE ? ESCAPE '\\' AND id <> ? ORDER BY sort_title LIMIT 8`
    )
    .all(like, excludeId ?? '') as Array<{ id: string; title: string; releaseYear: number | null }>
  return rows
}

/** Категории, для которых форма каталога требует указать родительскую игру (06 §7.3). */
export const CATEGORIES_REQUIRING_PARENT = CATEGORIES_WITH_PARENT

/* ------------------------------------------------------- форма модерации (06 §7.3) */

export interface GameEditData {
  title: string
  sortTitle: string
  slug: string
  altTitles: string[]
  category: string
  parentGameId: string | null
  releaseDate: string | null
  releaseDatePrecision: string
  releaseStatus: string
  summary: string | null
  storyline: string | null
  coverImageId: string | null
  backdropImageId: string | null
  logoImageId: string | null
  metacriticScore: number | null
  metacriticUrl: string | null
  opencriticScore: number | null
  hltbMainMin: number | null
  hltbExtraMin: number | null
  hltbCompleteMin: number | null
  ageRating: string | null
  website: string | null
  developerIds: string[]
  publisherIds: string[]
  supportingIds: string[]
  portingIds: string[]
  genreIds: string[]
  primaryGenreId: string | null
  platformIds: string[]
  modeIds: string[]
  tagIds: string[]
  seriesId: string | null
  seriesPosition: number | null
}

function companyIdsByRole(db: Db, gameId: string, role: string): string[] {
  const rows = db.prepare('SELECT company_id FROM game_companies WHERE game_id = ? AND role = ?').all(gameId, role) as Array<{
    company_id: string
  }>
  return rows.map((r) => r.company_id)
}

export function getGameEditData(db: Db, id: string): GameEditData | null {
  const row = getGameRow(db, id)
  if (!row) return null
  const genreRows = db.prepare('SELECT genre_id, is_primary FROM game_genres WHERE game_id = ?').all(id) as Array<{
    genre_id: string
    is_primary: number
  }>
  const platformRows = db.prepare('SELECT platform_id FROM game_platforms WHERE game_id = ?').all(id) as Array<{ platform_id: string }>
  const modeRows = db.prepare('SELECT mode_id FROM game_modes WHERE game_id = ?').all(id) as Array<{ mode_id: string }>
  const tagRows = db.prepare('SELECT tag_id FROM game_tags WHERE game_id = ?').all(id) as Array<{ tag_id: string }>
  const seriesRow = db
    .prepare('SELECT series_id, position FROM series_games WHERE game_id = ? AND is_primary = 1 LIMIT 1')
    .get(id) as { series_id: string; position: number } | undefined

  return {
    title: row.title,
    sortTitle: row.sort_title,
    slug: row.slug,
    altTitles: parseJson<string[]>(row.alt_titles_json, []),
    category: row.category,
    parentGameId: row.parent_game_id,
    releaseDate: row.release_date,
    releaseDatePrecision: row.release_date_precision,
    releaseStatus: row.release_status,
    summary: row.summary,
    storyline: row.storyline,
    coverImageId: row.cover_image_id,
    backdropImageId: row.backdrop_image_id,
    logoImageId: row.logo_image_id,
    metacriticScore: row.metacritic_score,
    metacriticUrl: row.metacritic_url,
    opencriticScore: row.opencritic_score,
    hltbMainMin: row.hltb_main_min,
    hltbExtraMin: row.hltb_extra_min,
    hltbCompleteMin: row.hltb_complete_min,
    ageRating: row.age_rating,
    website: row.website,
    developerIds: companyIdsByRole(db, id, 'developer'),
    publisherIds: companyIdsByRole(db, id, 'publisher'),
    supportingIds: companyIdsByRole(db, id, 'supporting'),
    portingIds: companyIdsByRole(db, id, 'porting'),
    genreIds: genreRows.map((g) => g.genre_id),
    primaryGenreId: genreRows.find((g) => toBool(g.is_primary))?.genre_id ?? null,
    platformIds: platformRows.map((p) => p.platform_id),
    modeIds: modeRows.map((m) => m.mode_id),
    tagIds: tagRows.map((t) => t.tag_id),
    seriesId: seriesRow?.series_id ?? null,
    seriesPosition: seriesRow?.position ?? null
  }
}

/* ---------------------------------------------------------------- запись (write) */

export interface GameWriteColumns {
  title: string
  sortTitle: string
  slug: string
  altTitlesJson: string
  category: string
  parentGameId: string | null
  releaseDate: string | null
  releaseDatePrecision: string
  releaseYear: number | null
  releaseStatus: string
  summary: string | null
  storyline: string | null
  coverImageId: string | null
  backdropImageId: string | null
  logoImageId: string | null
  metacriticScore: number | null
  metacriticUrl: string | null
  opencriticScore: number | null
  hltbMainMin: number | null
  hltbExtraMin: number | null
  hltbCompleteMin: number | null
  ageRating: string | null
  website: string | null
}

export function insertGameRow(db: Db, id: string, c: GameWriteColumns, nowTs: string): void {
  db.prepare(
    `INSERT INTO games(
       id, title, sort_title, slug, alt_titles_json, category, parent_game_id, release_date,
       release_date_precision, release_year, release_status, summary, storyline, cover_image_id,
       backdrop_image_id, logo_image_id, metacritic_score, metacritic_url, opencritic_score,
       hltb_main_min, hltb_extra_min, hltb_complete_min, age_rating, website, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    c.title,
    c.sortTitle,
    c.slug,
    c.altTitlesJson,
    c.category,
    c.parentGameId,
    c.releaseDate,
    c.releaseDatePrecision,
    c.releaseYear,
    c.releaseStatus,
    c.summary,
    c.storyline,
    c.coverImageId,
    c.backdropImageId,
    c.logoImageId,
    c.metacriticScore,
    c.metacriticUrl,
    c.opencriticScore,
    c.hltbMainMin,
    c.hltbExtraMin,
    c.hltbCompleteMin,
    c.ageRating,
    c.website,
    nowTs,
    nowTs
  )
}

export function updateGameRow(db: Db, id: string, c: GameWriteColumns, nowTs: string): void {
  db.prepare(
    `UPDATE games SET
       title = ?, sort_title = ?, slug = ?, alt_titles_json = ?, category = ?, parent_game_id = ?,
       release_date = ?, release_date_precision = ?, release_year = ?, release_status = ?, summary = ?,
       storyline = ?, cover_image_id = ?, backdrop_image_id = ?, logo_image_id = ?, metacritic_score = ?,
       metacritic_url = ?, opencritic_score = ?, hltb_main_min = ?, hltb_extra_min = ?, hltb_complete_min = ?,
       age_rating = ?, website = ?, updated_at = ?
     WHERE id = ?`
  ).run(
    c.title,
    c.sortTitle,
    c.slug,
    c.altTitlesJson,
    c.category,
    c.parentGameId,
    c.releaseDate,
    c.releaseDatePrecision,
    c.releaseYear,
    c.releaseStatus,
    c.summary,
    c.storyline,
    c.coverImageId,
    c.backdropImageId,
    c.logoImageId,
    c.metacriticScore,
    c.metacriticUrl,
    c.opencriticScore,
    c.hltbMainMin,
    c.hltbExtraMin,
    c.hltbCompleteMin,
    c.ageRating,
    c.website,
    nowTs,
    id
  )
}

export function deleteGameRow(db: Db, id: string): void {
  db.prepare('DELETE FROM games WHERE id = ?').run(id)
}

export function setGameGenreLinks(db: Db, gameId: string, genreIds: string[], primaryGenreId: string | null): void {
  db.prepare('DELETE FROM game_genres WHERE game_id = ?').run(gameId)
  const stmt = db.prepare('INSERT OR IGNORE INTO game_genres(game_id, genre_id, is_primary) VALUES (?, ?, ?)')
  for (const genreId of genreIds) stmt.run(gameId, genreId, genreId === primaryGenreId ? 1 : 0)
}

export function setGamePlatformLinks(db: Db, gameId: string, platformIds: string[]): void {
  db.prepare('DELETE FROM game_platforms WHERE game_id = ?').run(gameId)
  const stmt = db.prepare('INSERT OR IGNORE INTO game_platforms(game_id, platform_id) VALUES (?, ?)')
  for (const platformId of platformIds) stmt.run(gameId, platformId)
}

export function setGameModeLinks(db: Db, gameId: string, modeIds: string[]): void {
  db.prepare('DELETE FROM game_modes WHERE game_id = ?').run(gameId)
  const stmt = db.prepare('INSERT OR IGNORE INTO game_modes(game_id, mode_id) VALUES (?, ?)')
  for (const modeId of modeIds) stmt.run(gameId, modeId)
}

export interface CompanyRoleIds {
  developer: string[]
  publisher: string[]
  supporting: string[]
  porting: string[]
}

export function setGameCompanyLinks(db: Db, gameId: string, roles: CompanyRoleIds): void {
  db.prepare('DELETE FROM game_companies WHERE game_id = ?').run(gameId)
  const stmt = db.prepare('INSERT OR IGNORE INTO game_companies(game_id, company_id, role) VALUES (?, ?, ?)')
  for (const [role, ids] of Object.entries(roles) as Array<[keyof CompanyRoleIds, string[]]>) {
    for (const companyId of ids) stmt.run(gameId, companyId, role)
  }
}

/** Привязывает игру к серии (единственная «основная» серия из формы каталога, 06 §7.3). */
export function setGameSeriesLink(db: Db, gameId: string, seriesId: string | null, position?: number | null): void {
  db.prepare('DELETE FROM series_games WHERE game_id = ?').run(gameId)
  if (!seriesId) return
  let pos = position ?? null
  const takenOrMissing = (): number => {
    const row = db.prepare('SELECT COALESCE(MAX(position), 0) + 1 AS p FROM series_games WHERE series_id = ?').get(seriesId) as { p: number }
    return row.p
  }
  if (pos == null) {
    pos = takenOrMissing()
  } else {
    const taken = db.prepare('SELECT 1 FROM series_games WHERE series_id = ? AND position = ?').get(seriesId, pos)
    if (taken) pos = takenOrMissing()
  }
  db.prepare('INSERT INTO series_games(series_id, game_id, position, is_primary) VALUES (?, ?, ?, 1)').run(seriesId, gameId, pos)
}
