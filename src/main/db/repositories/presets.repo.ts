/** Репозиторий пресетов фильтров коллекции (02 §3.12, 07 §2). */
import type { Db } from '../connection'
import { type FilterPresetDto, filterPresetDtoSchema } from '@shared/schema/entities'

interface PresetRow {
  id: string
  scope: string
  name: string
  filters_json: string
  sort_json: string
  view: string
  sort_order: number
}

function mapPreset(row: PresetRow): FilterPresetDto {
  return filterPresetDtoSchema.parse({
    id: row.id,
    scope: row.scope,
    name: row.name,
    filtersJson: row.filters_json,
    sortJson: row.sort_json,
    view: row.view,
    sortOrder: row.sort_order
  })
}

export function listPresets(db: Db, scope: string): FilterPresetDto[] {
  const rows = db
    .prepare('SELECT * FROM filter_presets WHERE scope = ? ORDER BY sort_order, name COLLATE NOCASE')
    .all(scope) as PresetRow[]
  return rows.map(mapPreset)
}

export function presetExists(db: Db, id: string): boolean {
  return db.prepare('SELECT 1 FROM filter_presets WHERE id = ?').get(id) != null
}

export interface PresetWriteInput {
  scope: string
  name: string
  filtersJson: string
  sortJson: string
  view: string
}

export function insertPreset(db: Db, id: string, input: PresetWriteInput, sortOrder: number, nowTs: string): void {
  db.prepare(
    `INSERT INTO filter_presets(id, scope, name, filters_json, sort_json, view, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, input.scope, input.name, input.filtersJson, input.sortJson, input.view, sortOrder, nowTs, nowTs)
}

export function updatePreset(db: Db, id: string, input: PresetWriteInput, nowTs: string): void {
  db.prepare(
    `UPDATE filter_presets SET scope = ?, name = ?, filters_json = ?, sort_json = ?, view = ?, updated_at = ?
     WHERE id = ?`
  ).run(input.scope, input.name, input.filtersJson, input.sortJson, input.view, nowTs, id)
}

export function deletePreset(db: Db, id: string): void {
  db.prepare('DELETE FROM filter_presets WHERE id = ?').run(id)
}

export function nextPresetSortOrder(db: Db, scope: string): number {
  const row = db.prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 AS n FROM filter_presets WHERE scope = ?').get(scope) as {
    n: number
  }
  return row.n
}

export function getPreset(db: Db, id: string): FilterPresetDto | null {
  const row = db.prepare('SELECT * FROM filter_presets WHERE id = ?').get(id) as PresetRow | undefined
  return row ? mapPreset(row) : null
}
