/**
 * Обёртка над `db/repositories/taxonomy.repo` для канала `catalog.*` (06 §7.6):
 * запись через `write()`, лог активности `catalog_created`/`catalog_edited`.
 * `field_provenance` для жанров/платформ/тегов не ведётся (02 §3.11 — только game/company/series).
 */
import { getDb, write } from '../db/connection'
import { deleteEntity } from '../db/connection'
import {
  deleteGenre,
  deletePlatform,
  deleteTag,
  listGenres,
  listModes,
  listPlatforms,
  listTags,
  mergeGenre,
  mergePlatform,
  mergeTag,
  saveGenre,
  savePlatform,
  saveTag
} from '../db/repositories/taxonomy.repo'
import { logActivity } from './activity.service'
import type { GenreDto, ModeDto, PlatformDto, TagDto } from '@shared/schema/entities'
import type { PlatformFamily } from '@shared/constants'

export function listGenresService(): GenreDto[] {
  return listGenres(getDb())
}

export function saveGenreService(input: { id?: string; name: string; description?: string | null; color?: string | null }): string {
  const isCreate = !input.id
  return write(['genres'], (conn) => {
    const id = saveGenre(conn, input)
    logActivity(conn, isCreate ? 'catalog_created' : 'catalog_edited', { entityType: 'genre', entityId: id, payload: { name: input.name } })
    return id
  })
}

export function deleteGenreService(id: string): void {
  write(['genres', 'game_genres'], (conn) => {
    deleteGenre(conn, id)
    deleteEntity(conn, 'genre', id)
  })
}

export function mergeGenreService(fromId: string, intoId: string): void {
  write(['genres', 'game_genres'], (conn) => {
    mergeGenre(conn, fromId, intoId)
    deleteEntity(conn, 'genre', fromId)
  })
}

export function listPlatformsService(): PlatformDto[] {
  return listPlatforms(getDb())
}

export function savePlatformService(input: {
  id?: string
  name: string
  shortName: string
  family: PlatformFamily
  sortOrder: number
}): string {
  const isCreate = !input.id
  return write(['platforms'], (conn) => {
    const id = savePlatform(conn, input)
    logActivity(conn, isCreate ? 'catalog_created' : 'catalog_edited', { entityType: 'platform', entityId: id, payload: { name: input.name } })
    return id
  })
}

export function deletePlatformService(id: string): void {
  write(['platforms', 'game_platforms'], (conn) => {
    deletePlatform(conn, id)
    deleteEntity(conn, 'platform', id)
  })
}

export function mergePlatformService(fromId: string, intoId: string): void {
  write(['platforms', 'game_platforms'], (conn) => {
    mergePlatform(conn, fromId, intoId)
    deleteEntity(conn, 'platform', fromId)
  })
}

export function listModesService(): ModeDto[] {
  return listModes(getDb())
}

export function listTagsService(): TagDto[] {
  return listTags(getDb())
}

export function saveTagService(input: { id?: string; name: string; color?: string | null }): string {
  const isCreate = !input.id
  return write(['tags'], (conn) => {
    const id = saveTag(conn, input)
    logActivity(conn, isCreate ? 'catalog_created' : 'catalog_edited', { entityType: 'tag', entityId: id, payload: { name: input.name } })
    return id
  })
}

export function deleteTagService(id: string): void {
  write(['tags', 'game_tags'], (conn) => {
    deleteTag(conn, id) // уже пишет tombstone
  })
}

export function mergeTagService(fromId: string, intoId: string): void {
  write(['tags', 'game_tags'], (conn) => {
    mergeTag(conn, fromId, intoId) // уже пишет tombstone
  })
}
