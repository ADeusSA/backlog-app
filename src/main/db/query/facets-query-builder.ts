/**
 * Билдер фасетных счётчиков (07 §7: «каждый чип показывает счётчик совпадений с учётом
 * остальных активных фильтров»). Для секции считаем WHERE = scope + все фильтры КРОМЕ
 * этой секции, группируем по значению измерения этой секции.
 *
 * Ключи фасетов согласно ТЗ: status, genres, platforms, myPlatforms, modes, developers,
 * publishers, series, countries, category, releaseStatus, ownership, tags, hltb, flags, lists.
 */
import type { CollectionScope, Filters } from '@shared/schema/filters'
import type { BuiltQuery } from './collection-query-builder'
import { buildActiveClauses } from './filter-clauses'
import { buildScopeSql } from './scope-clause'

export type FacetSectionKey =
  | 'status'
  | 'genres'
  | 'platforms'
  | 'myPlatforms'
  | 'modes'
  | 'developers'
  | 'publishers'
  | 'series'
  | 'countries'
  | 'category'
  | 'releaseStatus'
  | 'ownership'
  | 'tags'
  | 'hltb'
  | 'flags'
  | 'lists'

export const FACET_SECTION_KEYS: FacetSectionKey[] = [
  'status',
  'genres',
  'platforms',
  'myPlatforms',
  'modes',
  'developers',
  'publishers',
  'series',
  'countries',
  'category',
  'releaseStatus',
  'ownership',
  'tags',
  'hltb',
  'flags',
  'lists'
]

function baseWhere(scope: CollectionScope, filters: Filters, excludeSection: FacetSectionKey): { where: string; params: unknown[] } {
  const scopeSql = buildScopeSql(scope)
  const clauses = buildActiveClauses(filters, excludeSection)
  const parts = [...scopeSql.where, ...clauses.map((c) => c.sql)]
  const params = [...scopeSql.params, ...clauses.flatMap((c) => c.params)]
  return { where: parts.length > 0 ? `WHERE ${parts.join(' AND ')}` : '', params }
}

export function buildFacetQuery(section: FacetSectionKey, scope: CollectionScope, filters: Filters): BuiltQuery {
  const scopeSql = buildScopeSql(scope)
  const { where, params } = baseWhere(scope, filters, section)
  const from = `FROM ${scopeSql.from}\n`

  switch (section) {
    case 'status':
      return {
        sql: `SELECT ug.status AS key, COUNT(DISTINCT g.id) AS count\n${from}${joinAnd(where, 'ug.status IS NOT NULL')}\nGROUP BY ug.status`,
        params
      }
    case 'genres':
      return {
        sql:
          'SELECT ge.id AS key, COUNT(DISTINCT g.id) AS count\n' +
          from +
          'JOIN game_genres gg_f ON gg_f.game_id = g.id\n' +
          'JOIN genres ge ON ge.id = gg_f.genre_id\n' +
          `${where}\nGROUP BY ge.id`,
        params
      }
    case 'platforms':
      return {
        sql:
          'SELECT p_f.id AS key, COUNT(DISTINCT g.id) AS count\n' +
          from +
          'JOIN game_platforms gp_f ON gp_f.game_id = g.id\n' +
          'JOIN platforms p_f ON p_f.id = gp_f.platform_id\n' +
          `${where}\nGROUP BY p_f.id`,
        params
      }
    case 'myPlatforms':
      return {
        sql:
          'SELECT mp_f.id AS key, COUNT(DISTINCT g.id) AS count\n' +
          from +
          'JOIN platforms mp_f ON mp_f.id = ug.platform_id\n' +
          `${joinAnd(where, 'ug.platform_id IS NOT NULL')}\nGROUP BY mp_f.id`,
        params
      }
    case 'modes':
      return {
        sql:
          'SELECT m_f.id AS key, COUNT(DISTINCT g.id) AS count\n' +
          from +
          'JOIN game_modes gm_f ON gm_f.game_id = g.id\n' +
          'JOIN modes m_f ON m_f.id = gm_f.mode_id\n' +
          `${where}\nGROUP BY m_f.id`,
        params
      }
    case 'developers':
      return {
        sql:
          'SELECT co_f.id AS key, COUNT(DISTINCT g.id) AS count\n' +
          from +
          "JOIN game_companies gc_f ON gc_f.game_id = g.id AND gc_f.role = 'developer'\n" +
          'JOIN companies co_f ON co_f.id = gc_f.company_id\n' +
          `${where}\nGROUP BY co_f.id`,
        params
      }
    case 'publishers':
      return {
        sql:
          'SELECT co_f.id AS key, COUNT(DISTINCT g.id) AS count\n' +
          from +
          "JOIN game_companies gc_f ON gc_f.game_id = g.id AND gc_f.role = 'publisher'\n" +
          'JOIN companies co_f ON co_f.id = gc_f.company_id\n' +
          `${where}\nGROUP BY co_f.id`,
        params
      }
    case 'series':
      return {
        sql:
          'SELECT s_f.id AS key, COUNT(DISTINCT g.id) AS count\n' +
          from +
          'JOIN series_games sg_f ON sg_f.game_id = g.id\n' +
          'JOIN series s_f ON s_f.id = sg_f.series_id\n' +
          `${where}\nGROUP BY s_f.id`,
        params
      }
    case 'countries':
      return {
        sql:
          'SELECT co_f.country_code AS key, COUNT(DISTINCT g.id) AS count\n' +
          from +
          "JOIN game_companies gc_f ON gc_f.game_id = g.id AND gc_f.role = 'developer'\n" +
          'JOIN companies co_f ON co_f.id = gc_f.company_id\n' +
          `${joinAnd(where, 'co_f.country_code IS NOT NULL')}\nGROUP BY co_f.country_code`,
        params
      }
    case 'category':
      return { sql: `SELECT g.category AS key, COUNT(DISTINCT g.id) AS count\n${from}${where}\nGROUP BY g.category`, params }
    case 'releaseStatus':
      return { sql: `SELECT g.release_status AS key, COUNT(DISTINCT g.id) AS count\n${from}${where}\nGROUP BY g.release_status`, params }
    case 'ownership':
      return {
        sql: `SELECT ug.ownership AS key, COUNT(DISTINCT g.id) AS count\n${from}${joinAnd(where, 'ug.ownership IS NOT NULL')}\nGROUP BY ug.ownership`,
        params
      }
    case 'tags':
      return {
        sql:
          'SELECT t_f.id AS key, COUNT(DISTINCT g.id) AS count\n' +
          from +
          'JOIN game_tags gt_f ON gt_f.game_id = g.id\n' +
          'JOIN tags t_f ON t_f.id = gt_f.tag_id\n' +
          `${where}\nGROUP BY t_f.id`,
        params
      }
    case 'lists':
      return {
        sql:
          'SELECT li_f.list_id AS key, COUNT(DISTINCT g.id) AS count\n' +
          from +
          'JOIN list_items li_f ON li_f.game_id = g.id\n' +
          `${where}\nGROUP BY li_f.list_id`,
        params
      }
    case 'hltb':
      return {
        sql:
          "SELECT (CASE WHEN g.hltb_main_min IS NULL THEN 'unknown' " +
          "WHEN g.hltb_main_min < 300 THEN 'lt5' WHEN g.hltb_main_min < 900 THEN '5to15' " +
          "WHEN g.hltb_main_min < 2400 THEN '15to40' ELSE 'gt40' END) AS key, COUNT(DISTINCT g.id) AS count\n" +
          `${from}${where}\nGROUP BY key`,
        params
      }
    case 'flags': {
      const branch = (key: string, predicate: string): string =>
        `SELECT '${key}' AS key, COUNT(DISTINCT g.id) AS count\n${from}${joinAnd(where, predicate)}`
      const branches = [
        branch('favorite', 'ug.is_favorite = 1'),
        branch('mastered', 'ug.is_mastered = 1'),
        branch('hasReview', "(ug.review IS NOT NULL AND ug.review <> '')"),
        branch('unrated', 'ug.rating IS NULL'),
        branch('prioritized', 'ug.priority > 0')
      ]
      return { sql: branches.join('\nUNION ALL\n'), params: [...params, ...params, ...params, ...params, ...params] }
    }
  }
}

function joinAnd(where: string, extra: string): string {
  return where ? `${where} AND ${extra}` : `WHERE ${extra}`
}
