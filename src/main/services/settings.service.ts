import fs from 'node:fs'
import { DEFAULT_SETTINGS, settingsSchema, type Settings, type SettingsPatch } from '@shared/schema/settings'
import { settingsFile } from '../paths'
import { log } from '../log'
import { newId } from '../db/utils'

let cache: Settings | null = null

/** Локальные настройки этого ПК (02 §7). Никогда не синхронизируются. */
export function getSettings(): Settings {
  if (cache) return cache
  try {
    // BOM в начале файла ломает JSON.parse — файл мог быть отредактирован руками
    // редактором, который его добавляет (например, PowerShell `Out-File -Encoding utf8`).
    const raw = fs.readFileSync(settingsFile(), 'utf8').replace(/^\uFEFF/, '')
    const parsed = settingsSchema.safeParse(JSON.parse(raw))
    cache = parsed.success ? parsed.data : { ...DEFAULT_SETTINGS }
    if (!parsed.success) log.warn('[settings] файл повреждён, применены значения по умолчанию')
  } catch {
    cache = { ...DEFAULT_SETTINGS }
  }
  if (!cache.deviceId) {
    cache.deviceId = newId()
    persist(cache)
  }
  return cache
}

function persist(value: Settings): void {
  try {
    fs.writeFileSync(settingsFile(), `${JSON.stringify(value, null, 2)}\n`, 'utf8')
  } catch (err) {
    log.error('[settings] не удалось сохранить', err)
  }
}

export function patchSettings(patch: SettingsPatch): Settings {
  const current = getSettings()
  const merged: Settings = {
    ...current,
    ...patch,
    window: { ...current.window, ...(patch.window ?? {}) },
    sync: { ...current.sync, ...(patch.sync ?? {}) },
    backups: { ...current.backups, ...(patch.backups ?? {}) },
    viewByScope: { ...current.viewByScope, ...(patch.viewByScope ?? {}) },
    filterPanelByScope: { ...current.filterPanelByScope, ...(patch.filterPanelByScope ?? {}) }
  }
  cache = settingsSchema.parse(merged)
  persist(cache)
  return cache
}

export function resetSettingsCache(): void {
  cache = null
}
