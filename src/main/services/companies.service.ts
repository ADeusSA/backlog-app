/**
 * Бизнес-правила студий/издателей (06 §5, §7.4; 02 §4): слаг/sort_name, запрет удаления
 * компании с играми, объединение дублей, происхождение полей, поисковый индекс.
 */
import { getDb, write } from '../db/connection'
import type { Db } from '../db/connection'
import { deleteEntity } from '../db/connection'
import { newId, now } from '../db/utils'
import { ensureUniqueSlug, makeSlug, makeSortTitle } from '@shared/text'
import { AppError } from '@shared/errors'
import { COUNTRY_BY_CODE } from '@shared/countries'
import {
  companyExists,
  companyGameCount,
  companySlugTaken,
  deleteCompanyRow,
  getCompanyChildren,
  getCompanyDto,
  getCompanyEditData,
  getCompanySeries,
  insertCompanyRow,
  listCompanies,
  type ListCompaniesOptions,
  mergeCompanyRows,
  updateCompanyRow,
  type CompanyWriteColumns
} from '../db/repositories/companies.repo'
import { removeFromSearchIndex, upsertSearchIndex } from './search-index.service'
import { lockManualFields } from './field-provenance.service'
import { logActivity } from './activity.service'
import { type CompanyDto, type CompanyInput, companyInputSchema, type SeriesDto } from '@shared/schema/entities'

const TRACKED_FIELDS = ['name', 'description', 'logoImageId', 'bannerImageId', 'countryCode']

export function listCompaniesService(opts: ListCompaniesOptions): CompanyDto[] {
  return listCompanies(getDb(), opts)
}

export function getCompany(id: string): CompanyDto | null {
  return getCompanyDto(getDb(), id)
}

export function getCompanyChildrenService(id: string): CompanyDto[] {
  return getCompanyChildren(getDb(), id)
}

export function getCompanySeriesService(id: string): Array<SeriesDto & { companyGameCount: number }> {
  return getCompanySeries(getDb(), id)
}

export function getCompanyForEdit(id: string): CompanyInput | null {
  const data = getCompanyEditData(getDb(), id)
  if (!data) return null
  return companyInputSchema.parse({ id, ...data })
}

export function applySaveCompany(conn: Db, input: CompanyInput): string {
  const nowTs = now()
  const isCreate = !input.id || !companyExists(conn, input.id)
  const id = input.id ?? newId()

  const sortName = input.sortName?.trim() || makeSortTitle(input.name)
  let slug = input.slug?.trim()
  if (!slug) {
    slug = ensureUniqueSlug(makeSlug(input.name), (s) => companySlugTaken(conn, s, isCreate ? undefined : id))
  } else if (companySlugTaken(conn, slug, isCreate ? undefined : id)) {
    throw new AppError('duplicate_slug', `Slug «${slug}» уже занят`)
  }

  const countryCode = input.countryCode ? input.countryCode.toUpperCase() : null
  const columns: CompanyWriteColumns = {
    name: input.name,
    sortName,
    slug,
    isDeveloper: input.isDeveloper,
    isPublisher: input.isPublisher,
    countryCode,
    countryNumeric: countryCode ? (COUNTRY_BY_CODE.get(countryCode)?.numeric ?? null) : null,
    city: input.city ?? null,
    foundedYear: input.foundedYear ?? null,
    closedYear: input.closedYear ?? null,
    description: input.description ?? null,
    website: input.website ?? null,
    logoImageId: input.logoImageId ?? null,
    bannerImageId: input.bannerImageId ?? null,
    parentCompanyId: input.parentCompanyId ?? null
  }

  if (isCreate) insertCompanyRow(conn, id, columns, nowTs)
  else updateCompanyRow(conn, id, columns, nowTs)

  lockManualFields(conn, 'company', id, TRACKED_FIELDS)
  upsertSearchIndex(conn, 'company', id, input.name)
  logActivity(conn, isCreate ? 'catalog_created' : 'catalog_edited', {
    entityType: 'company',
    entityId: id,
    payload: { name: input.name }
  })

  return id
}

export function saveCompany(input: CompanyInput): string {
  return write(['companies'], (conn) => applySaveCompany(conn, input))
}

export function deleteCompany(id: string): void {
  write(['companies', 'game_companies'], (conn) => {
    const count = companyGameCount(conn, id)
    if (count > 0) {
      throw new AppError('company_has_games', `У компании ${count} игр(ы). Сначала переназначьте их`, { count })
    }
    removeFromSearchIndex(conn, 'company', id)
    deleteCompanyRow(conn, id)
    deleteEntity(conn, 'company', id)
  })
}

export function mergeCompanies(fromId: string, intoId: string): void {
  if (fromId === intoId) throw new AppError('validation', 'Нельзя объединить компанию саму с собой')
  write(['companies', 'game_companies'], (conn) => {
    if (!companyExists(conn, fromId) || !companyExists(conn, intoId)) {
      throw new AppError('not_found', 'Компания не найдена')
    }
    mergeCompanyRows(conn, fromId, intoId)
    removeFromSearchIndex(conn, 'company', fromId)
    deleteEntity(conn, 'company', fromId)
  })
}
