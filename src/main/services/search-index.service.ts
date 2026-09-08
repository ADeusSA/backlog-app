/**
 * Поддержка `search_index` (FTS5) при записи в games/companies/series/lists (02 §3.15).
 * Обновляется приложением, а не триггерами — вся логика в одном месте (02 §3.15 примечание).
 * Если FTS5 недоступен — поиск деградирует до LIKE, и функции ниже становятся no-op.
 */
import type { Db } from '../db/connection'
import { hasFts5 } from '../db/connection'
import { translitToCyrillic, translitToLatin } from '@shared/text'

export type SearchEntityType = 'game' | 'company' | 'series' | 'list'

/** Пересобирает строку `search_index` для сущности: удаляет старую запись и вставляет новую. */
export function upsertSearchIndex(conn: Db, entityType: SearchEntityType, entityId: string, title: string, altTitles: string[] = []): void {
  if (!hasFts5()) return
  conn.prepare('DELETE FROM search_index WHERE entity_type = ? AND entity_id = ?').run(entityType, entityId)
  const variants = new Set<string>()
  for (const t of [title, ...altTitles]) {
    if (!t) continue
    variants.add(t)
    variants.add(translitToLatin(t))
    variants.add(translitToCyrillic(t))
  }
  variants.delete(title)
  const altTitlesText = [...variants].join(' ')
  conn
    .prepare('INSERT INTO search_index(entity_type, entity_id, title, alt_titles) VALUES (?, ?, ?, ?)')
    .run(entityType, entityId, title, altTitlesText)
}

export function removeFromSearchIndex(conn: Db, entityType: SearchEntityType, entityId: string): void {
  if (!hasFts5()) return
  conn.prepare('DELETE FROM search_index WHERE entity_type = ? AND entity_id = ?').run(entityType, entityId)
}
