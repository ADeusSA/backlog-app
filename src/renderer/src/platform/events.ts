import type { QueryClient } from '@tanstack/react-query'
import { TABLE_TO_QUERY_KEYS, type AppEvent } from '@shared/ipc-contract'

type Handler = (event: AppEvent) => void

const handlers = new Set<Handler>()
let unsubscribeBridge: (() => void) | null = null

function ensureBridge(): void {
  if (unsubscribeBridge || !window.backlog) return
  unsubscribeBridge = window.backlog.on((event) => {
    for (const handler of handlers) handler(event)
  })
}

/** Подписка на события main → renderer (01 §5). */
export function onAppEvent(handler: Handler): () => void {
  handlers.add(handler)
  ensureBridge()
  return () => {
    handlers.delete(handler)
  }
}

/**
 * Инвалидация кеша TanStack Query по событию `dbChanged` (01 §9).
 * Карта «таблица → ключи» живёт в общем контракте, чтобы backend и UI не расходились.
 */
export function bindQueryInvalidation(queryClient: QueryClient): () => void {
  return onAppEvent((event) => {
    if (event.type === 'dbReplaced') {
      void queryClient.invalidateQueries()
      return
    }
    if (event.type !== 'dbChanged') return
    const keys = new Set<string>()
    for (const table of event.tables) {
      for (const key of TABLE_TO_QUERY_KEYS[table] ?? []) keys.add(key)
    }
    for (const key of keys) {
      void queryClient.invalidateQueries({ queryKey: [key] })
    }
  })
}
