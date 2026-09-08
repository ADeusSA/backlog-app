import { useEffect, useState } from 'react'
import { keepPreviousData, useQuery, type UseQueryResult } from '@tanstack/react-query'
import type { CollectionResult, Facets } from '@shared/schema/entities'
import type { CollectionScope, Filters, Sort } from '@shared/schema/filters'
import type { GroupByField } from '@shared/constants'
import { call } from '@/platform/api'

/** Дебаунс значения на `delay` мс (07 §7, §8 — 150 мс для фильтров/фасетов). */
export function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}

/**
 * Основной запрос коллекции. Дебаунс фильтров (150 мс, 07 §8) + `keepPreviousData`,
 * чтобы фильтрация не мигала пустым состоянием между запросами.
 */
export function useCollectionQuery(
  scope: CollectionScope,
  filters: Filters,
  sort: Sort,
  groupBy: GroupByField
): UseQueryResult<CollectionResult> {
  const debouncedFilters = useDebouncedValue(filters, 150)
  return useQuery({
    queryKey: ['collection', scope, debouncedFilters, sort, groupBy],
    queryFn: () =>
      call('collection.query', {
        scope,
        filters: debouncedFilters,
        sort,
        groupBy: groupBy === 'none' ? undefined : groupBy
      }),
    placeholderData: keepPreviousData
  })
}

/** Кольцо прогресса считается по всему scope, без учёта фильтров (07 §6). */
export function useCollectionProgress(scope: CollectionScope, enabled: boolean) {
  return useQuery({
    queryKey: ['collection', 'progress', scope],
    queryFn: () => call('collection.progress', { scope }),
    enabled
  })
}

/** Фасетные счётчики панели фильтров — дебаунс 150 мс (07 §7). */
export function useCollectionFacets(
  scope: CollectionScope,
  filters: Filters,
  enabled: boolean
): UseQueryResult<Facets> {
  const debouncedFilters = useDebouncedValue(filters, 150)
  return useQuery({
    queryKey: ['collection', 'facets', scope, debouncedFilters],
    queryFn: () => call('collection.facets', { scope, filters: debouncedFilters }),
    enabled
  })
}
