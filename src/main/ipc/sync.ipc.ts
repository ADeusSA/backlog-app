import { handle } from './register'
import { getSyncEngine } from '../sync/engine'
import { initScheduler } from '../sync/scheduler'

/**
 * Каналы `sync.*` (03; 01 §5). Реальный протокол — `sync/engine.ts`; здесь только тонкая
 * IPC-обвязка. `initScheduler()` идемпотентна: подписывает push на записи в базу и планирует
 * pull при запуске (03 §5.1–§5.2).
 */
export function registerSyncIpc(): void {
  const engine = getSyncEngine()
  initScheduler()

  handle('sync.getState', () => engine.getState())
  handle('sync.signIn', () => engine.signIn())
  handle('sync.signOut', () => engine.signOut())
  // «Синхронизировать сейчас» — pull (§5.1), который сам выгружает локальные изменения,
  // если облако не менялось (§5.1.3), либо обнаруживает конфликт.
  handle('sync.now', () => engine.runPull())
  handle('sync.resolveConflict', ({ choice }) => engine.resolveConflict(choice))
  handle('sync.getLog', () => engine.getLog())
}
