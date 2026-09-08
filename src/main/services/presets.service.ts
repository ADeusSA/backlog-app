import { AppError } from '@shared/errors'
import type { FilterPresetDto } from '@shared/schema/entities'
import { getDb, write } from '../db/connection'
import { newId, now } from '../db/utils'
import {
  deletePreset,
  getPreset,
  insertPreset,
  listPresets,
  nextPresetSortOrder,
  presetExists,
  updatePreset
} from '../db/repositories/presets.repo'

/** Пресеты фильтров (ТЗ 07 §2): чипы под заголовком коллекции. */
export function listPresetsService(scope: string): FilterPresetDto[] {
  return listPresets(getDb(), scope)
}

export interface SavePresetInput {
  id?: string
  scope: string
  name: string
  filtersJson: string
  sortJson: string
  view: string
}

export function savePreset(input: SavePresetInput): FilterPresetDto {
  return write(['filter_presets'], (db) => {
    const timestamp = now()
    const payload = {
      scope: input.scope,
      name: input.name,
      filtersJson: input.filtersJson,
      sortJson: input.sortJson,
      view: input.view
    }
    let id = input.id
    if (id && presetExists(db, id)) {
      updatePreset(db, id, payload, timestamp)
    } else {
      id = id ?? newId()
      insertPreset(db, id, payload, nextPresetSortOrder(db, input.scope), timestamp)
    }
    const saved = getPreset(db, id)
    if (!saved) throw new AppError('not_found', 'Пресет не сохранился')
    return saved
  })
}

export function deletePresetService(id: string): void {
  write(['filter_presets'], (db) => {
    deletePreset(db, id)
  })
}
