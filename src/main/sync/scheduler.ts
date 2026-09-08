import { Notification } from 'electron'
import { onAppEvent } from '../events'
import { log } from '../log'
import { getSettings } from '../services/settings.service'
import { getSyncEngine } from './engine'

/**
 * Планировщик синхронизации (03 §5.2; 01 §10; 05 §1):
 * - pull при старте приложения;
 * - push по дебаунсу 60 с после записи, но не реже интервала из настроек при непрерывной работе;
 * - push немедленно при закрытии окна (см. `flushBeforeQuit`, вызывается из `main/index.ts`);
 * - режим «Только вручную» отключает автоматику (остаются кнопка и выход).
 * Никогда не блокирует UI — все операции асинхронны и идут через один и тот же `SyncEngine`
 * (внутренний мьютекс `busy` не даёт push/pull пересекаться).
 */

const DEBOUNCE_MS = 60_000
const QUIT_FLUSH_TIMEOUT_MS = 30_000

let debounceTimer: ReturnType<typeof setTimeout> | null = null
let maxWaitTimer: ReturnType<typeof setTimeout> | null = null
let unsubscribeDbChanged: (() => void) | null = null
let started = false
let quitFlushDone = false

function engine() {
  return getSyncEngine()
}

function clearTimers(): void {
  if (debounceTimer) {
    clearTimeout(debounceTimer)
    debounceTimer = null
  }
  if (maxWaitTimer) {
    clearTimeout(maxWaitTimer)
    maxWaitTimer = null
  }
}

function triggerDebouncedPush(): void {
  clearTimers()
  void engine().runPush()
}

/**
 * Реакция на запись в базу (03 §5.2): таймер 60 с, сбрасывается новыми записями, но не реже
 * `settings.sync.intervalMinutes` при непрерывной работе (debounce + maxWait).
 */
export function notifyLocalWrite(): void {
  const settings = getSettings()
  if (!settings.sync.enabled || settings.sync.mode !== 'auto') return
  if (!engine().isSignedIn()) return

  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(triggerDebouncedPush, DEBOUNCE_MS)
  debounceTimer.unref?.()

  if (!maxWaitTimer) {
    const intervalMs = settings.sync.intervalMinutes * 60_000
    maxWaitTimer = setTimeout(triggerDebouncedPush, intervalMs)
    maxWaitTimer.unref?.()
  }
}

function notifyQuitSaving(): void {
  try {
    if (Notification.isSupported()) {
      new Notification({ title: 'Backlog', body: 'Сохраняем изменения в облако перед выходом…' }).show()
    }
  } catch (err) {
    log.warn('[sync] не удалось показать системное уведомление', err)
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function isQuitFlushDone(): boolean {
  return quitFlushDone
}

/**
 * Вызывается из `main/index.ts` при `before-quit` ДО закрытия базы: ждёт завершения push,
 * но не более 30 с (03 §7; 05 §1). Идемпотентна — второй вызов возвращается сразу.
 */
export async function flushBeforeQuit(): Promise<void> {
  if (quitFlushDone) return
  try {
    clearTimers()
    const settings = getSettings()
    if (settings.sync.enabled && engine().isSignedIn() && engine().getState().pendingChanges) {
      notifyQuitSaving()
      await Promise.race([engine().runPush(), delay(QUIT_FLUSH_TIMEOUT_MS)])
    }
  } catch (err) {
    log.warn('[sync] финальная выгрузка перед выходом не удалась', err)
  } finally {
    quitFlushDone = true
  }
}

/** Подписка на записи в базу + pull при старте. Идемпотентна, вызывается из `registerSyncIpc()`. */
export function initScheduler(): void {
  if (started) return
  started = true

  unsubscribeDbChanged = onAppEvent((event) => {
    if (event.type === 'dbChanged') notifyLocalWrite()
  })

  // Pull при запуске (03 §5.1) — не блокирует создание окна.
  setTimeout(() => {
    if (engine().isSignedIn()) void engine().runPull()
  }, 0)
}

/** Для тестов: сбросить состояние планировщика. */
export function disposeScheduler(): void {
  clearTimers()
  unsubscribeDbChanged?.()
  unsubscribeDbChanged = null
  started = false
  quitFlushDone = false
}
