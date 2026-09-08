import type { SearchResult } from '@shared/schema/entities'
import { getDb, write } from '../db/connection'
import { reindexAll, searchAll } from '../db/repositories/search.repo'
import { upsertSearchIndex } from './search-index.service'
import { getSettings, patchSettings } from './settings.service'

/** Поиск и «недавние» для командной палитры (ТЗ 05 §6). */
export function searchEverything(q: string, limit: number): SearchResult {
  const trimmed = q.trim()
  if (!trimmed) return { games: [], series: [], companies: [], lists: [] }
  return searchAll(getDb(), trimmed, limit)
}

export interface RecentEntity {
  entityType: string
  id: string
  name: string
  coverFile: string | null
}

/**
 * Недавно открытые сущности хранятся в локальных настройках (settings.json):
 * это состояние конкретного ПК и в облако не синхронизируется.
 */
export function recentEntities(): RecentEntity[] {
  const db = getDb()
  const result: RecentEntity[] = []

  for (const entry of getSettings().recentSearch) {
    const row = lookup(entry.entityType, entry.id)
    if (row) result.push(row)
  }
  return result

  function lookup(entityType: string, id: string): RecentEntity | null {
    switch (entityType) {
      case 'game': {
        const row = db
          .prepare(
            `SELECT g.title AS name, i.file_name AS coverFile
               FROM games g LEFT JOIN images i ON i.id = g.cover_image_id WHERE g.id = ?`
          )
          .get(id) as { name: string; coverFile: string | null } | undefined
        return row ? { entityType, id, name: row.name, coverFile: row.coverFile } : null
      }
      case 'series': {
        const row = db.prepare('SELECT name FROM series WHERE id = ?').get(id) as { name: string } | undefined
        return row ? { entityType, id, name: row.name, coverFile: null } : null
      }
      case 'company': {
        const row = db.prepare('SELECT name FROM companies WHERE id = ?').get(id) as { name: string } | undefined
        return row ? { entityType, id, name: row.name, coverFile: null } : null
      }
      case 'list': {
        const row = db.prepare('SELECT name FROM lists WHERE id = ?').get(id) as { name: string } | undefined
        return row ? { entityType, id, name: row.name, coverFile: null } : null
      }
      default:
        return null
    }
  }
}

export function pushRecent(entityType: string, id: string): void {
  const current = getSettings().recentSearch.filter(
    (entry) => !(entry.entityType === entityType && entry.id === id)
  )
  patchSettings({ recentSearch: [{ entityType, id }, ...current].slice(0, 8) })
}

/** Полная перестройка поискового индекса (после восстановления базы или импорта). */
export function reindexSearch(): number {
  return write(['search_index'], (db) =>
    reindexAll(db, (entityType, id, title, altTitles) =>
      upsertSearchIndex(db, entityType, id, title, altTitles)
    )
  )
}
