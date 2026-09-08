import { z } from 'zod'
import {
  CARD_SIZES,
  GAME_CATEGORIES,
  GAME_STATUSES,
  GROUP_BY_FIELDS,
  HLTB_BUCKETS,
  OWNERSHIPS,
  RELEASE_STATUSES,
  SORT_FIELDS,
  VIEW_MODES
} from '../constants'
import { dateSchema, idSchema } from './common'

const rangeNum = (min: number, max: number) =>
  z.object({
    min: z.number().min(min).max(max).nullish(),
    max: z.number().min(min).max(max).nullish(),
    includeNull: z.boolean().optional()
  })

const dateRange = z
  .object({ from: dateSchema.nullish(), to: dateSchema.nullish() })
  .nullish()

/** Состояние панели фильтров (07 §7.1). Отсутствующий ключ = фильтр не активен. */
export const filtersSchema = z
  .object({
    q: z.string().max(200).optional(),
    status: z.array(z.enum(GAME_STATUSES)).optional(),
    flags: z
      .object({
        favorite: z.boolean().nullish(),
        mastered: z.boolean().nullish(),
        hasReview: z.boolean().nullish(),
        unrated: z.boolean().nullish(),
        prioritized: z.boolean().nullish()
      })
      .optional(),
    year: rangeNum(1950, 2100).optional(),
    genres: z.object({ ids: z.array(idSchema), mode: z.enum(['any', 'all']) }).optional(),
    platforms: z.array(idSchema).optional(),
    myPlatforms: z.array(idSchema).optional(),
    modes: z.array(idSchema).optional(),
    developers: z.array(idSchema).optional(),
    publishers: z.array(idSchema).optional(),
    series: z.object({ ids: z.array(idSchema), none: z.boolean().optional() }).optional(),
    countries: z.array(z.string().length(2)).optional(),
    metacritic: rangeNum(0, 100).optional(),
    rating: rangeNum(1, 10).optional(),
    playtime: z
      .object({ minMin: z.number().min(0).nullish(), maxMin: z.number().min(0).nullish() })
      .optional(),
    hltb: z.array(z.enum(HLTB_BUCKETS)).optional(),
    category: z.array(z.enum(GAME_CATEGORIES)).optional(),
    releaseStatus: z.array(z.enum(RELEASE_STATUSES)).optional(),
    ownership: z.array(z.enum(OWNERSHIPS)).optional(),
    tags: z.array(idSchema).optional(),
    lists: z.object({ in: z.array(idSchema).optional(), notIn: z.array(idSchema).optional() }).optional(),
    dates: z
      .object({ added: dateRange, started: dateRange, finished: dateRange })
      .optional()
  })
  .strict()

export type Filters = z.infer<typeof filtersSchema>

export const sortSchema = z.object({
  field: z.enum(SORT_FIELDS),
  dir: z.enum(['asc', 'desc']),
  seed: z.number().int().optional()
})
export type Sort = z.infer<typeof sortSchema>

/** Контекст коллекции: где мы её показываем (07 §9). */
export const scopeSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('library'), status: z.enum(GAME_STATUSES).nullish() }),
  z.object({ kind: z.literal('list'), listId: idSchema }),
  z.object({ kind: z.literal('series'), seriesId: idSchema, includeDlc: z.boolean().optional() }),
  z.object({
    kind: z.literal('company'),
    companyId: idSchema,
    roles: z.array(z.enum(['developer', 'publisher', 'porting', 'supporting', 'co_developer'])).optional()
  }),
  z.object({ kind: z.literal('search'), query: z.string() }),
  z.object({ kind: z.literal('catalog') })
])
export type CollectionScope = z.infer<typeof scopeSchema>

/** Полный запрос коллекции. */
export const collectionQuerySchema = z.object({
  scope: scopeSchema,
  filters: filtersSchema.default({}),
  sort: sortSchema,
  groupBy: z.enum(GROUP_BY_FIELDS).optional()
})
export type CollectionQuery = z.infer<typeof collectionQuerySchema>

/** Состояние вида коллекции, живущее в search-параметрах маршрута (07 §7.1). */
export const viewStateSchema = z.object({
  view: z.enum(VIEW_MODES).default('grid'),
  size: z.enum(CARD_SIZES).default('m'),
  groupBy: z.enum(GROUP_BY_FIELDS).default('none'),
  filters: filtersSchema.default({}),
  sort: sortSchema
})
export type ViewState = z.infer<typeof viewStateSchema>

export const scopeKeySchema = z.string().max(80)

/** Ключ scope для запоминания вида/панели фильтров (07 §1). */
export function scopeKey(scope: CollectionScope): string {
  switch (scope.kind) {
    case 'library':
      return `library:${scope.status ?? 'all'}`
    case 'list':
      return `list:${scope.listId}`
    case 'series':
      return `series:${scope.seriesId}`
    case 'company':
      return `company:${scope.companyId}`
    case 'search':
      return 'search'
    case 'catalog':
      return 'catalog'
  }
}

/** Число активных секций фильтра (для бейджа на кнопке панели). */
export function countActiveFilters(filters: Filters): number {
  let n = 0
  const f = filters
  if (f.q) n += 1
  if (f.status?.length) n += 1
  if (f.flags && Object.values(f.flags).some((v) => v === true || v === false)) n += 1
  if (f.year && (f.year.min != null || f.year.max != null)) n += 1
  if (f.genres?.ids.length) n += 1
  if (f.platforms?.length) n += 1
  if (f.myPlatforms?.length) n += 1
  if (f.modes?.length) n += 1
  if (f.developers?.length) n += 1
  if (f.publishers?.length) n += 1
  if (f.series?.ids.length || f.series?.none) n += 1
  if (f.countries?.length) n += 1
  if (f.metacritic && (f.metacritic.min != null || f.metacritic.max != null)) n += 1
  if (f.rating && (f.rating.min != null || f.rating.max != null)) n += 1
  if (f.playtime && (f.playtime.minMin != null || f.playtime.maxMin != null)) n += 1
  if (f.hltb?.length) n += 1
  if (f.category?.length) n += 1
  if (f.releaseStatus?.length) n += 1
  if (f.ownership?.length) n += 1
  if (f.tags?.length) n += 1
  if (f.lists?.in?.length || f.lists?.notIn?.length) n += 1
  if (f.dates && (f.dates.added || f.dates.started || f.dates.finished)) n += 1
  return n
}
