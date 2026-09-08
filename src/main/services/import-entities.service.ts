/**
 * Сопоставление сущностей из внешнего источника с каталогом (08 §3 п. 3).
 *
 * Работает внутри той же транзакции, что и сохранение игры: пока пользователь не нажал
 * «Сохранить», в базе ничего не появляется. Сначала ищем существующую запись (по slug,
 * затем по имени без учёта регистра) и только потом создаём новую — поэтому повторный
 * импорт той же студии или жанра не плодит дубликаты.
 */
import type { Db } from '../db/connection'
import { newId, now } from '../db/utils'
import { ensureUniqueSlug, makeSlug, makeSortTitle } from '@shared/text'
import { ensureTag } from '../db/repositories/taxonomy.repo'
import { insertCompanyRow, companySlugTaken } from '../db/repositories/companies.repo'
import { insertSeriesRow, seriesSlugTaken } from '../db/repositories/series.repo'
import type { CreateEntities, NamedRef } from '@shared/schema/providers'
import type { PlatformFamily } from '@shared/constants'
import { upsertSearchIndex } from './search-index.service'

/** Ищет строку по slug, затем по имени без учёта регистра. */
function findBySlugOrName(conn: Db, table: 'genres' | 'modes', ref: NamedRef): string | null {
  const bySlug = conn.prepare(`SELECT id FROM ${table} WHERE slug = ?`).get(ref.slug) as { id: string } | undefined
  if (bySlug) return bySlug.id
  const byName = conn.prepare(`SELECT id FROM ${table} WHERE name = ? COLLATE NOCASE`).get(ref.name) as
    | { id: string }
    | undefined
  return byName?.id ?? null
}

function ensureGenre(conn: Db, ref: NamedRef): string {
  const existing = findBySlugOrName(conn, 'genres', ref)
  if (existing) return existing
  const id = newId()
  const nowTs = now()
  const slug = ensureUniqueSlug(ref.slug || makeSlug(ref.name), (s) => {
    return conn.prepare('SELECT id FROM genres WHERE slug = ?').get(s) !== undefined
  })
  conn
    .prepare(
      'INSERT INTO genres(id, name, slug, description, color, is_custom, created_at, updated_at) VALUES (?, ?, ?, NULL, NULL, 1, ?, ?)'
    )
    .run(id, ref.name, slug, nowTs, nowTs)
  return id
}

/**
 * Режимы сидируются миграцией и своего канала создания не имеют, но провайдер может
 * принести режим, которого у нас нет («Battle Royale» из Steam-категорий) — тогда
 * заводим его здесь, иначе данные просто потерялись бы.
 */
function ensureMode(conn: Db, ref: NamedRef): string {
  const existing = findBySlugOrName(conn, 'modes', ref)
  if (existing) return existing
  const id = newId()
  const slug = ensureUniqueSlug(ref.slug || makeSlug(ref.name), (s) => {
    return conn.prepare('SELECT id FROM modes WHERE slug = ?').get(s) !== undefined
  })
  const maxOrder = (conn.prepare('SELECT COALESCE(MAX(sort_order), 0) AS v FROM modes').get() as { v: number }).v
  conn.prepare('INSERT INTO modes(id, name, slug, sort_order) VALUES (?, ?, ?, ?)').run(id, ref.name, slug, maxOrder + 10)
  return id
}

/** Семейство новой платформы — по названию; всё незнакомое попадает в «Другое». */
function guessFamily(name: string): PlatformFamily {
  const value = name.toLowerCase()
  if (/playstation|\bps[1-5]\b|psp|vita/.test(value)) return 'playstation'
  if (/xbox|kinect/.test(value)) return 'xbox'
  if (/nintendo|switch|wii|game ?boy|nes\b|snes|gamecube|\bds\b/.test(value)) return 'nintendo'
  if (/ios|android|mobile/.test(value)) return 'mobile'
  if (/vr|quest|vive|index|psvr/.test(value)) return 'vr'
  if (/pc|windows|mac|linux|dos|steam/.test(value)) return 'pc'
  return 'other'
}

function ensurePlatform(conn: Db, ref: NamedRef): string {
  const byName = conn.prepare('SELECT id FROM platforms WHERE name = ? COLLATE NOCASE').get(ref.name) as
    | { id: string }
    | undefined
  if (byName) return byName.id
  const byShort = conn.prepare('SELECT id FROM platforms WHERE short_name = ? COLLATE NOCASE').get(ref.name) as
    | { id: string }
    | undefined
  if (byShort) return byShort.id

  const id = newId()
  const nowTs = now()
  const maxOrder = (conn.prepare('SELECT COALESCE(MAX(sort_order), 0) AS v FROM platforms').get() as { v: number }).v
  conn
    .prepare(
      'INSERT INTO platforms(id, name, short_name, family, sort_order, is_custom, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, ?, ?)'
    )
    .run(id, ref.name, ref.name.slice(0, 20), guessFamily(ref.name), maxOrder + 10, nowTs, nowTs)
  return id
}

function ensureCompany(conn: Db, ref: NamedRef, role: 'developer' | 'publisher'): string {
  const bySlug = conn.prepare('SELECT id FROM companies WHERE slug = ?').get(ref.slug) as { id: string } | undefined
  const byName =
    bySlug ??
    (conn.prepare('SELECT id FROM companies WHERE name = ? COLLATE NOCASE').get(ref.name) as { id: string } | undefined)
  if (byName) {
    // Студия уже есть, но раньше значилась только разработчиком — отмечаем и вторую роль.
    const column = role === 'developer' ? 'is_developer' : 'is_publisher'
    conn.prepare(`UPDATE companies SET ${column} = 1, updated_at = ? WHERE id = ?`).run(now(), byName.id)
    return byName.id
  }

  const id = newId()
  const nowTs = now()
  const slug = ensureUniqueSlug(ref.slug || makeSlug(ref.name), (s) => companySlugTaken(conn, s))
  insertCompanyRow(
    conn,
    id,
    {
      name: ref.name,
      sortName: makeSortTitle(ref.name),
      slug,
      isDeveloper: role === 'developer',
      isPublisher: role === 'publisher',
      countryCode: null,
      countryNumeric: null,
      city: null,
      foundedYear: null,
      closedYear: null,
      description: null,
      website: null,
      logoImageId: null,
      bannerImageId: null,
      parentCompanyId: null
    },
    nowTs
  )
  upsertSearchIndex(conn, 'company', id, ref.name, [])
  return id
}

function ensureSeries(conn: Db, ref: NamedRef): string {
  const bySlug = conn.prepare('SELECT id FROM series WHERE slug = ?').get(ref.slug) as { id: string } | undefined
  const byName =
    bySlug ?? (conn.prepare('SELECT id FROM series WHERE name = ? COLLATE NOCASE').get(ref.name) as { id: string } | undefined)
  if (byName) return byName.id

  const id = newId()
  const nowTs = now()
  const slug = ensureUniqueSlug(ref.slug || makeSlug(ref.name), (s) => seriesSlugTaken(conn, s))
  insertSeriesRow(
    conn,
    id,
    {
      name: ref.name,
      kind: 'series',
      sortName: makeSortTitle(ref.name),
      slug,
      description: null,
      coverImageId: null,
      bannerImageId: null,
      parentSeriesId: null
    },
    nowTs
  )
  upsertSearchIndex(conn, 'series', id, ref.name, [])
  return id
}

export interface ResolvedEntities {
  developerIds: string[]
  publisherIds: string[]
  genreIds: string[]
  platformIds: string[]
  modeIds: string[]
  tagIds: string[]
  seriesId: string | null
}

/** Превращает имена из импорта в идентификаторы каталога, создавая недостающее. */
export function resolveImportedEntities(conn: Db, input: CreateEntities): ResolvedEntities {
  return {
    developerIds: input.developers.map((ref) => ensureCompany(conn, ref, 'developer')),
    publisherIds: input.publishers.map((ref) => ensureCompany(conn, ref, 'publisher')),
    genreIds: input.genres.map((ref) => ensureGenre(conn, ref)),
    platformIds: input.platforms.map((ref) => ensurePlatform(conn, ref)),
    modeIds: input.modes.map((ref) => ensureMode(conn, ref)),
    tagIds: input.tags.map((ref) => ensureTag(conn, ref.name)),
    seriesId: input.series ? ensureSeries(conn, input.series) : null
  }
}

/** Какие таблицы может тронуть резолв — для списка в `write()`. */
export const IMPORT_TABLES = ['companies', 'genres', 'platforms', 'modes', 'tags', 'series'] as const
