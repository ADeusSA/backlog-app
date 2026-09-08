import type { ReactNode } from 'react'
import type { GameCardDto } from '@shared/schema/entities'
import type { CollectionScope, Sort } from '@shared/schema/filters'
import type { GroupByField } from '@shared/constants'

/**
 * Ключи секций панели фильтров в порядке отображения (07 §7). Совпадают с ключами
 * объекта `Filters` — `hiddenFilterSections` скрывает секцию целиком для данного scope.
 */
export const FILTER_SECTION_KEYS = [
  'q',
  'status',
  'flags',
  'year',
  'genres',
  'platforms',
  'myPlatforms',
  'modes',
  'developers',
  'publishers',
  'series',
  'countries',
  'metacritic',
  'rating',
  'playtime',
  'hltb',
  'category',
  'releaseStatus',
  'ownership',
  'tags',
  'lists',
  'dates'
] as const

export type FilterSectionKey = (typeof FILTER_SECTION_KEYS)[number]

/** Контекст перехода на страницу игры — нужен крошкам (05 §4.2). */
export interface BreadcrumbContext {
  from: string
  fromId?: string
  fromTitle?: string
}

/**
 * Контракт `GameCollectionView` (см. `CONTRACT.md`). Ломать нельзя, расширять — можно:
 * ниже добавлены необязательные пропсы `showPositionNumbers` и `tableDensity` сверх
 * нормативного списка — оба со значением по умолчанию, старые вызывающие места не ломаются.
 */
export interface GameCollectionViewProps {
  scope: CollectionScope
  title: string
  subtitle?: string
  titleSlot?: ReactNode
  headerSlot?: ReactNode
  actionsSlot?: ReactNode
  /** Показывать кольцо прогресса (07 §6). По умолчанию — true для library/list/series/company. */
  progress?: boolean
  /** Показывать панель фильтров. По умолчанию — true, false для поиска (07 §9). */
  filters?: boolean
  /** Кнопка «Что поиграть?» (07 §2). По умолчанию — true для library и list. */
  random?: boolean
  defaultSort?: Sort
  defaultGroupBy?: GroupByField
  hiddenFilterSections?: FilterSectionKey[]
  /** Ручной порядок с drag-n-drop (список/серия, 07 §9). */
  reorderable?: boolean
  onReorder?: (orderedGameIds: string[]) => void
  /** Добавка к карточке/строке: номер позиции, заметка, вложенные DLC и т. п. */
  renderItemExtra?: (game: GameCardDto) => ReactNode
  breadcrumbContext?: BreadcrumbContext
  emptySlot?: ReactNode
  /**
   * Расширение сверх CONTRACT.md: крупный номер позиции в углу обложки (07 §3).
   * По умолчанию включён для scope `list`/`series`, когда у карточек есть `position`.
   */
  showPositionNumbers?: boolean
}
