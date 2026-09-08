import { create } from 'zustand'
import { DEFAULT_SETTINGS, type Settings, type SettingsPatch } from '@shared/schema/settings'
import type { ViewMode } from '@shared/constants'
import { call } from '@/platform/api'

interface SettingsState {
  settings: Settings
  loaded: boolean
  load: () => Promise<void>
  patch: (patch: SettingsPatch) => Promise<void>
  /** Вид коллекции запоминается отдельно для каждого scope (07 §11.1). */
  setScopeView: (scopeKey: string, view: ViewMode) => void
  setFilterPanel: (scopeKey: string, open: boolean) => void
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  loaded: false,

  load: async () => {
    const settings = await call('settings.get')
    set({ settings, loaded: true })
    applyDocumentSettings(settings)
  },

  patch: async (patch) => {
    // Оптимистично: UI реагирует мгновенно, файл пишется следом.
    // Вложенные объекты сливаем по ключам — так же, как main, иначе частичный
    // патч (например `{ sync: { mode } }`) затёр бы остальные поля до ответа.
    const current = get().settings
    const optimistic: Settings = {
      ...current,
      ...patch,
      window: { ...current.window, ...(patch.window ?? {}) },
      sync: { ...current.sync, ...(patch.sync ?? {}) },
      backups: { ...current.backups, ...(patch.backups ?? {}) },
      viewByScope: { ...current.viewByScope, ...(patch.viewByScope ?? {}) },
      filterPanelByScope: { ...current.filterPanelByScope, ...(patch.filterPanelByScope ?? {}) }
    }
    set({ settings: optimistic })
    applyDocumentSettings(optimistic)
    const saved = await call('settings.patch', patch)
    set({ settings: saved })
    applyDocumentSettings(saved)
  },

  setScopeView: (scopeKey, view) => {
    void get().patch({ viewByScope: { [scopeKey]: view } })
  },

  setFilterPanel: (scopeKey, open) => {
    void get().patch({ filterPanelByScope: { [scopeKey]: open } })
  }
}))

/** Применение настроек к документу: язык, уровень анимаций (04 §5). */
export function applyDocumentSettings(settings: Settings): void {
  document.documentElement.lang = settings.locale
  document.documentElement.dataset['motion'] = settings.animations
}

export function useSettings(): Settings {
  return useSettingsStore((s) => s.settings)
}
