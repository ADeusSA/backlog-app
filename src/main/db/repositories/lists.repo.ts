/** Репозиторий пользовательских списков (02 §3.10, 06 §3). */
import type { Db } from '../connection'
import { toBool } from '../utils'
import { type ListDto, listDtoSchema } from '@shared/schema/entities'
import type { ListSortMode } from '@shared/constants'

export const LIST_DTO_COLUMNS_SQL = `
  l.id AS id,
  l.name AS name,
  l.slug AS slug,
  l.description AS description,
  l.icon AS icon,
  l.color AS color,
  l.cover_image_id AS coverImageId,
  cover.file_name AS coverFile,
  l.is_ranked AS isRanked,
  l.sort_mode AS sortMode,
  l.sort_order AS sortOrder,
  l.is_pinned AS isPinned,
  (SELECT COUNT(*) FROM list_items li WHERE li.list_id = l.id) AS gameCount,
  (SELECT COUNT(*) FROM list_items li JOIN user_game ug ON ug.game_id = li.game_id
     WHERE li.list_id = l.id AND ug.status = 'completed') AS completedCount,
  (SELECT COALESCE(SUM(ug.playtime_minutes), 0) FROM list_items li LEFT JOIN user_game ug ON ug.game_id = li.game_id
     WHERE li.list_id = l.id) AS playtimeMinutes,
  (SELECT MIN(g.release_year) FROM list_items li JOIN games g ON g.id = li.game_id WHERE li.list_id = l.id) AS yearFrom,
  (SELECT MAX(g.release_year) FROM list_items li JOIN games g ON g.id = li.game_id WHERE li.list_id = l.id) AS yearTo,
  l.created_at AS createdAt,
  l.updated_at AS updatedAt
`

export const LIST_DTO_FROM_SQL = `
  FROM lists l
  LEFT JOIN images cover ON cover.id = l.cover_image_id
`

interface ListRow {
  id: string
  name: string
  slug: string
  description: string | null
  icon: string | null
  color: string | null
  coverImageId: string | null
  coverFile: string | null
  isRanked: number
  sortMode: string
  sortOrder: number
  isPinned: number
  gameCount: number
  completedCount: number
  playtimeMinutes: number
  yearFrom: number | null
  yearTo: number | null
  createdAt: string
  updatedAt: string
}

export function getListCoverMosaic(db: Db, listId: string, limit = 4): string[] {
  const rows = db
    .prepare(
      `SELECT img.file_name AS fileName FROM list_items li
       JOIN games g ON g.id = li.game_id
       LEFT JOIN images img ON img.id = g.cover_image_id
       WHERE li.list_id = ? AND img.file_name IS NOT NULL
       ORDER BY li.position LIMIT ?`
    )
    .all(listId, limit) as Array<{ fileName: string }>
  return rows.map((r) => r.fileName)
}

function mapListRow(row: ListRow, coverMosaic: string[]): ListDto {
  return listDtoSchema.parse({
    ...row,
    sortMode: row.sortMode as ListSortMode,
    isRanked: toBool(row.isRanked),
    isPinned: toBool(row.isPinned),
    coverMosaic
  })
}

export function getListDto(db: Db, id: string): ListDto | null {
  const row = db.prepare(`SELECT ${LIST_DTO_COLUMNS_SQL} ${LIST_DTO_FROM_SQL} WHERE l.id = ?`).get(id) as ListRow | undefined
  return row ? mapListRow(row, getListCoverMosaic(db, id)) : null
}

export function listLists(db: Db, opts: { pinnedOnly?: boolean } = {}): ListDto[] {
  const where = opts.pinnedOnly ? 'WHERE l.is_pinned = 1' : ''
  const rows = db
    .prepare(`SELECT ${LIST_DTO_COLUMNS_SQL} ${LIST_DTO_FROM_SQL} ${where} ORDER BY l.sort_order, l.name COLLATE NOCASE`)
    .all() as ListRow[]
  return rows.map((row) => mapListRow(row, getListCoverMosaic(db, row.id)))
}

export function listExists(db: Db, id: string): boolean {
  return db.prepare('SELECT 1 FROM lists WHERE id = ?').get(id) != null
}

export function listSlugTaken(db: Db, slug: string, excludeId?: string): boolean {
  return db.prepare('SELECT id FROM lists WHERE slug = ? AND id <> ?').get(slug, excludeId ?? '') != null
}

export interface ListWriteColumns {
  name: string
  slug: string
  description: string | null
  icon: string | null
  color: string | null
  coverImageId: string | null
  isRanked: boolean
  sortMode: string
  isPinned: boolean
}

export function insertListRow(db: Db, id: string, c: ListWriteColumns, sortOrder: number, nowTs: string): void {
  db.prepare(
    `INSERT INTO lists(id, name, slug, description, icon, color, cover_image_id, is_ranked, sort_mode,
                        sort_order, is_pinned, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    c.name,
    c.slug,
    c.description,
    c.icon,
    c.color,
    c.coverImageId,
    c.isRanked ? 1 : 0,
    c.sortMode,
    sortOrder,
    c.isPinned ? 1 : 0,
    nowTs,
    nowTs
  )
}

export function updateListRow(db: Db, id: string, c: ListWriteColumns, nowTs: string): void {
  db.prepare(
    `UPDATE lists SET name = ?, slug = ?, description = ?, icon = ?, color = ?, cover_image_id = ?,
                      is_ranked = ?, sort_mode = ?, is_pinned = ?, updated_at = ?
     WHERE id = ?`
  ).run(c.name, c.slug, c.description, c.icon, c.color, c.coverImageId, c.isRanked ? 1 : 0, c.sortMode, c.isPinned ? 1 : 0, nowTs, id)
}

export function deleteListRow(db: Db, id: string): void {
  db.prepare('DELETE FROM lists WHERE id = ?').run(id)
}

export function nextListSortOrder(db: Db): number {
  const row = db.prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 AS n FROM lists').get() as { n: number }
  return row.n
}

export function reorderLists(db: Db, orderedIds: string[]): void {
  const stmt = db.prepare('UPDATE lists SET sort_order = ? WHERE id = ?')
  orderedIds.forEach((id, i) => stmt.run(i, id))
}

/* ------------------------------------------------------------------ элементы списка */

export function nextListItemPosition(db: Db, listId: string): number {
  const row = db.prepare('SELECT COALESCE(MAX(position), 0) AS p FROM list_items WHERE list_id = ?').get(listId) as { p: number }
  return row.p
}

/** Добавляет игры в конец списка, пропуская уже присутствующие. Возвращает число реально добавленных. */
export function addGamesToList(db: Db, listId: string, gameIds: string[], nowTs: string): number {
  let next = nextListItemPosition(db, listId)
  const insert = db.prepare('INSERT OR IGNORE INTO list_items(list_id, game_id, position, added_at) VALUES (?, ?, ?, ?)')
  let added = 0
  for (const gameId of gameIds) {
    next += 1
    const info = insert.run(listId, gameId, next, nowTs)
    if (info.changes > 0) added += 1
    else next -= 1
  }
  return added
}

export function removeGamesFromList(db: Db, listId: string, gameIds: string[]): void {
  if (gameIds.length === 0) return
  const ph = gameIds.map(() => '?').join(',')
  db.prepare(`DELETE FROM list_items WHERE list_id = ? AND game_id IN (${ph})`).run(listId, ...gameIds)
  const remaining = db.prepare('SELECT game_id AS gameId FROM list_items WHERE list_id = ? ORDER BY position').all(listId) as Array<{
    gameId: string
  }>
  renumberListItems(db, listId, remaining.map((r) => r.gameId))
}

/** Двухфазная перенумерация 1..N — иначе конфликт `uq_list_items_pos` при перестановке (02 §4). */
export function renumberListItems(db: Db, listId: string, orderedGameIds: string[]): void {
  const stmt = db.prepare('UPDATE list_items SET position = ? WHERE list_id = ? AND game_id = ?')
  orderedGameIds.forEach((gameId, i) => stmt.run(-(i + 1), listId, gameId))
  orderedGameIds.forEach((gameId, i) => stmt.run(i + 1, listId, gameId))
}

export function setListItemNote(db: Db, listId: string, gameId: string, note: string | null): void {
  db.prepare('UPDATE list_items SET note = ? WHERE list_id = ? AND game_id = ?').run(note, listId, gameId)
}

export function getListItemIds(db: Db, listId: string): string[] {
  const rows = db.prepare('SELECT game_id AS gameId FROM list_items WHERE list_id = ? ORDER BY position').all(listId) as Array<{
    gameId: string
  }>
  return rows.map((r) => r.gameId)
}

export interface ListMembership {
  id: string
  name: string
  icon: string | null
  color: string | null
  contains: boolean
}

export function getListsForGame(db: Db, gameId: string): ListMembership[] {
  const rows = db
    .prepare(
      `SELECT l.id AS id, l.name AS name, l.icon AS icon, l.color AS color,
              CASE WHEN li.game_id IS NOT NULL THEN 1 ELSE 0 END AS contains
       FROM lists l
       LEFT JOIN list_items li ON li.list_id = l.id AND li.game_id = ?
       ORDER BY l.sort_order, l.name COLLATE NOCASE`
    )
    .all(gameId) as Array<{ id: string; name: string; icon: string | null; color: string | null; contains: number }>
  return rows.map((r) => ({ ...r, contains: toBool(r.contains) }))
}
