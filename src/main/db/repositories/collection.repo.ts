/**
 * Репозиторий коллекции: выполняет запросы, построенные `collection-query-builder`
 * и `facets-query-builder`, и превращает сырые строки better-sqlite3 в DTO (02 §5).
 * Чистый слой данных — без Electron, чтобы репозиторий тестировался на in-memory SQLite.
 */
import type { Db } from '../connection'
import type { CollectionQuery, CollectionScope, Filters } from '@shared/schema/filters'
import { type GameCardDto, gameCardDtoSchema } from '@shared/schema/entities'
import type { GameStatus } from '@shared/constants'
import { toBool } from '../utils'
import { buildCardsQuery, buildCollectionQuery } from '../query/collection-query-builder'
import { buildFacetQuery, FACET_SECTION_KEYS, type FacetSectionKey } from '../query/facets-query-builder'
import { computeScopeProgress, type ScopeProgress } from '../query/scope-progress'

interface RawCardRow {
  id: string
  title: string
  sortTitle: string
  releaseYear: number | null
  releaseDate: string | null
  category: string
  parentGameId: string | null
  metacriticScore: number | null
  hltbMainMin: number | null
  coverFile: string | null
  dominantColor: string | null
  status: string | null
  rating: number | null
  playtimeMinutes: number | null
  isMastered: number
  isFavorite: number
  priority: number
  ownership: string | null
  addedAt: string | null
  startedAt: string | null
  finishedAt: string | null
  lastActivityAt: string | null
  genres: string | null
  primaryGenre: string | null
  developer: string | null
  platforms: string | null
  myPlatform: string | null
  seriesName: string | null
  position: number | null
  positionNote: string | null
  positionLabel: string | null
  completeness: number | null
}

export function mapGameCardRow(row: RawCardRow): GameCardDto {
  return gameCardDtoSchema.parse({
    ...row,
    status: row.status as GameStatus | null,
    isMastered: toBool(row.isMastered),
    isFavorite: toBool(row.isFavorite)
  })
}

/** Выполняет запрос коллекции (07 §7, §8) и возвращает карточки-строки. */
export function queryCollectionCards(db: Db, query: CollectionQuery): GameCardDto[] {
  const built = buildCollectionQuery(query)
  const rows = db.prepare(built.sql).all(...built.params) as RawCardRow[]
  return rows.map(mapGameCardRow)
}

/** Карточки по произвольному WHERE — DLC/издания/«тот же разработчик»/поиск (см. `buildCardsQuery`). */
export function queryCardsRaw(db: Db, whereSql: string, whereParams: unknown[], opts?: { orderBy?: string; limit?: number }): GameCardDto[] {
  const built = buildCardsQuery(whereSql, whereParams, opts)
  const rows = db.prepare(built.sql).all(...built.params) as RawCardRow[]
  return rows.map(mapGameCardRow)
}

export interface FacetBucket {
  key: string
  count: number
}

/** Фасетные счётчики по всем 16 секциям (07 §7). */
export function queryFacets(db: Db, scope: CollectionScope, filters: Filters): Record<FacetSectionKey, FacetBucket[]> {
  const result = {} as Record<FacetSectionKey, FacetBucket[]>
  for (const section of FACET_SECTION_KEYS) {
    const built = buildFacetQuery(section, scope, filters)
    const rows = db.prepare(built.sql).all(...built.params) as Array<{ key: string | null; count: number }>
    result[section] = rows.filter((r) => r.key != null).map((r) => ({ key: String(r.key), count: r.count }))
  }
  return result
}

export function getScopeProgress(db: Db, scope: CollectionScope): ScopeProgress {
  return computeScopeProgress(db, scope)
}
