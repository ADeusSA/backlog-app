import { viewStateSchema, type ViewState } from '@shared/schema/filters'
import { DEFAULT_SORT_DIR } from '@shared/constants'

/**
 * Состояние коллекции живёт в search-параметре маршрута (07 §7.1),
 * сжатое в base64url — чтобы «назад/вперёд» восстанавливали фильтры, вид и сортировку.
 */

export const DEFAULT_VIEW_STATE: ViewState = {
  view: 'grid',
  size: 'm',
  groupBy: 'none',
  filters: {},
  sort: { field: 'added_at', dir: DEFAULT_SORT_DIR.added_at }
}

function toBase64Url(input: string): string {
  const bytes = new TextEncoder().encode(input)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(input: string): string {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4))
  const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

export function encodeViewState(state: ViewState): string | undefined {
  // Не пишем в URL то, что совпадает с состоянием по умолчанию — ссылки остаются короткими.
  const compact: Record<string, unknown> = {}
  if (state.view !== DEFAULT_VIEW_STATE.view) compact['v'] = state.view
  if (state.size !== DEFAULT_VIEW_STATE.size) compact['z'] = state.size
  if (state.groupBy !== DEFAULT_VIEW_STATE.groupBy) compact['g'] = state.groupBy
  if (Object.keys(state.filters).length > 0) compact['f'] = state.filters
  if (
    state.sort.field !== DEFAULT_VIEW_STATE.sort.field ||
    state.sort.dir !== DEFAULT_VIEW_STATE.sort.dir ||
    state.sort.seed != null
  ) {
    compact['s'] = state.sort
  }
  if (Object.keys(compact).length === 0) return undefined
  return toBase64Url(JSON.stringify(compact))
}

export function decodeViewState(raw: string | undefined, fallback = DEFAULT_VIEW_STATE): ViewState {
  if (!raw) return fallback
  try {
    const compact = JSON.parse(fromBase64Url(raw)) as Record<string, unknown>
    const parsed = viewStateSchema.safeParse({
      view: compact['v'] ?? fallback.view,
      size: compact['z'] ?? fallback.size,
      groupBy: compact['g'] ?? fallback.groupBy,
      filters: compact['f'] ?? {},
      sort: compact['s'] ?? fallback.sort
    })
    return parsed.success ? parsed.data : fallback
  } catch {
    return fallback
  }
}
