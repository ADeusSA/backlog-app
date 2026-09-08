import { create } from 'zustand'
import type { SyncState } from '@shared/schema/settings'
import { call } from '@/platform/api'
import { onAppEvent } from '@/platform/events'

const initial: SyncState = {
  status: 'disabled',
  accountEmail: null,
  lastPushAt: null,
  lastPullAt: null,
  lastError: null,
  pendingChanges: false,
  progress: null
}

interface SyncStore {
  state: SyncState
  set: (state: SyncState) => void
  refresh: () => Promise<void>
}

export const useSyncStore = create<SyncStore>((set) => ({
  state: initial,
  set: (state) => set({ state }),
  refresh: async () => {
    try {
      set({ state: await call('sync.getState') })
    } catch {
      /* синхронизация может быть не настроена — это нормальное состояние */
    }
  }
}))

/** Подписка на события синхронизации из main (03 §8). */
export function bindSyncEvents(): () => void {
  return onAppEvent((event) => {
    if (event.type === 'syncState') useSyncStore.getState().set(event.state)
  })
}
