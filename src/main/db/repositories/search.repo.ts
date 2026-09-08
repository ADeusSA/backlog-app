/**
 * Глобальный поиск (05 §6, 06 §9): FTS5 по `search_index` с деградацией до LIKE,
 * если FTS5 недоступен в сборке SQLite. Транслитерация — `searchVariants` (@shared/text),
 * чтобы «елден» находило «Elden Ring» и наоборот.
 */
import type { Db } from '../connection'
import { hasFts5 } from '../connection'
import { searchVariants } from '@shared/text'
import type { SearchResult } from '@shared/schema/entities'
import { queryCardsRaw } from './collection.repo'

interface EntityRef {
  entityType: string
  entityId: string
}

/** Строит выражение MATCH: варианты запроса объединяются через OR, слова внутри варианта — через AND, префиксно. */
function buildMatchExpr(q: string): string {
  const variants = searchVariants(q)
  const parts = variants
    .map((variant) => {
      const words = variant
        .split(/\s+/)
        .filter(Boolean)
        .map((w) => `"${w.replace(/"/g, '""')}"*`)
      return words.length > 0 ? `(${words.join(' AND ')})` : ''
    })
    .filter(Boolean)
  return parts.join(' OR ')
}

function ftsMatches(db: Db, q: string, limitTotal: number): EntityRef[] {
  const expr = buildMatchExpr(q)
  if (!expr) return []
  try {
    const rows = db
      .prepare(
        `SELECT entity_type AS entityType, entity_id AS entityId, bm25(search_index) AS rank
         FROM search_index WHERE search_index MATCH ? ORDER BY rank LIMIT ?`
      )
      .all(expr, limitTotal) as EntityRef[]
    return rows
  } catch {
    // Синтаксис MATCH не совпал (спецсимволы) — считаем, что совпадений нет, а не падаем.
    return []
  }
}

function orderByIds<T extends { id: string }>(items: T[], ids: string[]): T[] {
  const byId = new Map(items.map((i) => [i.id, i]))
  return ids.map((id) => byId.get(id)).filter((i): i is T => i != null)
}

export function searchAll(db: Db, q: string, limit: number): SearchResult {
  const query = q.trim()
  if (!query) return { games: [], series: [], companies: [], lists: [] }

  if (hasFts5()) return searchViaFts(db, query, limit)
  return searchViaLike(db, query, limit)
}

function searchViaFts(db: Db, query: string, limit: number): SearchResult {
  const matches = ftsMatches(db, query, limit * 8)
  const gameIds = matches.filter((m) => m.entityType === 'game').map((m) => m.entityId).slice(0, limit)
  const companyIds = matches.filter((m) => m.entityType === 'company').map((m) => m.entityId).slice(0, limit)
  const seriesIds = matches.filter((m) => m.entityType === 'series').map((m) => m.entityId).slice(0, limit)
  const listIds = matches.filter((m) => m.entityType === 'list').map((m) => m.entityId).slice(0, limit)

  const games = gameIds.length ? orderByIds(queryCardsRaw(db, `g.id IN (${gameIds.map(() => '?').join(',')})`, gameIds), gameIds) : []
  const companies = companyIds.length ? orderByIds(fetchCompanyRefs(db, companyIds), companyIds) : []
  const series = seriesIds.length ? orderByIds(fetchSeriesRefs(db, seriesIds), seriesIds) : []
  const lists = listIds.length ? orderByIds(fetchListRefs(db, listIds), listIds) : []

  return { games, series, companies, lists }
}

function searchViaLike(db: Db, query: string, limit: number): SearchResult {
  const variants = searchVariants(query)
  const games = queryCardsRaw(
    db,
    `(${variants.map(() => "(g.title LIKE ? ESCAPE '\\' OR g.alt_titles_json LIKE ? ESCAPE '\\')").join(' OR ')})`,
    variants.flatMap((v) => {
      const p = `%${v.replace(/[\\%_]/g, (c) => `\\${c}`)}%`
      return [p, p]
    }),
    { orderBy: 'g.sort_title ASC', limit }
  )

  const companies = (
    db
      .prepare(
        `SELECT c.id AS id, c.name AS name, logo.file_name AS logoFile,
                (SELECT COUNT(DISTINCT game_id) FROM game_companies WHERE company_id = c.id) AS gameCount
         FROM companies c LEFT JOIN images logo ON logo.id = c.logo_image_id
         WHERE ${variants.map(() => "c.name LIKE ? ESCAPE '\\'").join(' OR ')}
         ORDER BY c.sort_name LIMIT ?`
      )
      .all(...variants.map((v) => `%${v.replace(/[\\%_]/g, (c) => `\\${c}`)}%`), limit) as Array<{
      id: string
      name: string
      logoFile: string | null
      gameCount: number
    }>
  )

  const series = (
    db
      .prepare(
        `SELECT s.id AS id, s.name AS name, cover.file_name AS coverFile,
                (SELECT COUNT(*) FROM series_games WHERE series_id = s.id) AS gameCount
         FROM series s LEFT JOIN images cover ON cover.id = s.cover_image_id
         WHERE ${variants.map(() => "s.name LIKE ? ESCAPE '\\'").join(' OR ')}
         ORDER BY s.sort_name LIMIT ?`
      )
      .all(...variants.map((v) => `%${v.replace(/[\\%_]/g, (c) => `\\${c}`)}%`), limit) as Array<{
      id: string
      name: string
      coverFile: string | null
      gameCount: number
    }>
  )

  const lists = (
    db
      .prepare(
        `SELECT l.id AS id, l.name AS name, l.icon AS icon, l.color AS color,
                (SELECT COUNT(*) FROM list_items WHERE list_id = l.id) AS gameCount
         FROM lists l
         WHERE ${variants.map(() => "l.name LIKE ? ESCAPE '\\'").join(' OR ')}
         ORDER BY l.name COLLATE NOCASE LIMIT ?`
      )
      .all(...variants.map((v) => `%${v.replace(/[\\%_]/g, (c) => `\\${c}`)}%`), limit) as Array<{
      id: string
      name: string
      icon: string | null
      color: string | null
      gameCount: number
    }>
  )

  return { games, series, companies, lists }
}

function fetchCompanyRefs(db: Db, ids: string[]): Array<{ id: string; name: string; logoFile: string | null; gameCount: number }> {
  const ph = ids.map(() => '?').join(',')
  return db
    .prepare(
      `SELECT c.id AS id, c.name AS name, logo.file_name AS logoFile,
              (SELECT COUNT(DISTINCT game_id) FROM game_companies WHERE company_id = c.id) AS gameCount
       FROM companies c LEFT JOIN images logo ON logo.id = c.logo_image_id WHERE c.id IN (${ph})`
    )
    .all(...ids) as Array<{ id: string; name: string; logoFile: string | null; gameCount: number }>
}

function fetchSeriesRefs(db: Db, ids: string[]): Array<{ id: string; name: string; coverFile: string | null; gameCount: number }> {
  const ph = ids.map(() => '?').join(',')
  return db
    .prepare(
      `SELECT s.id AS id, s.name AS name, cover.file_name AS coverFile,
              (SELECT COUNT(*) FROM series_games WHERE series_id = s.id) AS gameCount
       FROM series s LEFT JOIN images cover ON cover.id = s.cover_image_id WHERE s.id IN (${ph})`
    )
    .all(...ids) as Array<{ id: string; name: string; coverFile: string | null; gameCount: number }>
}

function fetchListRefs(
  db: Db,
  ids: string[]
): Array<{ id: string; name: string; icon: string | null; color: string | null; gameCount: number }> {
  const ph = ids.map(() => '?').join(',')
  return db
    .prepare(
      `SELECT l.id AS id, l.name AS name, l.icon AS icon, l.color AS color,
              (SELECT COUNT(*) FROM list_items WHERE list_id = l.id) AS gameCount
       FROM lists l WHERE l.id IN (${ph})`
    )
    .all(...ids) as Array<{ id: string; name: string; icon: string | null; color: string | null; gameCount: number }>
}

/** Полная переиндексация `search_index` (канал `search.reindex`, 05 §6). */
export function reindexAll(db: Db, upsert: (entityType: 'game' | 'company' | 'series' | 'list', id: string, title: string, altTitles: string[]) => void): number {
  db.prepare('DELETE FROM search_index').run()
  let rows = 0
  for (const g of db.prepare('SELECT id, title, alt_titles_json FROM games').all() as Array<{
    id: string
    title: string
    alt_titles_json: string
  }>) {
    let alt: string[] = []
    try {
      alt = JSON.parse(g.alt_titles_json) as string[]
    } catch {
      alt = []
    }
    upsert('game', g.id, g.title, alt)
    rows += 1
  }
  for (const c of db.prepare('SELECT id, name FROM companies').all() as Array<{ id: string; name: string }>) {
    upsert('company', c.id, c.name, [])
    rows += 1
  }
  for (const s of db.prepare('SELECT id, name FROM series').all() as Array<{ id: string; name: string }>) {
    upsert('series', s.id, s.name, [])
    rows += 1
  }
  for (const l of db.prepare('SELECT id, name FROM lists').all() as Array<{ id: string; name: string }>) {
    upsert('list', l.id, l.name, [])
    rows += 1
  }
  return rows
}
