import { create } from 'zustand'
import { useSettingsStore } from './settings-store'

/** Запись в стеке истории — для выпадающего списка у кнопок «назад/вперёд» (05 §2). */
export interface HistoryEntry {
  href: string
  title: string
  at: number
}

interface UiState {
  sidebarCollapsed: boolean
  toggleSidebar: () => void
  setSidebarCollapsed: (value: boolean) => void

  /** Мультивыбор карточек в текущей коллекции (07 §3). */
  selection: Set<string>
  lastSelectedId: string | null
  toggleSelected: (id: string, range?: string[]) => void
  setSelection: (ids: string[]) => void
  clearSelection: () => void

  /** Стек заголовков для истории навигации. */
  history: HistoryEntry[]
  historyIndex: number
  pushHistory: (entry: HistoryEntry) => void
  setHistoryIndex: (index: number) => void

  commandPaletteOpen: boolean
  setCommandPaletteOpen: (open: boolean) => void

  hotkeysHelpOpen: boolean
  setHotkeysHelpOpen: (open: boolean) => void

  /** Диалог «Редактировать профиль» — открывается из шапки и из вкладки «Статистика» (06 §1.1). */
  profileEditOpen: boolean
  setProfileEditOpen: (open: boolean) => void

  /** Поиск внутри коллекции (Ctrl+F). */
  quickFilterOpen: boolean
  setQuickFilterOpen: (open: boolean) => void
}

export const useUiStore = create<UiState>((set, get) => ({
  sidebarCollapsed: true,
  toggleSidebar: () => {
    const next = !get().sidebarCollapsed
    set({ sidebarCollapsed: next })
    // Состояние сайдбара запоминается между запусками (05 §3).
    void useSettingsStore.getState().patch({ sidebarCollapsed: next })
  },
  setSidebarCollapsed: (value) => set({ sidebarCollapsed: value }),

  selection: new Set<string>(),
  lastSelectedId: null,
  toggleSelected: (id, range) => {
    const next = new Set(get().selection)
    if (range && range.length > 0) {
      for (const rangeId of range) next.add(rangeId)
    } else if (next.has(id)) {
      next.delete(id)
    } else {
      next.add(id)
    }
    set({ selection: next, lastSelectedId: id })
  },
  setSelection: (ids) => set({ selection: new Set(ids) }),
  clearSelection: () => set({ selection: new Set<string>(), lastSelectedId: null }),

  history: [],
  historyIndex: -1,
  pushHistory: (entry) =>
    set((s) => {
      const trimmed = s.history.slice(0, s.historyIndex + 1)
      trimmed.push(entry)
      const limited = trimmed.slice(-50)
      return { history: limited, historyIndex: limited.length - 1 }
    }),
  setHistoryIndex: (index) => set({ historyIndex: index }),

  commandPaletteOpen: false,
  setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),

  hotkeysHelpOpen: false,
  setHotkeysHelpOpen: (open) => set({ hotkeysHelpOpen: open }),

  profileEditOpen: false,
  setProfileEditOpen: (open) => set({ profileEditOpen: open }),

  quickFilterOpen: false,
  setQuickFilterOpen: (open) => set({ quickFilterOpen: open })
}))
