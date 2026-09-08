/**
 * Сервис коллекции (07): собирает результат `collection.query`, фасеты и «Что поиграть?».
 * Прогресс/часы/годы в результате `collection.query` — на уровне всего scope, БЕЗ
 * активных фильтров панели (см. `db/query/scope-progress.ts` — это то же кольцо,
 * что в шапке экрана, а не производная от текущего фильтра).
 */
import { getDb } from '../db/connection'
import { getScopeProgress, queryCollectionCards, queryFacets } from '../db/repositories/collection.repo'
import type { CollectionQuery, CollectionScope, Filters } from '@shared/schema/filters'
import { type CollectionResult, collectionResultSchema, type Facets, type GameCardDto, type Progress } from '@shared/schema/entities'

export function queryCollection(input: CollectionQuery): CollectionResult {
  const db = getDb()
  const items = queryCollectionCards(db, input)
  const scopeProgress = getScopeProgress(db, input.scope)
  const result: CollectionResult = {
    items,
    total: items.length,
    progress: { done: scopeProgress.done, total: scopeProgress.total },
    playtimeMinutes: scopeProgress.playtimeMinutes,
    yearFrom: scopeProgress.yearFrom,
    yearTo: scopeProgress.yearTo
  }
  return collectionResultSchema.parse(result)
}

export function getFacets(scope: CollectionScope, filters: Filters): Facets {
  const db = getDb()
  return queryFacets(db, scope, filters)
}

export function getScopeProgressOnly(scope: CollectionScope): Progress {
  const p = getScopeProgress(getDb(), scope)
  return { done: p.done, total: p.total }
}

export function pickRandomCard(scope: CollectionScope, filters: Filters, excludeIds: string[] | undefined): GameCardDto | null {
  const db = getDb()
  const seed = Math.floor(Math.random() * 1_000_000)
  const items = queryCollectionCards(db, { scope, filters, sort: { field: 'random', dir: 'asc', seed } })
  const filtered = excludeIds && excludeIds.length > 0 ? items.filter((i) => !excludeIds.includes(i.id)) : items
  return filtered[0] ?? null
}
