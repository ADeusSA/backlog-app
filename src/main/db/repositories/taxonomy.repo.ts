/**
 * Справочники: жанры, платформы, режимы, теги (02 §3.4) + операции слияния дублей (06 §7.6).
 * `modes` — только чтение (сидируются миграцией, отдельного канала save/delete нет).
 */
import type { Db } from '../connection'
import { deleteEntity } from '../connection'
import { newId, now, toBool } from '../utils'
import { ensureUniqueSlug, makeSlug } from '@shared/text'
import { type GenreDto, type ModeDto, type PlatformDto, type TagDto } from '@shared/schema/entities'
import type { PlatformFamily } from '@shared/constants'

/* ------------------------------------------------------------------ жанры */

interface GenreRow {
  id: string
  name: string
  slug: string
  description: string | null
  color: string | null
  is_custom: number
  game_count: number
}

function mapGenre(row: GenreRow): GenreDto {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    color: row.color,
    isCustom: toBool(row.is_custom),
    gameCount: row.game_count
  }
}

export function listGenres(db: Db): GenreDto[] {
  const rows = db
    .prepare(
      `SELECT ge.id, ge.name, ge.slug, ge.description, ge.color, ge.is_custom,
              (SELECT COUNT(*) FROM game_genres gg WHERE gg.genre_id = ge.id) AS game_count
       FROM genres ge ORDER BY ge.name`
    )
    .all() as GenreRow[]
  return rows.map(mapGenre)
}

function genreSlugTaken(db: Db, slug: string, excludeId?: string): boolean {
  const row = db.prepare('SELECT id FROM genres WHERE slug = ? AND id <> ?').get(slug, excludeId ?? '') as
    | { id: string }
    | undefined
  return row != null
}

export function saveGenre(db: Db, input: { id?: string; name: string; description?: string | null; color?: string | null }): string {
  const nowTs = now()
  if (input.id) {
    db.prepare('UPDATE genres SET name = ?, description = ?, color = ?, updated_at = ? WHERE id = ?').run(
      input.name,
      input.description ?? null,
      input.color ?? null,
      nowTs,
      input.id
    )
    return input.id
  }
  const id = newId()
  const slug = ensureUniqueSlug(makeSlug(input.name), (s) => genreSlugTaken(db, s))
  db.prepare(
    'INSERT INTO genres(id, name, slug, description, color, is_custom, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, ?, ?)'
  ).run(id, input.name, slug, input.description ?? null, input.color ?? null, nowTs, nowTs)
  return id
}

export function deleteGenre(db: Db, id: string): void {
  db.prepare('DELETE FROM genres WHERE id = ?').run(id)
}

export function mergeGenre(db: Db, fromId: string, intoId: string): void {
  db.prepare('UPDATE OR IGNORE game_genres SET genre_id = ? WHERE genre_id = ?').run(intoId, fromId)
  db.prepare('DELETE FROM game_genres WHERE genre_id = ?').run(fromId)
  db.prepare('DELETE FROM genres WHERE id = ?').run(fromId)
}

/* --------------------------------------------------------------- платформы */

interface PlatformRow {
  id: string
  name: string
  short_name: string
  family: string
  sort_order: number
  is_custom: number
  game_count: number
}

function mapPlatform(row: PlatformRow): PlatformDto {
  return {
    id: row.id,
    name: row.name,
    shortName: row.short_name,
    family: row.family as PlatformFamily,
    sortOrder: row.sort_order,
    isCustom: toBool(row.is_custom),
    gameCount: row.game_count
  }
}

export function listPlatforms(db: Db): PlatformDto[] {
  const rows = db
    .prepare(
      `SELECT p.id, p.name, p.short_name, p.family, p.sort_order, p.is_custom,
              (SELECT COUNT(*) FROM game_platforms gp WHERE gp.platform_id = p.id) AS game_count
       FROM platforms p ORDER BY p.sort_order, p.name`
    )
    .all() as PlatformRow[]
  return rows.map(mapPlatform)
}

export function savePlatform(
  db: Db,
  input: { id?: string; name: string; shortName: string; family: PlatformFamily; sortOrder: number }
): string {
  const nowTs = now()
  if (input.id) {
    db.prepare('UPDATE platforms SET name = ?, short_name = ?, family = ?, sort_order = ?, updated_at = ? WHERE id = ?').run(
      input.name,
      input.shortName,
      input.family,
      input.sortOrder,
      nowTs,
      input.id
    )
    return input.id
  }
  const id = newId()
  db.prepare(
    'INSERT INTO platforms(id, name, short_name, family, sort_order, is_custom, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, ?, ?)'
  ).run(id, input.name, input.shortName, input.family, input.sortOrder, nowTs, nowTs)
  return id
}

export function deletePlatform(db: Db, id: string): void {
  db.prepare('DELETE FROM platforms WHERE id = ?').run(id)
}

export function mergePlatform(db: Db, fromId: string, intoId: string): void {
  db.prepare('UPDATE OR IGNORE game_platforms SET platform_id = ? WHERE platform_id = ?').run(intoId, fromId)
  db.prepare('DELETE FROM game_platforms WHERE platform_id = ?').run(fromId)
  db.prepare('UPDATE user_game SET platform_id = ? WHERE platform_id = ?').run(intoId, fromId)
  db.prepare('UPDATE playthroughs SET platform_id = ? WHERE platform_id = ?').run(intoId, fromId)
  db.prepare('DELETE FROM platforms WHERE id = ?').run(fromId)
}

/* ------------------------------------------------------------------ режимы */

interface ModeRow {
  id: string
  name: string
  slug: string
  sort_order: number
  game_count: number
}

export function listModes(db: Db): ModeDto[] {
  const rows = db
    .prepare(
      `SELECT m.id, m.name, m.slug, m.sort_order,
              (SELECT COUNT(*) FROM game_modes gm WHERE gm.mode_id = m.id) AS game_count
       FROM modes m ORDER BY m.sort_order`
    )
    .all() as ModeRow[]
  return rows.map((row) => ({ id: row.id, name: row.name, slug: row.slug, sortOrder: row.sort_order, gameCount: row.game_count }))
}

/* -------------------------------------------------------------------- теги */

interface TagRow {
  id: string
  name: string
  color: string | null
  game_count: number
}

function mapTag(row: TagRow): TagDto {
  return { id: row.id, name: row.name, color: row.color, gameCount: row.game_count }
}

export function listTags(db: Db): TagDto[] {
  const rows = db
    .prepare(
      `SELECT t.id, t.name, t.color,
              (SELECT COUNT(*) FROM game_tags gt WHERE gt.tag_id = t.id) AS game_count
       FROM tags t ORDER BY t.name COLLATE NOCASE`
    )
    .all() as TagRow[]
  return rows.map(mapTag)
}

export function getTagsForGame(db: Db, gameId: string): TagDto[] {
  const rows = db
    .prepare(
      `SELECT t.id, t.name, t.color,
              (SELECT COUNT(*) FROM game_tags gt2 WHERE gt2.tag_id = t.id) AS game_count
       FROM game_tags gt JOIN tags t ON t.id = gt.tag_id WHERE gt.game_id = ? ORDER BY t.name COLLATE NOCASE`
    )
    .all(gameId) as TagRow[]
  return rows.map(mapTag)
}

function findTagByName(db: Db, name: string): { id: string } | undefined {
  return db.prepare('SELECT id FROM tags WHERE name = ? COLLATE NOCASE').get(name) as { id: string } | undefined
}

/** Находит тег по имени или создаёт новый (автодополнение «на лету», 06 §6.2). */
export function ensureTag(db: Db, name: string, color: string | null = null): string {
  const trimmed = name.trim()
  const existing = findTagByName(db, trimmed)
  if (existing) return existing.id
  const nowTs = now()
  const id = newId()
  db.prepare('INSERT INTO tags(id, name, color, created_at, updated_at) VALUES (?, ?, ?, ?, ?)').run(id, trimmed, color, nowTs, nowTs)
  return id
}

export function saveTag(db: Db, input: { id?: string; name: string; color?: string | null }): string {
  const nowTs = now()
  if (input.id) {
    db.prepare('UPDATE tags SET name = ?, color = ?, updated_at = ? WHERE id = ?').run(input.name, input.color ?? null, nowTs, input.id)
    return input.id
  }
  const existing = findTagByName(db, input.name)
  if (existing) {
    db.prepare('UPDATE tags SET color = ?, updated_at = ? WHERE id = ?').run(input.color ?? null, nowTs, existing.id)
    return existing.id
  }
  const id = newId()
  db.prepare('INSERT INTO tags(id, name, color, created_at, updated_at) VALUES (?, ?, ?, ?, ?)').run(id, input.name, input.color ?? null, nowTs, nowTs)
  return id
}

export function deleteTag(db: Db, id: string): void {
  db.prepare('DELETE FROM tags WHERE id = ?').run(id)
  deleteEntity(db, 'tag', id)
}

export function mergeTag(db: Db, fromId: string, intoId: string): void {
  db.prepare('UPDATE OR IGNORE game_tags SET tag_id = ? WHERE tag_id = ?').run(intoId, fromId)
  db.prepare('DELETE FROM game_tags WHERE tag_id = ?').run(fromId)
  db.prepare('DELETE FROM tags WHERE id = ?').run(fromId)
  deleteEntity(db, 'tag', fromId)
}

/* ------------------------------------------------------- связи игра ↔ тег */

export function setGameTags(db: Db, gameId: string, tagIds: string[]): void {
  db.prepare('DELETE FROM game_tags WHERE game_id = ?').run(gameId)
  const stmt = db.prepare('INSERT OR IGNORE INTO game_tags(game_id, tag_id) VALUES (?, ?)')
  for (const tagId of tagIds) stmt.run(gameId, tagId)
}

export function addTagsToGames(db: Db, gameIds: string[], tagIds: string[]): void {
  if (gameIds.length === 0 || tagIds.length === 0) return
  const stmt = db.prepare('INSERT OR IGNORE INTO game_tags(game_id, tag_id) VALUES (?, ?)')
  for (const gameId of gameIds) for (const tagId of tagIds) stmt.run(gameId, tagId)
}

export function removeTagsFromGames(db: Db, gameIds: string[], tagIds: string[]): void {
  if (gameIds.length === 0 || tagIds.length === 0) return
  const gamePh = gameIds.map(() => '?').join(',')
  const tagPh = tagIds.map(() => '?').join(',')
  db.prepare(`DELETE FROM game_tags WHERE game_id IN (${gamePh}) AND tag_id IN (${tagPh})`).run(...gameIds, ...tagIds)
}
