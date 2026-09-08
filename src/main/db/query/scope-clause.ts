/**
 * FROM/JOIN и обязательные условия WHERE для каждого scope коллекции (07 §9).
 * Эти условия ВСЕГДА применяются — в отличие от `filters.*`, они не исключаются
 * при построении фасетных счётчиков (это сам контекст коллекции, а не фильтр).
 */
import type { CollectionScope } from '@shared/schema/filters'
import { likeContains } from './sql-fragments'

export interface ScopeSql {
  /** `FROM ... JOIN user_game ug ...` — алиасы `g` (games) и `ug` (user_game) фиксированы. */
  from: string
  /** Обязательные условия WHERE (parametrized). */
  where: string[]
  params: unknown[]
  /** Выражение позиции (`li.position` / `sg.position` / `NULL`). */
  positionExpr: string
  /** Выражение заметки к позиции (только списки). */
  positionNoteExpr: string
  /** Выражение метки позиции (только серии). */
  positionLabelExpr: string
  /** Нужен ли DISTINCT (company с несколькими совпадающими ролями даёт дубли join). */
  distinct: boolean
}

export function buildScopeSql(scope: CollectionScope): ScopeSql {
  switch (scope.kind) {
    case 'library':
      return {
        from: 'games g JOIN user_game ug ON ug.game_id = g.id',
        where: [],
        params: [],
        positionExpr: 'NULL',
        positionNoteExpr: 'NULL',
        positionLabelExpr: 'NULL',
        distinct: false
      }
    case 'catalog':
      return {
        from: 'games g LEFT JOIN user_game ug ON ug.game_id = g.id',
        where: [],
        params: [],
        positionExpr: 'NULL',
        positionNoteExpr: 'NULL',
        positionLabelExpr: 'NULL',
        distinct: false
      }
    case 'list':
      return {
        from: 'list_items li JOIN games g ON g.id = li.game_id LEFT JOIN user_game ug ON ug.game_id = g.id',
        where: ['li.list_id = ?'],
        params: [scope.listId],
        positionExpr: 'li.position',
        positionNoteExpr: 'li.note',
        positionLabelExpr: 'NULL',
        distinct: false
      }
    case 'series':
      return {
        from: 'series_games sg JOIN games g ON g.id = sg.game_id LEFT JOIN user_game ug ON ug.game_id = g.id',
        where: ['sg.series_id = ?'],
        params: [scope.seriesId],
        positionExpr: 'sg.position',
        positionNoteExpr: 'NULL',
        positionLabelExpr: 'sg.label',
        distinct: false
      }
    case 'company': {
      const roles = scope.roles && scope.roles.length > 0 ? scope.roles : null
      const roleClause = roles ? ` AND gc.role IN (${roles.map(() => '?').join(',')})` : ''
      return {
        from: 'games g JOIN game_companies gc ON gc.game_id = g.id LEFT JOIN user_game ug ON ug.game_id = g.id',
        where: [`gc.company_id = ?${roleClause}`],
        params: roles ? [scope.companyId, ...roles] : [scope.companyId],
        positionExpr: 'NULL',
        positionNoteExpr: 'NULL',
        positionLabelExpr: 'NULL',
        distinct: true
      }
    }
    case 'search': {
      const like = likeContains(scope.query.trim())
      return {
        from: 'games g LEFT JOIN user_game ug ON ug.game_id = g.id',
        where: ["(g.title LIKE ? ESCAPE '\\' OR g.alt_titles_json LIKE ? ESCAPE '\\')"],
        params: [like, like],
        positionExpr: 'NULL',
        positionNoteExpr: 'NULL',
        positionLabelExpr: 'NULL',
        distinct: false
      }
    }
  }
}
