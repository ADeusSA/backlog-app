import { handle } from './register'
import { pushRecent, recentEntities, reindexSearch, searchEverything } from '../services/search.service'

/** Глобальный поиск и командная палитра (ТЗ 05 §6). */
export function registerSearchIpc(): void {
  handle('search.query', ({ q, limit }) => searchEverything(q, limit))
  handle('search.recent', () => recentEntities())
  handle('search.pushRecent', ({ entityType, id }) => {
    pushRecent(entityType, id)
    return { ok: true as const }
  })
  handle('search.reindex', () => ({ rows: reindexSearch() }))
}
