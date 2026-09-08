import { handle } from './register'
import {
  getCompany,
  getCompanyChildrenService,
  getCompanySeriesService,
  listCompaniesService
} from '../services/companies.service'

/** Студии и издатели (ТЗ 06 §5). */
export function registerCompaniesIpc(): void {
  handle('companies.list', (input) =>
    listCompaniesService({
      role: input?.role ?? 'all',
      sort: input?.sort ?? 'name',
      ...(input?.q ? { q: input.q } : {}),
      ...(input?.country ? { country: input.country } : {}),
      ...(input?.letter ? { letter: input.letter } : {})
    })
  )
  handle('companies.get', ({ id }) => getCompany(id))
  handle('companies.series', ({ id }) => getCompanySeriesService(id))
  handle('companies.children', ({ id }) => getCompanyChildrenService(id))
}
