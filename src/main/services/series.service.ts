/**
 * Бизнес-правила серий/франшиз (06 §4, 02 §4): слаг/sort_name, перенумерация позиций,
 * автонумерация по дате выхода, происхождение полей, поисковый индекс.
 */
import { getDb, write } from '../db/connection'
import type { Db } from '../db/connection'
import { deleteEntity } from '../db/connection'
import { newId, now } from '../db/utils'
import { ensureUniqueSlug, makeSlug, makeSortTitle } from '@shared/text'
import { AppError } from '@shared/errors'
import {
  addGamesToSeries,
  autoNumberSeries,
  deleteSeriesRow,
  getSeriesChildren,
  getSeriesDto,
  getSeriesEditData,
  getSeriesGames,
  getSeriesTimeline,
  insertSeriesRow,
  listSeries,
  removeGamesFromSeries,
  renumberSeriesGames,
  seriesExists,
  seriesSlugTaken,
  setSeriesGameLabel,
  updateSeriesRow,
  type SeriesWriteColumns,
  type TimelineEntry
} from '../db/repositories/series.repo'
import { removeFromSearchIndex, upsertSearchIndex } from './search-index.service'
import { lockManualFields } from './field-provenance.service'
import { logActivity } from './activity.service'
import { type SeriesDto, type SeriesInput, seriesInputSchema } from '@shared/schema/entities'

const TRACKED_FIELDS = ['name', 'description', 'coverImageId', 'bannerImageId']

export function listSeriesService(opts: { q?: string; sort: 'name' | 'games' | 'latest' | 'progress' }): SeriesDto[] {
  return listSeries(getDb(), opts)
}

export function getSeries(id: string): SeriesDto | null {
  return getSeriesDto(getDb(), id)
}

export function getSeriesChildrenService(id: string): SeriesDto[] {
  return getSeriesChildren(getDb(), id)
}

export function getSeriesForEdit(id: string): SeriesInput | null {
  const data = getSeriesEditData(getDb(), id)
  if (!data) return null
  return seriesInputSchema.parse({ id, ...data })
}

export function applySaveSeries(conn: Db, input: SeriesInput): string {
  const nowTs = now()
  const isCreate = !input.id || !seriesExists(conn, input.id)
  const id = input.id ?? newId()

  const sortName = input.sortName?.trim() || makeSortTitle(input.name)
  let slug = input.slug?.trim()
  if (!slug) {
    slug = ensureUniqueSlug(makeSlug(input.name), (s) => seriesSlugTaken(conn, s, isCreate ? undefined : id))
  } else if (seriesSlugTaken(conn, slug, isCreate ? undefined : id)) {
    throw new AppError('duplicate_slug', `Slug «${slug}» уже занят`)
  }

  const columns: SeriesWriteColumns = {
    name: input.name,
    kind: input.kind,
    sortName,
    slug,
    description: input.description ?? null,
    coverImageId: input.coverImageId ?? null,
    bannerImageId: input.bannerImageId ?? null,
    parentSeriesId: input.parentSeriesId ?? null
  }

  if (isCreate) insertSeriesRow(conn, id, columns, nowTs)
  else updateSeriesRow(conn, id, columns, nowTs)

  lockManualFields(conn, 'series', id, TRACKED_FIELDS)
  upsertSearchIndex(conn, 'series', id, input.name)
  logActivity(conn, isCreate ? 'catalog_created' : 'catalog_edited', {
    entityType: 'series',
    entityId: id,
    payload: { name: input.name }
  })

  return id
}

export function saveSeries(input: SeriesInput): string {
  return write(['series'], (conn) => applySaveSeries(conn, input))
}

export function deleteSeries(id: string): void {
  write(['series', 'series_games'], (conn) => {
    removeFromSearchIndex(conn, 'series', id)
    deleteSeriesRow(conn, id) // ON DELETE CASCADE подчищает series_games
    deleteEntity(conn, 'series', id)
  })
}

export function reorderSeries(seriesId: string, orderedGameIds: string[]): void {
  write(['series_games'], (conn) => {
    renumberSeriesGames(conn, seriesId, orderedGameIds)
  })
}

/** Перемещает одну игру на произвольную позицию, сдвигая остальные (06 §4.2). */
export function setSeriesPosition(seriesId: string, gameId: string, position: number): void {
  write(['series_games'], (conn) => {
    const current = getSeriesGames(conn, seriesId).map((g) => g.gameId)
    const withoutTarget = current.filter((id) => id !== gameId)
    const index = Math.max(0, Math.min(position - 1, withoutTarget.length))
    withoutTarget.splice(index, 0, gameId)
    renumberSeriesGames(conn, seriesId, withoutTarget)
  })
}

export function addGamesToSeriesService(seriesId: string, gameIds: string[]): number {
  return write(['series_games'], (conn) => {
    const added = addGamesToSeries(conn, seriesId, gameIds)
    if (added > 0) logActivity(conn, 'list_item_added', { entityType: 'series', entityId: seriesId, payload: { count: added } })
    return added
  })
}

export function removeGamesFromSeriesService(seriesId: string, gameIds: string[]): void {
  write(['series_games'], (conn) => {
    removeGamesFromSeries(conn, seriesId, gameIds)
    logActivity(conn, 'list_item_removed', { entityType: 'series', entityId: seriesId, payload: { count: gameIds.length } })
  })
}

export function autoNumberSeriesService(seriesId: string): void {
  write(['series_games'], (conn) => {
    autoNumberSeries(conn, seriesId)
  })
}

export function setSeriesLabel(seriesId: string, gameId: string, label: string | null): void {
  write(['series_games'], (conn) => {
    setSeriesGameLabel(conn, seriesId, gameId, label)
  })
}

export function getTimeline(seriesId: string): TimelineEntry[] {
  return getSeriesTimeline(getDb(), seriesId)
}
