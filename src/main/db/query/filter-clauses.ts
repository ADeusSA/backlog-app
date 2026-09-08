/**
 * Построение WHERE-фрагментов для каждой из 22 секций панели фильтров (07 §7).
 * Каждая функция параметризована — никакой конкатенации пользовательских строк в SQL.
 * Переиспользуется и билдером коллекции, и билдером фасетов (там секция сама себя исключает).
 */
import type { Filters } from '@shared/schema/filters'
import { likeContains } from './sql-fragments'

export interface Clause {
  sql: string
  params: unknown[]
}

function placeholders(n: number): string {
  return Array.from({ length: n }, () => '?').join(',')
}

function rangeClause(
  column: string,
  range: { min?: number | null; max?: number | null; includeNull?: boolean | null } | undefined
): Clause | null {
  if (!range) return null
  const { min, max, includeNull } = range
  if (min == null && max == null) return null
  const parts: string[] = []
  const params: unknown[] = []
  if (min != null && max != null) {
    parts.push(`${column} BETWEEN ? AND ?`)
    params.push(min, max)
  } else if (min != null) {
    parts.push(`${column} >= ?`)
    params.push(min)
  } else if (max != null) {
    parts.push(`${column} <= ?`)
    params.push(max)
  }
  let sql = parts.join(' AND ')
  if (includeNull) {
    sql = `(${sql} OR ${column} IS NULL)`
  }
  return { sql, params }
}

/** Секция «Часы наиграно»/произвольный диапазон без includeNull. */
function minMaxClause(
  column: string,
  range: { minMin?: number | null; maxMin?: number | null } | undefined
): Clause | null {
  if (!range) return null
  const { minMin, maxMin } = range
  if (minMin == null && maxMin == null) return null
  if (minMin != null && maxMin != null) return { sql: `${column} BETWEEN ? AND ?`, params: [minMin, maxMin] }
  if (minMin != null) return { sql: `${column} >= ?`, params: [minMin] }
  return { sql: `${column} <= ?`, params: [maxMin] }
}

const HLTB_BUCKET_SQL: Record<string, string> = {
  lt5: 'g.hltb_main_min IS NOT NULL AND g.hltb_main_min < 300',
  '5to15': 'g.hltb_main_min IS NOT NULL AND g.hltb_main_min >= 300 AND g.hltb_main_min < 900',
  '15to40': 'g.hltb_main_min IS NOT NULL AND g.hltb_main_min >= 900 AND g.hltb_main_min < 2400',
  gt40: 'g.hltb_main_min IS NOT NULL AND g.hltb_main_min >= 2400',
  unknown: 'g.hltb_main_min IS NULL'
}

function dateRangeClause(
  column: string,
  range: { from?: string | null; to?: string | null } | null | undefined,
  substrLen: number | null
): Clause | null {
  if (!range) return null
  const { from, to } = range
  if (!from && !to) return null
  const expr = substrLen ? `substr(${column},1,${substrLen})` : column
  const parts: string[] = []
  const params: unknown[] = []
  if (from) {
    parts.push(`${expr} >= ?`)
    params.push(from)
  }
  if (to) {
    parts.push(`${expr} <= ?`)
    params.push(to)
  }
  return { sql: parts.join(' AND '), params }
}

/**
 * Клауза одной секции фильтра. Возвращает `null`, если секция неактивна
 * (ключ отсутствует в объекте `filters` или пуста), — тогда секция не участвует в WHERE.
 */
export function buildFilterClause(section: keyof Filters, filters: Filters): Clause | null {
  switch (section) {
    case 'q': {
      const q = filters.q?.trim()
      if (!q) return null
      const like = likeContains(q)
      return {
        sql: "(g.title LIKE ? ESCAPE '\\' OR g.alt_titles_json LIKE ? ESCAPE '\\' OR g.sort_title LIKE ? ESCAPE '\\')",
        params: [like, like, like]
      }
    }
    case 'status': {
      const statuses = filters.status
      if (!statuses || statuses.length === 0) return null
      return { sql: `ug.status IN (${placeholders(statuses.length)})`, params: [...statuses] }
    }
    case 'flags': {
      const flags = filters.flags
      if (!flags) return null
      const parts: string[] = []
      const params: unknown[] = []
      if (flags.favorite === true) parts.push('ug.is_favorite = 1')
      else if (flags.favorite === false) parts.push('ug.is_favorite = 0')
      if (flags.mastered === true) parts.push('ug.is_mastered = 1')
      else if (flags.mastered === false) parts.push('ug.is_mastered = 0')
      if (flags.hasReview === true) parts.push("(ug.review IS NOT NULL AND ug.review <> '')")
      else if (flags.hasReview === false) parts.push("(ug.review IS NULL OR ug.review = '')")
      if (flags.unrated === true) parts.push('ug.rating IS NULL')
      else if (flags.unrated === false) parts.push('ug.rating IS NOT NULL')
      if (flags.prioritized === true) parts.push('ug.priority > 0')
      else if (flags.prioritized === false) parts.push('ug.priority = 0')
      if (parts.length === 0) return null
      return { sql: parts.join(' AND '), params }
    }
    case 'year':
      return rangeClause('g.release_year', filters.year)
    case 'genres': {
      const genres = filters.genres
      if (!genres || genres.ids.length === 0) return null
      const ph = placeholders(genres.ids.length)
      if (genres.mode === 'all') {
        return {
          sql: `(SELECT COUNT(DISTINCT gg.genre_id) FROM game_genres gg WHERE gg.game_id = g.id AND gg.genre_id IN (${ph})) = ?`,
          params: [...genres.ids, genres.ids.length]
        }
      }
      return { sql: `g.id IN (SELECT game_id FROM game_genres WHERE genre_id IN (${ph}))`, params: [...genres.ids] }
    }
    case 'platforms': {
      const ids = filters.platforms
      if (!ids || ids.length === 0) return null
      return { sql: `g.id IN (SELECT game_id FROM game_platforms WHERE platform_id IN (${placeholders(ids.length)}))`, params: [...ids] }
    }
    case 'myPlatforms': {
      const ids = filters.myPlatforms
      if (!ids || ids.length === 0) return null
      return { sql: `ug.platform_id IN (${placeholders(ids.length)})`, params: [...ids] }
    }
    case 'modes': {
      const ids = filters.modes
      if (!ids || ids.length === 0) return null
      return { sql: `g.id IN (SELECT game_id FROM game_modes WHERE mode_id IN (${placeholders(ids.length)}))`, params: [...ids] }
    }
    case 'developers': {
      const ids = filters.developers
      if (!ids || ids.length === 0) return null
      return {
        sql: `g.id IN (SELECT game_id FROM game_companies WHERE role = 'developer' AND company_id IN (${placeholders(ids.length)}))`,
        params: [...ids]
      }
    }
    case 'publishers': {
      const ids = filters.publishers
      if (!ids || ids.length === 0) return null
      return {
        sql: `g.id IN (SELECT game_id FROM game_companies WHERE role = 'publisher' AND company_id IN (${placeholders(ids.length)}))`,
        params: [...ids]
      }
    }
    case 'series': {
      const series = filters.series
      if (!series || (series.ids.length === 0 && !series.none)) return null
      const hasIds = series.ids.length > 0
      const hasNone = series.none === true
      if (hasIds && hasNone) {
        return {
          sql: `(g.id IN (SELECT game_id FROM series_games WHERE series_id IN (${placeholders(series.ids.length)})) OR g.id NOT IN (SELECT game_id FROM series_games))`,
          params: [...series.ids]
        }
      }
      if (hasIds) {
        return { sql: `g.id IN (SELECT game_id FROM series_games WHERE series_id IN (${placeholders(series.ids.length)}))`, params: [...series.ids] }
      }
      return { sql: 'g.id NOT IN (SELECT game_id FROM series_games)', params: [] }
    }
    case 'countries': {
      const codes = filters.countries
      if (!codes || codes.length === 0) return null
      return {
        sql: `g.id IN (SELECT gc.game_id FROM game_companies gc JOIN companies co ON co.id = gc.company_id WHERE gc.role = 'developer' AND co.country_code IN (${placeholders(codes.length)}))`,
        params: [...codes]
      }
    }
    case 'metacritic':
      return rangeClause('g.metacritic_score', filters.metacritic)
    case 'rating':
      return rangeClause('ug.rating', filters.rating)
    case 'playtime':
      return minMaxClause('ug.playtime_minutes', filters.playtime)
    case 'hltb': {
      const buckets = filters.hltb
      if (!buckets || buckets.length === 0) return null
      const parts = buckets.map((b) => `(${HLTB_BUCKET_SQL[b]})`)
      return { sql: `(${parts.join(' OR ')})`, params: [] }
    }
    case 'category': {
      const cats = filters.category
      if (!cats || cats.length === 0) return null
      return { sql: `g.category IN (${placeholders(cats.length)})`, params: [...cats] }
    }
    case 'releaseStatus': {
      const st = filters.releaseStatus
      if (!st || st.length === 0) return null
      return { sql: `g.release_status IN (${placeholders(st.length)})`, params: [...st] }
    }
    case 'ownership': {
      const own = filters.ownership
      if (!own || own.length === 0) return null
      return { sql: `ug.ownership IN (${placeholders(own.length)})`, params: [...own] }
    }
    case 'tags': {
      const ids = filters.tags
      if (!ids || ids.length === 0) return null
      return { sql: `g.id IN (SELECT game_id FROM game_tags WHERE tag_id IN (${placeholders(ids.length)}))`, params: [...ids] }
    }
    case 'lists': {
      const lists = filters.lists
      if (!lists || (!lists.in?.length && !lists.notIn?.length)) return null
      const parts: string[] = []
      const params: unknown[] = []
      if (lists.in && lists.in.length > 0) {
        parts.push(`g.id IN (SELECT game_id FROM list_items WHERE list_id IN (${placeholders(lists.in.length)}))`)
        params.push(...lists.in)
      }
      if (lists.notIn && lists.notIn.length > 0) {
        parts.push(`g.id NOT IN (SELECT game_id FROM list_items WHERE list_id IN (${placeholders(lists.notIn.length)}))`)
        params.push(...lists.notIn)
      }
      return { sql: parts.join(' AND '), params }
    }
    case 'dates': {
      const dates = filters.dates
      if (!dates) return null
      const clauses = [
        dateRangeClause('ug.added_at', dates.added, 10),
        dateRangeClause('ug.started_at', dates.started, null),
        dateRangeClause('ug.finished_at', dates.finished, null)
      ].filter((c): c is Clause => c != null && c.sql.length > 0)
      if (clauses.length === 0) return null
      return { sql: clauses.map((c) => `(${c.sql})`).join(' AND '), params: clauses.flatMap((c) => c.params) }
    }
  }
}

/** Все ключи секций в порядке документа 07 §7 (используется при обходе фильтров). */
export const FILTER_SECTION_KEYS: (keyof Filters)[] = [
  'q',
  'status',
  'flags',
  'year',
  'genres',
  'platforms',
  'myPlatforms',
  'modes',
  'developers',
  'publishers',
  'series',
  'countries',
  'metacritic',
  'rating',
  'playtime',
  'hltb',
  'category',
  'releaseStatus',
  'ownership',
  'tags',
  'lists',
  'dates'
]

/**
 * Собирает все активные клаузы фильтров, опционально исключая одну секцию
 * (для фасетного счётчика этой секции — 07 §7 «с учётом ВСЕХ остальных активных фильтров»).
 */
export function buildActiveClauses(filters: Filters, excludeSection?: keyof Filters): Clause[] {
  const clauses: Clause[] = []
  for (const key of FILTER_SECTION_KEYS) {
    if (key === excludeSection) continue
    const clause = buildFilterClause(key, filters)
    if (clause && clause.sql) clauses.push(clause)
  }
  return clauses
}
