/**
 * Репозиторий студий/издателей (02 §3.5, 06 §5). Роли и издатель/разработчик — общая
 * сущность с двумя флагами (`is_developer`/`is_publisher`), см. 06 §5.2.
 */
import type { Db } from '../connection'
import { toBool } from '../utils'
import { type CompanyDto, companyDtoSchema, type SeriesDto } from '@shared/schema/entities'
import { SERIES_DTO_COLUMNS_SQL, SERIES_DTO_FROM_SQL, getSeriesCoverMosaic } from './series.repo'

export const COMPANY_DTO_COLUMNS_SQL = `
  c.id AS id,
  c.name AS name,
  c.slug AS slug,
  c.sort_name AS sortName,
  c.is_developer AS isDeveloper,
  c.is_publisher AS isPublisher,
  c.country_code AS countryCode,
  c.city AS city,
  c.founded_year AS foundedYear,
  c.closed_year AS closedYear,
  c.description AS description,
  c.website AS website,
  c.logo_image_id AS logoImageId,
  logo.file_name AS logoFile,
  c.banner_image_id AS bannerImageId,
  banner.file_name AS bannerFile,
  logo.dominant_color AS dominantColor,
  c.parent_company_id AS parentCompanyId,
  parent.name AS parentCompanyName,
  (SELECT COUNT(DISTINCT gc.game_id) FROM game_companies gc WHERE gc.company_id = c.id) AS gameCount,
  (SELECT COUNT(DISTINCT gc.game_id) FROM game_companies gc JOIN user_game ug ON ug.game_id = gc.game_id
     WHERE gc.company_id = c.id) AS myGameCount,
  (SELECT COUNT(DISTINCT gc.game_id) FROM game_companies gc JOIN user_game ug ON ug.game_id = gc.game_id
     WHERE gc.company_id = c.id AND ug.status = 'completed') AS completedCount,
  (SELECT COUNT(DISTINCT sg.series_id) FROM series_games sg JOIN game_companies gc ON gc.game_id = sg.game_id
     WHERE gc.company_id = c.id) AS seriesCount,
  (SELECT AVG(ug.rating) FROM game_companies gc JOIN user_game ug ON ug.game_id = gc.game_id
     WHERE gc.company_id = c.id AND ug.rating IS NOT NULL) AS avgRating,
  c.created_at AS createdAt,
  c.updated_at AS updatedAt
`

export const COMPANY_DTO_FROM_SQL = `
  FROM companies c
  LEFT JOIN images logo ON logo.id = c.logo_image_id
  LEFT JOIN images banner ON banner.id = c.banner_image_id
  LEFT JOIN companies parent ON parent.id = c.parent_company_id
`

interface CompanyRow {
  id: string
  name: string
  slug: string
  sortName: string
  isDeveloper: number
  isPublisher: number
  countryCode: string | null
  city: string | null
  foundedYear: number | null
  closedYear: number | null
  description: string | null
  website: string | null
  logoImageId: string | null
  logoFile: string | null
  bannerImageId: string | null
  bannerFile: string | null
  dominantColor: string | null
  parentCompanyId: string | null
  parentCompanyName: string | null
  gameCount: number
  myGameCount: number
  completedCount: number
  seriesCount: number
  avgRating: number | null
  createdAt: string
  updatedAt: string
}

function mapCompanyRow(row: CompanyRow): CompanyDto {
  return companyDtoSchema.parse({
    ...row,
    isDeveloper: toBool(row.isDeveloper),
    isPublisher: toBool(row.isPublisher)
  })
}

export function getCompanyDto(db: Db, id: string): CompanyDto | null {
  const row = db.prepare(`SELECT ${COMPANY_DTO_COLUMNS_SQL} ${COMPANY_DTO_FROM_SQL} WHERE c.id = ?`).get(id) as
    | CompanyRow
    | undefined
  return row ? mapCompanyRow(row) : null
}

export interface ListCompaniesOptions {
  role: 'all' | 'developer' | 'publisher'
  q?: string
  country?: string
  letter?: string
  sort: 'name' | 'games' | 'country' | 'founded'
}

const SORT_EXPR: Record<ListCompaniesOptions['sort'], string> = {
  name: 'c.sort_name ASC',
  games: 'gameCount DESC, c.sort_name ASC',
  country: '(c.country_code IS NULL) ASC, c.country_code ASC, c.sort_name ASC',
  founded: '(c.founded_year IS NULL) ASC, c.founded_year ASC, c.sort_name ASC'
}

export function listCompanies(db: Db, opts: ListCompaniesOptions): CompanyDto[] {
  const where: string[] = []
  const params: unknown[] = []
  if (opts.role === 'developer') where.push('c.is_developer = 1')
  else if (opts.role === 'publisher') where.push('c.is_publisher = 1')
  if (opts.q?.trim()) {
    where.push("c.name LIKE ? ESCAPE '\\'")
    params.push(`%${opts.q.trim().replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`)
  }
  if (opts.country) {
    where.push('c.country_code = ?')
    params.push(opts.country.toUpperCase())
  }
  if (opts.letter) {
    if (opts.letter === '#') {
      // Приближение: GLOB работает побайтово, кириллица не входит в класс — ASCII-буквы считаются «буквами».
      where.push("c.sort_name NOT GLOB '[A-Za-z]*'")
    } else {
      where.push('c.sort_name LIKE ? COLLATE NOCASE')
      params.push(`${opts.letter}%`)
    }
  }
  const sql =
    `SELECT ${COMPANY_DTO_COLUMNS_SQL} ${COMPANY_DTO_FROM_SQL}` +
    (where.length > 0 ? ` WHERE ${where.join(' AND ')}` : '') +
    ` ORDER BY ${SORT_EXPR[opts.sort]}`
  const rows = db.prepare(sql).all(...params) as CompanyRow[]
  return rows.map(mapCompanyRow)
}

export function getCompanyChildren(db: Db, parentId: string): CompanyDto[] {
  const rows = db
    .prepare(`SELECT ${COMPANY_DTO_COLUMNS_SQL} ${COMPANY_DTO_FROM_SQL} WHERE c.parent_company_id = ? ORDER BY c.sort_name`)
    .all(parentId) as CompanyRow[]
  return rows.map(mapCompanyRow)
}

/** Серии, где у компании есть хотя бы одна игра (06 §5.2, вкладка «Серии»). */
export function getCompanySeries(db: Db, companyId: string): Array<SeriesDto & { companyGameCount: number }> {
  const sql = `
    SELECT ${SERIES_DTO_COLUMNS_SQL},
      (SELECT COUNT(DISTINCT sg2.game_id) FROM series_games sg2 JOIN game_companies gc2 ON gc2.game_id = sg2.game_id
         WHERE sg2.series_id = s.id AND gc2.company_id = ?) AS companyGameCount
    ${SERIES_DTO_FROM_SQL}
    WHERE EXISTS (
      SELECT 1 FROM series_games sg3 JOIN game_companies gc3 ON gc3.game_id = sg3.game_id
      WHERE sg3.series_id = s.id AND gc3.company_id = ?
    )
    ORDER BY s.sort_name
  `
  const rows = db.prepare(sql).all(companyId, companyId) as Array<{
    id: string
    name: string
    slug: string
    sortName: string
    kind: string
    description: string | null
    coverImageId: string | null
    coverFile: string | null
    bannerImageId: string | null
    bannerFile: string | null
    dominantColor: string | null
    parentSeriesId: string | null
    parentSeriesName: string | null
    gameCount: number
    completedCount: number
    mainLineCount: number
    yearFrom: number | null
    yearTo: number | null
    playtimeMinutes: number
    createdAt: string
    updatedAt: string
    companyGameCount: number
  }>
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    sortName: row.sortName,
    kind: row.kind as SeriesDto['kind'],
    description: row.description,
    coverImageId: row.coverImageId,
    coverFile: row.coverFile,
    bannerImageId: row.bannerImageId,
    bannerFile: row.bannerFile,
    dominantColor: row.dominantColor,
    parentSeriesId: row.parentSeriesId,
    parentSeriesName: row.parentSeriesName,
    gameCount: row.gameCount,
    completedCount: row.completedCount,
    mainLineCount: row.mainLineCount,
    yearFrom: row.yearFrom,
    yearTo: row.yearTo,
    playtimeMinutes: row.playtimeMinutes,
    coverMosaic: getSeriesCoverMosaic(db, row.id),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    companyGameCount: row.companyGameCount
  }))
}

export function companyExists(db: Db, id: string): boolean {
  return db.prepare('SELECT 1 FROM companies WHERE id = ?').get(id) != null
}

export function companySlugTaken(db: Db, slug: string, excludeId?: string): boolean {
  return db.prepare('SELECT id FROM companies WHERE slug = ? AND id <> ?').get(slug, excludeId ?? '') != null
}

export function companyGameCount(db: Db, id: string): number {
  const row = db.prepare('SELECT COUNT(*) AS n FROM game_companies WHERE company_id = ?').get(id) as { n: number }
  return row.n
}

export interface CompanyEditData {
  name: string
  sortName: string
  slug: string
  isDeveloper: boolean
  isPublisher: boolean
  countryCode: string | null
  city: string | null
  foundedYear: number | null
  closedYear: number | null
  description: string | null
  website: string | null
  logoImageId: string | null
  bannerImageId: string | null
  parentCompanyId: string | null
}

export function getCompanyEditData(db: Db, id: string): CompanyEditData | null {
  const row = db
    .prepare(
      `SELECT name, sort_name AS sortName, slug, is_developer AS isDeveloper, is_publisher AS isPublisher,
              country_code AS countryCode, city, founded_year AS foundedYear, closed_year AS closedYear,
              description, website, logo_image_id AS logoImageId, banner_image_id AS bannerImageId,
              parent_company_id AS parentCompanyId
       FROM companies WHERE id = ?`
    )
    .get(id) as
    | (Omit<CompanyEditData, 'isDeveloper' | 'isPublisher'> & { isDeveloper: number; isPublisher: number })
    | undefined
  if (!row) return null
  return { ...row, isDeveloper: toBool(row.isDeveloper), isPublisher: toBool(row.isPublisher) }
}

export interface CompanyWriteColumns {
  name: string
  sortName: string
  slug: string
  isDeveloper: boolean
  isPublisher: boolean
  countryCode: string | null
  countryNumeric: number | null
  city: string | null
  foundedYear: number | null
  closedYear: number | null
  description: string | null
  website: string | null
  logoImageId: string | null
  bannerImageId: string | null
  parentCompanyId: string | null
}

export function insertCompanyRow(db: Db, id: string, c: CompanyWriteColumns, nowTs: string): void {
  db.prepare(
    `INSERT INTO companies(
       id, name, slug, sort_name, is_developer, is_publisher, country_code, country_numeric, city,
       founded_year, closed_year, description, website, logo_image_id, banner_image_id, parent_company_id,
       created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    c.name,
    c.slug,
    c.sortName,
    c.isDeveloper ? 1 : 0,
    c.isPublisher ? 1 : 0,
    c.countryCode,
    c.countryNumeric,
    c.city,
    c.foundedYear,
    c.closedYear,
    c.description,
    c.website,
    c.logoImageId,
    c.bannerImageId,
    c.parentCompanyId,
    nowTs,
    nowTs
  )
}

export function updateCompanyRow(db: Db, id: string, c: CompanyWriteColumns, nowTs: string): void {
  db.prepare(
    `UPDATE companies SET
       name = ?, slug = ?, sort_name = ?, is_developer = ?, is_publisher = ?, country_code = ?,
       country_numeric = ?, city = ?, founded_year = ?, closed_year = ?, description = ?, website = ?,
       logo_image_id = ?, banner_image_id = ?, parent_company_id = ?, updated_at = ?
     WHERE id = ?`
  ).run(
    c.name,
    c.slug,
    c.sortName,
    c.isDeveloper ? 1 : 0,
    c.isPublisher ? 1 : 0,
    c.countryCode,
    c.countryNumeric,
    c.city,
    c.foundedYear,
    c.closedYear,
    c.description,
    c.website,
    c.logoImageId,
    c.bannerImageId,
    c.parentCompanyId,
    nowTs,
    id
  )
}

export function deleteCompanyRow(db: Db, id: string): void {
  db.prepare('DELETE FROM companies WHERE id = ?').run(id)
}

/** Переносит все связи компании `fromId` на `intoId` (06 §7.4 «Объединить с другой компанией»). */
export function mergeCompanyRows(db: Db, fromId: string, intoId: string): void {
  db.prepare("UPDATE OR IGNORE game_companies SET company_id = ? WHERE company_id = ?").run(intoId, fromId)
  db.prepare('DELETE FROM game_companies WHERE company_id = ?').run(fromId)
  db.prepare('UPDATE companies SET parent_company_id = ? WHERE parent_company_id = ?').run(intoId, fromId)
  db.prepare('DELETE FROM companies WHERE id = ?').run(fromId)
}
