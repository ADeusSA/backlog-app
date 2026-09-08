import { useCallback, useMemo } from 'react'
import { useRouterState } from '@tanstack/react-router'
import type { GroupByField, ViewMode, CardSize } from '@shared/constants'
import { scopeKey, type CollectionScope, type Filters, type Sort } from '@shared/schema/filters'
import type { ViewState } from '@shared/schema/filters'
import { DEFAULT_VIEW_STATE, decodeViewState, encodeViewState } from '@/lib/route-state'
import { useSettingsStore, useSettings } from '@/stores/settings-store'
import { router } from '@/app/router'

/**
 * Состояние вида коллекции живёт в search-параметре `f` маршрута (07 §7.1, CONTRACT.md).
 * Хук читает/пишет его через нижний уровень `router.history`, чтобы работать одинаково
 * на любом маршруте (`/library`, `/lists/:id`, `/series/:id`, `/companies/:id`, …) без
 * привязки к типу конкретного route — остальные search-параметры (`status`, `tab`, `dlc`,
 * `q`) не трогаются.
 */

function readRawSearch(): URLSearchParams {
  const loc = router.history.location
  return new URLSearchParams(loc.search ?? '')
}

function writeF(next: string | undefined, push: boolean): void {
  const loc = router.history.location
  const params = readRawSearch()
  if (next) params.set('f', next)
  else params.delete('f')
  const qs = params.toString()
  const href = loc.pathname + (qs ? `?${qs}` : '') + (loc.hash ?? '')
  if (push) router.history.push(href)
  else router.history.replace(href)
}

export interface UseCollectionViewStateOptions {
  defaultSort?: Sort
  defaultGroupBy?: GroupByField
}

export interface CollectionViewStateApi {
  state: ViewState
  scopeKey: string
  setView: (view: ViewMode) => void
  setSize: (size: CardSize) => void
  setGroupBy: (groupBy: GroupByField) => void
  setSort: (sort: Sort) => void
  setFilters: (filters: Filters, opts?: { push?: boolean }) => void
  resetFilters: () => void
  filterPanelOpen: boolean
  setFilterPanelOpen: (open: boolean) => void
}

export function useCollectionViewState(
  scope: CollectionScope,
  options: UseCollectionViewStateOptions = {}
): CollectionViewStateApi {
  const key = scopeKey(scope)
  const settings = useSettings()
  const patch = useSettingsStore((s) => s.patch)

  // Читаем `f` из «сырой» строки запроса (router.history), а не из типизированного
  // `location.search` — не все маршруты объявляют `f` в своей zod-схеме validateSearch
  // (например `/search`, `/catalog/:entity`), и там неизвестные ключи были бы отброшены.
  // `useRouterState` здесь — только триггер реактивности на любую смену URL.
  const href = useRouterState({ select: (s) => s.location.href })
  const rawF = useMemo(
    () => readRawSearch().get('f') ?? undefined,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [href]
  )

  const fallback = useMemo<ViewState>(
    () => ({
      ...DEFAULT_VIEW_STATE,
      view: settings.viewByScope[key] ?? 'grid',
      size: settings.defaultCardSize,
      groupBy: options.defaultGroupBy ?? 'none',
      sort: options.defaultSort ?? DEFAULT_VIEW_STATE.sort
    }),
     
    [key, settings.viewByScope, settings.defaultCardSize, options.defaultGroupBy, options.defaultSort]
  )

  const state = useMemo(() => decodeViewState(rawF, fallback), [rawF, fallback])

  const write = useCallback(
    (next: ViewState, push = true) => {
      writeF(encodeViewState(next), push)
    },
    []
  )

  const setView = useCallback(
    (view: ViewMode) => {
      write({ ...state, view })
      void patch({ viewByScope: { ...settings.viewByScope, [key]: view } })
    },
    [state, write, patch, settings.viewByScope, key]
  )

  const setSize = useCallback(
    (size: CardSize) => {
      write({ ...state, size })
      // Плотность карточек запоминается глобально (04 §2.6, 07 §2), не на scope.
      void patch({ defaultCardSize: size })
    },
    [state, write, patch]
  )

  const setGroupBy = useCallback((groupBy: GroupByField) => write({ ...state, groupBy }), [state, write])
  const setSort = useCallback((sort: Sort) => write({ ...state, sort }), [state, write])
  const setFilters = useCallback(
    (filters: Filters, opts?: { push?: boolean }) => write({ ...state, filters }, opts?.push ?? true),
    [state, write]
  )
  const resetFilters = useCallback(() => write({ ...state, filters: {} }), [state, write])

  const filterPanelOpen = settings.filterPanelByScope[key] ?? true
  const setFilterPanelOpen = useCallback(
    (open: boolean) => void patch({ filterPanelByScope: { ...settings.filterPanelByScope, [key]: open } }),
    [patch, settings.filterPanelByScope, key]
  )

  return {
    state,
    scopeKey: key,
    setView,
    setSize,
    setGroupBy,
    setSort,
    setFilters,
    resetFilters,
    filterPanelOpen,
    setFilterPanelOpen
  }
}
