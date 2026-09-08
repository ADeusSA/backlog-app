import type { GameCardDto } from '@shared/schema/entities'
import type { GroupByField } from '@shared/constants'
import { yearFromDate } from '@shared/text'

export interface ItemGroup {
  /** Ключ группы — используется для сортировки заголовков и persist «свёрнуто/развёрнуто». */
  key: string
  /** Заголовок уже готов к показу (i18n разрешён снаружи через `groupLabel`). */
  label: string
  items: GameCardDto[]
}

const PRIORITY_ORDER = ['3', '2', '1', '0']

/**
 * Группировка карточек коллекции (07 §4, §9): без / по статусу / по году / по жанру /
 * по платформе / по серии / по разработчику / по приоритету (бэклог) / по году завершения (пройдено).
 * Возвращает группы в стабильном порядке; подписи разрешаются вызывающей стороной через `labelFor`.
 */
export function groupItems(
  items: GameCardDto[],
  groupBy: GroupByField,
  labelFor: (groupBy: GroupByField, key: string) => string
): ItemGroup[] {
  if (groupBy === 'none') return [{ key: 'all', label: '', items }]

  const buckets = new Map<string, GameCardDto[]>()
  const keyOf = (item: GameCardDto): string => {
    switch (groupBy) {
      case 'status':
        return item.status ?? 'none'
      case 'year':
        return item.releaseYear != null ? String(item.releaseYear) : 'unknown'
      case 'genre':
        return item.primaryGenre ?? 'unknown'
      case 'platform':
        return item.myPlatform ?? item.platforms ?? 'unknown'
      case 'series':
        return item.seriesName ?? 'none'
      case 'developer':
        return item.developer ?? 'unknown'
      case 'priority':
        return String(item.priority ?? 0)
      case 'finished_year':
        return item.finishedAt ? (yearFromDate(item.finishedAt)?.toString() ?? 'unknown') : 'unknown'
      default:
        return 'all'
    }
  }

  for (const item of items) {
    const key = keyOf(item)
    const bucket = buckets.get(key)
    if (bucket) bucket.push(item)
    else buckets.set(key, [item])
  }

  const keys = [...buckets.keys()]
  if (groupBy === 'priority') {
    keys.sort((a, b) => PRIORITY_ORDER.indexOf(a) - PRIORITY_ORDER.indexOf(b))
  } else if (groupBy === 'year' || groupBy === 'finished_year') {
    keys.sort((a, b) => {
      if (a === 'unknown') return 1
      if (b === 'unknown') return -1
      return Number(b) - Number(a)
    })
  } else {
    keys.sort((a, b) => {
      if (a === 'unknown' || a === 'none') return 1
      if (b === 'unknown' || b === 'none') return -1
      return a.localeCompare(b)
    })
  }

  return keys.map((key) => ({
    key,
    label: labelFor(groupBy, key),
    items: buckets.get(key) ?? []
  }))
}
