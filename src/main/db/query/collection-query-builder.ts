/**
 * Билдер запроса коллекции игр (07 §5, §7, §8; 02 §5). Чистая функция:
 * `{ scope, filters, sort, groupBy } → { sql, params }`. Никакой конкатенации
 * пользовательских строк — все значения идут через параметры (`?`).
 *
 * Результат — плоские строки, соответствующие `GameCardDto` (пагинации нет: библиотека
 * одного пользователя мала, весь набор рендерится с виртуализацией на клиенте, 07 §8).
 */
import type { CollectionQuery } from '@shared/schema/filters'
import type { SortField } from '@shared/constants'
import { buildActiveClauses } from './filter-clauses'
import { buildScopeSql } from './scope-clause'
import {
  COMPLETENESS_SQL,
  DEVELOPER_SQL,
  GENRES_CONCAT_SQL,
  PLATFORMS_CONCAT_SQL,
  PRIMARY_GENRE_SQL,
  RANDOM_ORDER_SEED_ARITY,
  RANDOM_ORDER_SQL,
  SERIES_NAME_SQL,
  nullsLastTerm
} from './sql-fragments'

export interface BuiltQuery {
  sql: string
  params: unknown[]
}

/** Колонка сортировки для полей, у которых она не зависит от scope. */
const SORT_COLUMN: Partial<Record<SortField, string>> = {
  title: 'g.sort_title',
  release_date: 'g.release_date',
  added_at: 'ug.added_at',
  started_at: 'ug.started_at',
  finished_at: 'ug.finished_at',
  last_activity_at: 'ug.last_activity_at',
  rating: 'ug.rating',
  metacritic_score: 'g.metacritic_score',
  playtime_minutes: 'ug.playtime_minutes',
  hltb_main_min: 'g.hltb_main_min',
  priority: 'ug.priority',
  times_completed: 'ug.times_completed'
}

function buildSelectColumns(isCatalog: boolean, scopeExtra: { positionExpr: string; positionNoteExpr: string; positionLabelExpr: string }): string {
  return [
    'g.id AS id',
    'g.title AS title',
    'g.sort_title AS sortTitle',
    'g.release_year AS releaseYear',
    'g.release_date AS releaseDate',
    'g.category AS category',
    'g.parent_game_id AS parentGameId',
    'g.metacritic_score AS metacriticScore',
    'g.hltb_main_min AS hltbMainMin',
    'cov.file_name AS coverFile',
    'cov.dominant_color AS dominantColor',
    'ug.status AS status',
    'ug.rating AS rating',
    'ug.playtime_minutes AS playtimeMinutes',
    'COALESCE(ug.is_mastered, 0) AS isMastered',
    'COALESCE(ug.is_favorite, 0) AS isFavorite',
    'COALESCE(ug.priority, 0) AS priority',
    'ug.ownership AS ownership',
    'ug.added_at AS addedAt',
    'ug.started_at AS startedAt',
    'ug.finished_at AS finishedAt',
    'ug.last_activity_at AS lastActivityAt',
    `${GENRES_CONCAT_SQL} AS genres`,
    `${PRIMARY_GENRE_SQL} AS primaryGenre`,
    `${DEVELOPER_SQL} AS developer`,
    `${PLATFORMS_CONCAT_SQL} AS platforms`,
    'mp.short_name AS myPlatform',
    `${SERIES_NAME_SQL} AS seriesName`,
    `${scopeExtra.positionExpr} AS position`,
    `${scopeExtra.positionNoteExpr} AS positionNote`,
    `${scopeExtra.positionLabelExpr} AS positionLabel`,
    `${isCatalog ? COMPLETENESS_SQL : 'NULL'} AS completeness`
  ].join(',\n    ')
}

const GROUP_EXPR: Record<string, string> = {
  status: 'ug.status',
  year: 'g.release_year',
  genre: PRIMARY_GENRE_SQL,
  platform: 'mp.short_name',
  series: SERIES_NAME_SQL,
  developer: DEVELOPER_SQL,
  priority: 'ug.priority',
  finished_year: 'substr(ug.finished_at,1,4)'
}

function resolveSortExpr(field: Exclude<SortField, 'random'>, positionExpr: string): string {
  if (field === 'position') return positionExpr === 'NULL' ? 'g.sort_title' : positionExpr
  return SORT_COLUMN[field] ?? 'g.sort_title'
}

const NO_POSITION = { positionExpr: 'NULL', positionNoteExpr: 'NULL', positionLabelExpr: 'NULL' }

/**
 * Карточки по произвольному условию WHERE (без scope/фильтров панели) — используется
 * там, где нужен ровно тот же плоский формат `GameCardDto`, что и в коллекции, но вне
 * контекста панели фильтров: DLC/издания на странице игры, «от того же разработчика»,
 * быстрый поиск, диалог «Добавить игры» (02 §5, 06 §6.3).
 */
export function buildCardsQuery(whereSql: string, whereParams: unknown[], opts: { orderBy?: string; limit?: number } = {}): BuiltQuery {
  const cols = buildSelectColumns(false, NO_POSITION)
  const orderBy = opts.orderBy ?? 'g.sort_title ASC, g.id ASC'
  const limitSql = opts.limit != null ? ` LIMIT ${Math.max(0, Math.trunc(opts.limit))}` : ''
  return {
    sql:
      `SELECT\n    ${cols}\n` +
      'FROM games g\n' +
      'LEFT JOIN user_game ug ON ug.game_id = g.id\n' +
      'LEFT JOIN images cov ON cov.id = g.cover_image_id\n' +
      'LEFT JOIN platforms mp ON mp.id = ug.platform_id\n' +
      `WHERE ${whereSql}\n` +
      `ORDER BY ${orderBy}${limitSql}`,
    params: whereParams
  }
}

export function buildCollectionQuery(query: CollectionQuery): BuiltQuery {
  const { scope, filters, sort, groupBy } = query
  const scopeSql = buildScopeSql(scope)
  const clauses = buildActiveClauses(filters)

  const whereParts = [...scopeSql.where, ...clauses.map((c) => c.sql)]
  const params: unknown[] = [...scopeSql.params, ...clauses.flatMap((c) => c.params)]

  const isCatalog = scope.kind === 'catalog'
  const selectCols = buildSelectColumns(isCatalog, scopeSql)

  const orderTerms: string[] = []
  const orderParams: unknown[] = []

  if (groupBy && groupBy !== 'none') {
    const expr = GROUP_EXPR[groupBy]
    if (expr) orderTerms.push(nullsLastTerm(expr, 'asc'))
  }

  if (sort.field === 'random') {
    orderTerms.push(`${RANDOM_ORDER_SQL} ASC`)
    const seed = sort.seed ?? 0
    for (let i = 0; i < RANDOM_ORDER_SEED_ARITY; i += 1) orderParams.push(seed)
  } else {
    const expr = resolveSortExpr(sort.field, scopeSql.positionExpr)
    orderTerms.push(nullsLastTerm(expr, sort.dir))
  }
  // Вторичный ключ — всегда по названию, затем id (07 §5: детерминированный порядок).
  orderTerms.push('g.sort_title ASC')
  orderTerms.push('g.id ASC')

  const sql =
    `SELECT${scopeSql.distinct ? ' DISTINCT' : ''}\n    ${selectCols}\n` +
    `FROM ${scopeSql.from}\n` +
    'LEFT JOIN images cov ON cov.id = g.cover_image_id\n' +
    'LEFT JOIN platforms mp ON mp.id = ug.platform_id\n' +
    (whereParts.length > 0 ? `WHERE ${whereParts.join(' AND ')}\n` : '') +
    `ORDER BY ${orderTerms.join(', ')}`

  return { sql, params: [...params, ...orderParams] }
}
