import { z } from 'zod'
import {
  ACTIVITY_TYPES,
  COMPANY_ROLES,
  GAME_CATEGORIES,
  GAME_STATUSES,
  IMAGE_KINDS,
  LIST_SORT_MODES,
  OWNERSHIPS,
  PLATFORM_FAMILIES,
  PLAYTIME_MODES,
  RELEASE_DATE_PRECISIONS,
  RELEASE_STATUSES,
  SERIES_KINDS
} from '../constants'
import { dateSchema, hexColorSchema, idSchema, partialDateSchema, timestampSchema } from './common'
import { createEntitiesSchema, importProvenanceSchema } from './providers'

/* ------------------------------------------------------------------ images */

export const imageDtoSchema = z.object({
  id: idSchema,
  kind: z.enum(IMAGE_KINDS),
  fileName: z.string(),
  mime: z.string(),
  width: z.number().int(),
  height: z.number().int(),
  sizeBytes: z.number().int(),
  dominantColor: hexColorSchema.nullable(),
  createdAt: timestampSchema
})
export type ImageDto = z.infer<typeof imageDtoSchema>

/* ------------------------------------------------------------ справочники */

export const platformDtoSchema = z.object({
  id: idSchema,
  name: z.string(),
  shortName: z.string(),
  family: z.enum(PLATFORM_FAMILIES),
  sortOrder: z.number().int(),
  isCustom: z.boolean(),
  gameCount: z.number().int().optional()
})
export type PlatformDto = z.infer<typeof platformDtoSchema>

export const genreDtoSchema = z.object({
  id: idSchema,
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  color: hexColorSchema.nullable(),
  isCustom: z.boolean(),
  gameCount: z.number().int().optional()
})
export type GenreDto = z.infer<typeof genreDtoSchema>

export const modeDtoSchema = z.object({
  id: idSchema,
  name: z.string(),
  slug: z.string(),
  sortOrder: z.number().int(),
  gameCount: z.number().int().optional()
})
export type ModeDto = z.infer<typeof modeDtoSchema>

export const tagDtoSchema = z.object({
  id: idSchema,
  name: z.string(),
  color: hexColorSchema.nullable(),
  gameCount: z.number().int().optional()
})
export type TagDto = z.infer<typeof tagDtoSchema>

/* -------------------------------------------------------------- компании */

export const companyRefSchema = z.object({
  id: idSchema,
  name: z.string(),
  role: z.enum(COMPANY_ROLES).optional(),
  countryCode: z.string().length(2).nullable().optional(),
  logoFile: z.string().nullable().optional()
})
export type CompanyRef = z.infer<typeof companyRefSchema>

export const companyDtoSchema = z.object({
  id: idSchema,
  name: z.string(),
  slug: z.string(),
  sortName: z.string(),
  isDeveloper: z.boolean(),
  isPublisher: z.boolean(),
  countryCode: z.string().length(2).nullable(),
  city: z.string().nullable(),
  foundedYear: z.number().int().nullable(),
  closedYear: z.number().int().nullable(),
  description: z.string().nullable(),
  website: z.string().nullable(),
  logoImageId: idSchema.nullable(),
  logoFile: z.string().nullable(),
  bannerImageId: idSchema.nullable(),
  bannerFile: z.string().nullable(),
  parentCompanyId: idSchema.nullable(),
  parentCompanyName: z.string().nullable(),
  dominantColor: hexColorSchema.nullable(),
  gameCount: z.number().int(),
  myGameCount: z.number().int(),
  completedCount: z.number().int(),
  seriesCount: z.number().int(),
  avgRating: z.number().nullable(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema
})
export type CompanyDto = z.infer<typeof companyDtoSchema>

export const companyInputSchema = z.object({
  id: idSchema.optional(),
  name: z.string().min(1).max(200),
  sortName: z.string().max(200).optional(),
  slug: z.string().max(200).optional(),
  isDeveloper: z.boolean(),
  isPublisher: z.boolean(),
  countryCode: z.string().length(2).nullish(),
  city: z.string().max(120).nullish(),
  foundedYear: z.number().int().min(1900).max(2200).nullish(),
  closedYear: z.number().int().min(1900).max(2200).nullish(),
  description: z.string().max(5000).nullish(),
  website: z.string().max(500).nullish(),
  logoImageId: idSchema.nullish(),
  bannerImageId: idSchema.nullish(),
  parentCompanyId: idSchema.nullish()
})
export type CompanyInput = z.infer<typeof companyInputSchema>

/* ----------------------------------------------------------------- серии */

export const seriesDtoSchema = z.object({
  id: idSchema,
  name: z.string(),
  slug: z.string(),
  sortName: z.string(),
  kind: z.enum(SERIES_KINDS),
  description: z.string().nullable(),
  coverImageId: idSchema.nullable(),
  coverFile: z.string().nullable(),
  bannerImageId: idSchema.nullable(),
  bannerFile: z.string().nullable(),
  dominantColor: hexColorSchema.nullable(),
  parentSeriesId: idSchema.nullable(),
  parentSeriesName: z.string().nullable(),
  gameCount: z.number().int(),
  completedCount: z.number().int(),
  mainLineCount: z.number().int(),
  yearFrom: z.number().int().nullable(),
  yearTo: z.number().int().nullable(),
  playtimeMinutes: z.number().int(),
  coverMosaic: z.array(z.string()).optional(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema
})
export type SeriesDto = z.infer<typeof seriesDtoSchema>

export const seriesInputSchema = z.object({
  id: idSchema.optional(),
  name: z.string().min(1).max(200),
  kind: z.enum(SERIES_KINDS).default('series'),
  sortName: z.string().max(200).optional(),
  slug: z.string().max(200).optional(),
  description: z.string().max(5000).nullish(),
  coverImageId: idSchema.nullish(),
  bannerImageId: idSchema.nullish(),
  parentSeriesId: idSchema.nullish()
})
export type SeriesInput = z.infer<typeof seriesInputSchema>

/* ------------------------------------------------------------------ игры */

/** Плоская строка карточки/строки таблицы (02 §5). */
export const gameCardDtoSchema = z.object({
  id: idSchema,
  title: z.string(),
  sortTitle: z.string(),
  releaseYear: z.number().int().nullable(),
  releaseDate: partialDateSchema.nullable(),
  category: z.enum(GAME_CATEGORIES),
  parentGameId: idSchema.nullable(),
  metacriticScore: z.number().int().nullable(),
  hltbMainMin: z.number().int().nullable(),
  coverFile: z.string().nullable(),
  dominantColor: hexColorSchema.nullable(),
  status: z.enum(GAME_STATUSES).nullable(),
  rating: z.number().int().nullable(),
  playtimeMinutes: z.number().int().nullable(),
  isMastered: z.boolean(),
  isFavorite: z.boolean(),
  priority: z.number().int(),
  ownership: z.enum(OWNERSHIPS).nullable(),
  addedAt: timestampSchema.nullable(),
  startedAt: dateSchema.nullable(),
  finishedAt: dateSchema.nullable(),
  lastActivityAt: timestampSchema.nullable(),
  genres: z.string().nullable(),
  primaryGenre: z.string().nullable(),
  developer: z.string().nullable(),
  platforms: z.string().nullable(),
  myPlatform: z.string().nullable(),
  seriesName: z.string().nullable(),
  /** позиция в списке/серии — только в соответствующих scope */
  position: z.number().int().nullable(),
  /** заметка к позиции списка */
  positionNote: z.string().nullable(),
  /** метка позиции в серии */
  positionLabel: z.string().nullable(),
  /** заполненность каталожных полей 0..100 — только в scope каталога */
  completeness: z.number().int().nullable()
})
export type GameCardDto = z.infer<typeof gameCardDtoSchema>

export const progressSchema = z.object({ done: z.number().int(), total: z.number().int() })
export type Progress = z.infer<typeof progressSchema>

export const collectionResultSchema = z.object({
  items: z.array(gameCardDtoSchema),
  total: z.number().int(),
  progress: progressSchema,
  playtimeMinutes: z.number().int(),
  yearFrom: z.number().int().nullable(),
  yearTo: z.number().int().nullable()
})
export type CollectionResult = z.infer<typeof collectionResultSchema>

export const facetBucketSchema = z.object({ key: z.string(), count: z.number().int() })
export const facetsSchema = z.record(z.string(), z.array(facetBucketSchema))
export type Facets = z.infer<typeof facetsSchema>

export const userGameDtoSchema = z.object({
  gameId: idSchema,
  status: z.enum(GAME_STATUSES),
  isFavorite: z.boolean(),
  isMastered: z.boolean(),
  priority: z.number().int().min(0).max(3),
  rating: z.number().int().min(1).max(10).nullable(),
  playtimeMinutes: z.number().int(),
  playtimeMode: z.enum(PLAYTIME_MODES),
  timesCompleted: z.number().int(),
  platformId: idSchema.nullable(),
  ownership: z.enum(OWNERSHIPS),
  store: z.string().nullable(),
  subscriptionService: z.string().nullable(),
  startedAt: dateSchema.nullable(),
  finishedAt: dateSchema.nullable(),
  addedAt: timestampSchema,
  statusChangedAt: timestampSchema,
  lastActivityAt: timestampSchema,
  resumeNote: z.string().nullable(),
  notes: z.string().nullable(),
  review: z.string().nullable(),
  reviewHasSpoilers: z.boolean(),
  updatedAt: timestampSchema
})
export type UserGameDto = z.infer<typeof userGameDtoSchema>

/** Частичное обновление пользовательских полей (автосохранение, 06 §6.2). */
export const userGamePatchSchema = z
  .object({
    isFavorite: z.boolean().optional(),
    isMastered: z.boolean().optional(),
    priority: z.number().int().min(0).max(3).optional(),
    rating: z.number().int().min(1).max(10).nullable().optional(),
    playtimeMinutes: z.number().int().min(0).max(100000 * 60).optional(),
    /** Переключение на `sessions` пересчитывает часы по журналу (02 §3.8). */
    playtimeMode: z.enum(PLAYTIME_MODES).optional(),
    platformId: idSchema.nullable().optional(),
    ownership: z.enum(OWNERSHIPS).optional(),
    store: z.string().max(40).nullable().optional(),
    subscriptionService: z.string().max(80).nullable().optional(),
    startedAt: dateSchema.nullable().optional(),
    finishedAt: dateSchema.nullable().optional(),
    resumeNote: z.string().max(200).nullable().optional(),
    notes: z.string().max(20000).nullable().optional(),
    review: z.string().max(20000).nullable().optional(),
    reviewHasSpoilers: z.boolean().optional()
  })
  .strict()
export type UserGamePatch = z.infer<typeof userGamePatchSchema>

export const gameInputSchema = z.object({
  id: idSchema.optional(),
  title: z.string().min(1).max(300),
  sortTitle: z.string().max(300).optional(),
  slug: z.string().max(300).optional(),
  altTitles: z.array(z.string().max(300)).default([]),
  category: z.enum(GAME_CATEGORIES).default('main'),
  parentGameId: idSchema.nullish(),
  releaseDate: partialDateSchema.nullish(),
  releaseDatePrecision: z.enum(RELEASE_DATE_PRECISIONS).default('day'),
  releaseStatus: z.enum(RELEASE_STATUSES).default('released'),
  summary: z.string().max(4000).nullish(),
  storyline: z.string().max(8000).nullish(),
  coverImageId: idSchema.nullish(),
  backdropImageId: idSchema.nullish(),
  logoImageId: idSchema.nullish(),
  metacriticScore: z.number().int().min(0).max(100).nullish(),
  metacriticUrl: z.string().max(500).nullish(),
  opencriticScore: z.number().int().min(0).max(100).nullish(),
  hltbMainMin: z.number().int().min(0).nullish(),
  hltbExtraMin: z.number().int().min(0).nullish(),
  hltbCompleteMin: z.number().int().min(0).nullish(),
  ageRating: z.string().max(40).nullish(),
  website: z.string().max(500).nullish(),
  developerIds: z.array(idSchema).default([]),
  publisherIds: z.array(idSchema).default([]),
  supportingIds: z.array(idSchema).default([]),
  portingIds: z.array(idSchema).default([]),
  genreIds: z.array(idSchema).default([]),
  primaryGenreId: idSchema.nullish(),
  platformIds: z.array(idSchema).default([]),
  modeIds: z.array(idSchema).default([]),
  tagIds: z.array(idSchema).default([]),
  seriesId: idSchema.nullish(),
  seriesPosition: z.number().int().min(1).nullish(),
  /** только при создании: сразу добавить в библиотеку */
  addToLibrary: z.boolean().optional(),
  addStatus: z.enum(GAME_STATUSES).optional(),
  /**
   * Импорт (08 §3): сущности, которых ещё нет в каталоге, приходят именами и
   * создаются внутри той же транзакции сохранения — не раньше, чем пользователь
   * нажал «Сохранить». `provenance` пишет `external_ids` и источник каждого поля.
   */
  createEntities: createEntitiesSchema.optional(),
  /** По записи на источник: за одну правку можно взять данные и из Steam, и из IGDB. */
  provenance: z.array(importProvenanceSchema).optional()
})
export type GameInput = z.infer<typeof gameInputSchema>

/** Полная страница игры одним запросом (06 §6.4). */
export const gameDetailSchema = z.object({
  id: idSchema,
  title: z.string(),
  sortTitle: z.string(),
  slug: z.string(),
  altTitles: z.array(z.string()),
  category: z.enum(GAME_CATEGORIES),
  parent: z.object({ id: idSchema, title: z.string(), coverFile: z.string().nullable() }).nullable(),
  releaseDate: partialDateSchema.nullable(),
  releaseDatePrecision: z.enum(RELEASE_DATE_PRECISIONS),
  releaseYear: z.number().int().nullable(),
  releaseStatus: z.enum(RELEASE_STATUSES),
  summary: z.string().nullable(),
  storyline: z.string().nullable(),
  coverImageId: idSchema.nullable(),
  coverFile: z.string().nullable(),
  backdropImageId: idSchema.nullable(),
  backdropFile: z.string().nullable(),
  logoImageId: idSchema.nullable(),
  logoFile: z.string().nullable(),
  dominantColor: hexColorSchema.nullable(),
  metacriticScore: z.number().int().nullable(),
  metacriticUrl: z.string().nullable(),
  opencriticScore: z.number().int().nullable(),
  igdbRating: z.number().nullable(),
  hltbMainMin: z.number().int().nullable(),
  hltbExtraMin: z.number().int().nullable(),
  hltbCompleteMin: z.number().int().nullable(),
  ageRating: z.string().nullable(),
  website: z.string().nullable(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
  companies: z.array(companyRefSchema),
  genres: z.array(z.object({ id: idSchema, name: z.string(), isPrimary: z.boolean() })),
  platforms: z.array(z.object({ id: idSchema, name: z.string(), shortName: z.string() })),
  modes: z.array(z.object({ id: idSchema, name: z.string() })),
  tags: z.array(tagDtoSchema),
  userGame: userGameDtoSchema.nullable(),
  series: z
    .object({
      id: idSchema,
      name: z.string(),
      position: z.number().int(),
      total: z.number().int(),
      label: z.string().nullable(),
      games: z.array(gameCardDtoSchema)
    })
    .nullable(),
  dlc: z.array(gameCardDtoSchema),
  editions: z.array(gameCardDtoSchema),
  sameDeveloper: z.array(gameCardDtoSchema),
  lists: z.array(z.object({ id: idSchema, name: z.string(), color: hexColorSchema.nullable(), icon: z.string().nullable() })),
  activity: z.array(
    z.object({
      id: idSchema,
      happenedAt: timestampSchema,
      type: z.enum(ACTIVITY_TYPES),
      payload: z.record(z.string(), z.unknown())
    })
  ),
  /** Чем заполнялась карточка — показывается в подвале страницы игры (08 §6). */
  sources: z
    .array(z.object({ provider: z.string(), url: z.string().nullable(), syncedAt: z.string().nullable() }))
    .default([])
})
export type GameDetail = z.infer<typeof gameDetailSchema>

/* --------------------------------------------------------------- списки */

export const listDtoSchema = z.object({
  id: idSchema,
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  icon: z.string().nullable(),
  color: hexColorSchema.nullable(),
  coverImageId: idSchema.nullable(),
  coverFile: z.string().nullable(),
  isRanked: z.boolean(),
  sortMode: z.enum(LIST_SORT_MODES),
  sortOrder: z.number().int(),
  isPinned: z.boolean(),
  gameCount: z.number().int(),
  completedCount: z.number().int(),
  playtimeMinutes: z.number().int(),
  yearFrom: z.number().int().nullable(),
  yearTo: z.number().int().nullable(),
  coverMosaic: z.array(z.string()),
  createdAt: timestampSchema,
  updatedAt: timestampSchema
})
export type ListDto = z.infer<typeof listDtoSchema>

export const listInputSchema = z.object({
  id: idSchema.optional(),
  name: z.string().min(1).max(120),
  description: z.string().max(500).nullish(),
  icon: z.string().max(40).nullish(),
  color: hexColorSchema.nullish(),
  coverImageId: idSchema.nullish(),
  isRanked: z.boolean().default(false),
  sortMode: z.enum(LIST_SORT_MODES).default('manual'),
  isPinned: z.boolean().default(true)
})
export type ListInput = z.infer<typeof listInputSchema>

/* --------------------------------------------------------------- профиль */

export const profileDtoSchema = z.object({
  displayName: z.string(),
  bio: z.string().nullable(),
  avatarImageId: idSchema.nullable(),
  avatarFile: z.string().nullable(),
  bannerImageId: idSchema.nullable(),
  bannerFile: z.string().nullable(),
  favoriteGameIds: z.array(idSchema),
  favoriteGames: z.array(gameCardDtoSchema),
  yearGoal: z.number().int().nullable(),
  xp: z.number().int(),
  level: z.number().int(),
  levelTitleKey: z.string(),
  xpToNextLevel: z.number().int(),
  levelProgress: z.number(),
  memberSinceYear: z.number().int().nullable(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema
})
export type ProfileDto = z.infer<typeof profileDtoSchema>

export const profilePatchSchema = z
  .object({
    displayName: z.string().min(1).max(80).optional(),
    bio: z.string().max(500).nullable().optional(),
    avatarImageId: idSchema.nullable().optional(),
    bannerImageId: idSchema.nullable().optional(),
    favoriteGameIds: z.array(idSchema).max(4).optional(),
    yearGoal: z.number().int().min(0).max(1000).nullable().optional()
  })
  .strict()
export type ProfilePatch = z.infer<typeof profilePatchSchema>

/* ------------------------------------------------------------ статистика */

export const statsSchema = z.object({
  totals: z.object({
    /** Все записи `user_game` — столько же карточек показывает вид «Все» (05 §3). */
    all: z.number().int(),
    /** Без «Хочу» — это и есть «игр в библиотеке» на экране профиля (06 §1.5). */
    inLibrary: z.number().int(),
    completed: z.number().int(),
    mastered: z.number().int(),
    playtimeMinutes: z.number().int(),
    avgRating: z.number().nullable(),
    ratedCount: z.number().int(),
    reviewCount: z.number().int()
  }),
  byStatus: z.array(z.object({ status: z.enum(GAME_STATUSES), count: z.number().int() })),
  completedByYear: z.array(
    z.object({ year: z.string(), count: z.number().int(), playtimeMinutes: z.number().int() })
  ),
  ratingHistogram: z.array(z.object({ rating: z.number().int(), count: z.number().int() })),
  topGenres: z.array(
    z.object({
      id: idSchema,
      name: z.string(),
      count: z.number().int(),
      playtimeMinutes: z.number().int(),
      avgRating: z.number().nullable()
    })
  ),
  topPlatforms: z.array(
    z.object({
      id: idSchema,
      name: z.string(),
      shortName: z.string(),
      count: z.number().int(),
      playtimeMinutes: z.number().int()
    })
  ),
  topDevelopers: z.array(
    z.object({
      id: idSchema,
      name: z.string(),
      logoFile: z.string().nullable(),
      count: z.number().int(),
      avgRating: z.number().nullable()
    })
  ),
  topPlaytime: z.array(gameCardDtoSchema),
  byDecade: z.array(z.object({ decade: z.number().int(), count: z.number().int() })),
  ownership: z.array(z.object({ ownership: z.enum(OWNERSHIPS), count: z.number().int() })),
  completedThisYear: z.number().int(),
  addedThisYear: z.number().int()
})
export type Stats = z.infer<typeof statsSchema>

/* -------------------------------------------------------------- активность */

export const activityDtoSchema = z.object({
  id: idSchema,
  happenedAt: timestampSchema,
  type: z.enum(ACTIVITY_TYPES),
  gameId: idSchema.nullable(),
  gameTitle: z.string().nullable(),
  coverFile: z.string().nullable(),
  entityType: z.string().nullable(),
  entityId: z.string().nullable(),
  payload: z.record(z.string(), z.unknown())
})
export type ActivityDto = z.infer<typeof activityDtoSchema>

/* ------------------------------------------------------------- достижения */

export const achievementDtoSchema = z.object({
  key: z.string(),
  baseKey: z.string(),
  titleKey: z.string(),
  descriptionKey: z.string(),
  /** Подстановки для i18n: имя серии/жанра, порог уровня. */
  params: z.record(z.string(), z.union([z.string(), z.number()])).default({}),
  /** Готовые строки на русском — запасной вариант, если ключа нет в словаре. */
  title: z.string(),
  description: z.string(),
  icon: z.string(),
  level: z.number().int(),
  maxLevel: z.number().int(),
  progress: z.number().int(),
  threshold: z.number().int(),
  unlockedAt: timestampSchema.nullable(),
  xp: z.number().int(),
  comingSoon: z.boolean()
})
export type AchievementDto = z.infer<typeof achievementDtoSchema>

export const achievementsSummarySchema = z.object({
  xp: z.number().int(),
  level: z.number().int(),
  levelTitleKey: z.string(),
  xpToNextLevel: z.number().int(),
  levelProgress: z.number(),
  unlockedCount: z.number().int(),
  totalCount: z.number().int(),
  recent: z.array(achievementDtoSchema),
  closest: z.array(achievementDtoSchema),
  all: z.array(achievementDtoSchema)
})
export type AchievementsSummary = z.infer<typeof achievementsSummarySchema>

/* ---------------------------------------------------------------- поиск */

export const searchResultSchema = z.object({
  games: z.array(gameCardDtoSchema),
  series: z.array(z.object({ id: idSchema, name: z.string(), coverFile: z.string().nullable(), gameCount: z.number().int() })),
  companies: z.array(z.object({ id: idSchema, name: z.string(), logoFile: z.string().nullable(), gameCount: z.number().int() })),
  lists: z.array(z.object({ id: idSchema, name: z.string(), icon: z.string().nullable(), color: hexColorSchema.nullable(), gameCount: z.number().int() }))
})
export type SearchResult = z.infer<typeof searchResultSchema>

/* --------------------------------------------------------------- пресеты */

export const filterPresetDtoSchema = z.object({
  id: idSchema,
  scope: z.string(),
  name: z.string(),
  filtersJson: z.string(),
  sortJson: z.string(),
  view: z.string(),
  sortOrder: z.number().int()
})
export type FilterPresetDto = z.infer<typeof filterPresetDtoSchema>
