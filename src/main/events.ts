import { BrowserWindow } from 'electron'
import type { AppEvent } from '@shared/ipc-contract'

/** Шина событий main → renderer (01 §5). */
export function broadcast(event: AppEvent): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send('backlog:event', event)
  }
}

type Listener = (event: AppEvent) => void
const localListeners = new Set<Listener>()

/** Подписка внутри main-процесса (например, планировщик синхронизации). */
export function onAppEvent(listener: Listener): () => void {
  localListeners.add(listener)
  return () => localListeners.delete(listener)
}

export function emitAppEvent(event: AppEvent): void {
  broadcast(event)
  for (const listener of localListeners) {
    try {
      listener(event)
    } catch {
      /* слушатели не должны ломать вызывающего */
    }
  }
}
