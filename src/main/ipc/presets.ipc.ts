import { handle } from './register'
import { deletePresetService, listPresetsService, savePreset } from '../services/presets.service'

/** Пресеты фильтров (ТЗ 07 §2). */
export function registerPresetsIpc(): void {
  handle('presets.list', ({ scope }) => listPresetsService(scope))
  handle('presets.save', (input) => savePreset(input))
  handle('presets.delete', ({ id }) => {
    deletePresetService(id)
    return { ok: true as const }
  })
}
