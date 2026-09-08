/**
 * Бизнес-правила пользовательских списков (06 §3, 02 §4): слаг, порядок sort_order,
 * перенумерация позиций элементов, добавление по фильтру, дублирование.
 */
import { getDb, write } from '../db/connection'
import type { Db } from '../db/connection'
import { deleteEntity } from '../db/connection'
import { newId, now } from '../db/utils'
import { ensureUniqueSlug, makeSlug } from '@shared/text'
import { AppError } from '@shared/errors'
import {
  addGamesToList,
  deleteListRow,
  getListCoverMosaic,
  getListDto,
  getListItemIds,
  getListsForGame,
  insertListRow,
  type ListMembership,
  listExists,
  listLists,
  listSlugTaken,
  nextListSortOrder,
  removeGamesFromList,
  renumberListItems,
  reorderLists as reorderListsRepo,
  setListItemNote,
  updateListRow,
  type ListWriteColumns
} from '../db/repositories/lists.repo'
import { queryCollectionCards } from '../db/repositories/collection.repo'
import { upsertSearchIndex, removeFromSearchIndex } from './search-index.service'
import { logActivity } from './activity.service'
import { type CollectionScope, type Filters } from '@shared/schema/filters'
import { type ListDto, type ListInput } from '@shared/schema/entities'

export function listListsService(opts: { pinnedOnly?: boolean } = {}): ListDto[] {
  return listLists(getDb(), opts)
}

export function getList(id: string): ListDto | null {
  return getListDto(getDb(), id)
}

function applySaveList(conn: Db, input: ListInput): string {
  const nowTs = now()
  const isCreate = !input.id || !listExists(conn, input.id)
  const id = input.id ?? newId()

  // Уникальность не требуется (06 §3.2), но slug всё равно нужен для search_index/URL —
  // генерируется один раз при создании и больше не меняется (список адресуется по id).
  const existingSlug = isCreate ? null : getListDto(conn, id)?.slug
  const slug = existingSlug ?? ensureUniqueSlug(makeSlug(input.name), (s) => listSlugTaken(conn, s))

  const columns: ListWriteColumns = {
    name: input.name,
    slug,
    description: input.description ?? null,
    icon: input.icon ?? null,
    color: input.color ?? null,
    coverImageId: input.coverImageId ?? null,
    isRanked: input.isRanked,
    sortMode: input.sortMode,
    isPinned: input.isPinned
  }

  if (isCreate) {
    insertListRow(conn, id, columns, nextListSortOrder(conn), nowTs)
    logActivity(conn, 'list_created', { entityType: 'list', entityId: id, payload: { name: input.name } })
  } else {
    updateListRow(conn, id, columns, nowTs)
  }

  upsertSearchIndex(conn, 'list', id, input.name)
  return id
}

export function saveList(input: ListInput): ListDto {
  return write(['lists'], (conn) => {
    const id = applySaveList(conn, input)
    const dto = getListDto(conn, id)
    if (!dto) throw new AppError('unknown', 'Не удалось сохранить список')
    return dto
  })
}

export function deleteList(id: string): void {
  write(['lists', 'list_items'], (conn) => {
    removeFromSearchIndex(conn, 'list', id)
    deleteListRow(conn, id) // ON DELETE CASCADE подчищает list_items; сами игры остаются в библиотеке
    deleteEntity(conn, 'list', id)
  })
}

export function duplicateList(id: string): ListDto {
  return write(['lists', 'list_items'], (conn) => {
    const original = getListDto(conn, id)
    if (!original) throw new AppError('not_found', 'Список не найден')
    const newIdValue = newId()
    const nowTs = now()
    const name = `${original.name} (копия)`
    const slug = ensureUniqueSlug(makeSlug(name), (s) => listSlugTaken(conn, s))
    insertListRow(
      conn,
      newIdValue,
      {
        name,
        slug,
        description: original.description,
        icon: original.icon,
        color: original.color,
        coverImageId: original.coverImageId,
        isRanked: original.isRanked,
        sortMode: original.sortMode,
        isPinned: original.isPinned
      },
      nextListSortOrder(conn),
      nowTs
    )
    const itemIds = getListItemIds(conn, id)
    addGamesToList(conn, newIdValue, itemIds, nowTs)
    upsertSearchIndex(conn, 'list', newIdValue, name)
    logActivity(conn, 'list_created', { entityType: 'list', entityId: newIdValue, payload: { name, duplicatedFrom: id } })
    const dto = getListDto(conn, newIdValue)
    if (!dto) throw new AppError('unknown', 'Не удалось дублировать список')
    return dto
  })
}

export function addGamesToListService(listId: string, gameIds: string[]): number {
  return write(['list_items'], (conn) => {
    const added = addGamesToList(conn, listId, gameIds, now())
    if (added > 0) logActivity(conn, 'list_item_added', { entityType: 'list', entityId: listId, payload: { count: added } })
    return added
  })
}

export function addFromFilterService(listId: string, scope: CollectionScope, filters: Filters): number {
  return write(['list_items'], (conn) => {
    const cards = queryCollectionCards(conn, { scope, filters, sort: { field: 'title', dir: 'asc' } })
    const added = addGamesToList(
      conn,
      listId,
      cards.map((c) => c.id),
      now()
    )
    if (added > 0) logActivity(conn, 'list_item_added', { entityType: 'list', entityId: listId, payload: { count: added } })
    return added
  })
}

export function removeGamesFromListService(listId: string, gameIds: string[]): void {
  write(['list_items'], (conn) => {
    removeGamesFromList(conn, listId, gameIds)
    logActivity(conn, 'list_item_removed', { entityType: 'list', entityId: listId, payload: { count: gameIds.length } })
  })
}

export function reorderListItems(listId: string, orderedGameIds: string[]): void {
  write(['list_items'], (conn) => {
    renumberListItems(conn, listId, orderedGameIds)
  })
}

export function setItemNote(listId: string, gameId: string, note: string | null): void {
  write(['list_items'], (conn) => {
    setListItemNote(conn, listId, gameId, note)
  })
}

export function reorderListsService(orderedIds: string[]): void {
  write(['lists'], (conn) => {
    reorderListsRepo(conn, orderedIds)
  })
}

export function getListsForGameService(gameId: string): ListMembership[] {
  return getListsForGame(getDb(), gameId)
}

export function getCoverMosaic(listId: string): string[] {
  return getListCoverMosaic(getDb(), listId)
}
