export * from './statuses'

/** Категории игры (02 §3.7). */
export const GAME_CATEGORIES = [
  'main',
  'dlc',
  'expansion',
  'standalone_expansion',
  'remake',
  'remaster',
  'port',
  'bundle',
  'mod',
  'episode',
  'season'
] as const
export type GameCategory = (typeof GAME_CATEGORIES)[number]

/** Категории, требующие указания родительской игры (06 §7.3). */
export const CATEGORIES_WITH_PARENT: GameCategory[] = [
  'dlc',
  'expansion',
  'standalone_expansion',
  'remake',
  'remaster',
  'port',
  'episode',
  'season'
]

/** Категории, которые считаются «основными» при расчёте кольца серии (07 §6). */
export const MAIN_LINE_CATEGORIES: GameCategory[] = [
  'main',
  'remake',
  'remaster',
  'standalone_expansion'
]

export const RELEASE_STATUSES = ['released', 'early_access', 'announced', 'tba', 'cancelled'] as const
export type ReleaseStatus = (typeof RELEASE_STATUSES)[number]

export const RELEASE_DATE_PRECISIONS = ['day', 'month', 'quarter', 'year', 'tba'] as const
export type ReleaseDatePrecision = (typeof RELEASE_DATE_PRECISIONS)[number]

/** Владение (02 §3.8). «Пиратка» — значение владения, а не платформа. */
export const OWNERSHIPS = [
  'unknown',
  'none',
  'digital',
  'physical',
  'subscription',
  'pirated',
  'sold'
] as const
export type Ownership = (typeof OWNERSHIPS)[number]

export const STORES = [
  'steam',
  'epic',
  'gog',
  'psn',
  'xbox',
  'nintendo',
  'battle_net',
  'ubisoft',
  'ea',
  'itch',
  'other'
] as const
export type Store = (typeof STORES)[number]

export const COMPANY_ROLES = [
  'developer',
  'publisher',
  'co_developer',
  'porting',
  'supporting'
] as const
export type CompanyRole = (typeof COMPANY_ROLES)[number]

export const PLATFORM_FAMILIES = [
  'pc',
  'playstation',
  'xbox',
  'nintendo',
  'mobile',
  'vr',
  'retro',
  'other'
] as const
export type PlatformFamily = (typeof PLATFORM_FAMILIES)[number]

export const IMAGE_KINDS = [
  'cover',
  'backdrop',
  'logo',
  'avatar',
  'banner',
  'screenshot',
  'list_cover',
  'series_cover'
] as const
export type ImageKind = (typeof IMAGE_KINDS)[number]

/** Максимальные размеры изображений по назначению (01 §7, 02 §7). */
export const IMAGE_MAX_SIZE: Record<ImageKind, { width: number; height: number }> = {
  cover: { width: 600, height: 800 },
  series_cover: { width: 600, height: 800 },
  list_cover: { width: 600, height: 800 },
  backdrop: { width: 1920, height: 1080 },
  banner: { width: 1920, height: 600 },
  logo: { width: 512, height: 512 },
  avatar: { width: 512, height: 512 },
  screenshot: { width: 1920, height: 1080 }
}

export const SERIES_KINDS = ['series', 'franchise'] as const
export type SeriesKind = (typeof SERIES_KINDS)[number]

export const LIST_SORT_MODES = ['manual', 'title', 'release_date', 'added_at', 'rating'] as const
export type ListSortMode = (typeof LIST_SORT_MODES)[number]

export const PLAYTIME_MODES = ['manual', 'sessions'] as const
export type PlaytimeMode = (typeof PLAYTIME_MODES)[number]

/** Приоритет игры в бэклоге. */
export const PRIORITIES = [0, 1, 2, 3] as const
export type Priority = (typeof PRIORITIES)[number]

export const ACTIVITY_TYPES = [
  'game_added',
  'status_changed',
  'rating_set',
  'playtime_set',
  'session_logged',
  'list_created',
  'list_item_added',
  'list_item_removed',
  'review_written',
  'mastered_set',
  'catalog_created',
  'catalog_edited',
  'achievement_unlocked'
] as const
export type ActivityType = (typeof ACTIVITY_TYPES)[number]

export const COLLECTION_SCOPES = ['library', 'list', 'series', 'company', 'search', 'catalog'] as const
export type CollectionScopeKind = (typeof COLLECTION_SCOPES)[number]

export const PRESET_SCOPES = ['library', 'list', 'series', 'company', 'all'] as const
export type PresetScope = (typeof PRESET_SCOPES)[number]

export const SORT_FIELDS = [
  'title',
  'release_date',
  'added_at',
  'started_at',
  'finished_at',
  'last_activity_at',
  'rating',
  'metacritic_score',
  'playtime_minutes',
  'hltb_main_min',
  'priority',
  'times_completed',
  'position',
  'random'
] as const
export type SortField = (typeof SORT_FIELDS)[number]

/** Направление по умолчанию: даты и числа — DESC, название — ASC (07 §5). */
export const DEFAULT_SORT_DIR: Record<SortField, 'asc' | 'desc'> = {
  title: 'asc',
  release_date: 'desc',
  added_at: 'desc',
  started_at: 'desc',
  finished_at: 'desc',
  last_activity_at: 'desc',
  rating: 'desc',
  metacritic_score: 'desc',
  playtime_minutes: 'desc',
  hltb_main_min: 'asc',
  priority: 'desc',
  times_completed: 'desc',
  position: 'asc',
  random: 'asc'
}

export const GROUP_BY_FIELDS = [
  'none',
  'status',
  'year',
  'genre',
  'platform',
  'series',
  'developer',
  'priority',
  'finished_year'
] as const
export type GroupByField = (typeof GROUP_BY_FIELDS)[number]

export const HLTB_BUCKETS = ['lt5', '5to15', '15to40', 'gt40', 'unknown'] as const
export type HltbBucket = (typeof HLTB_BUCKETS)[number]

export const VIEW_MODES = ['grid', 'list'] as const
export type ViewMode = (typeof VIEW_MODES)[number]

export const CARD_SIZES = ['s', 'm', 'l'] as const
export type CardSize = (typeof CARD_SIZES)[number]

/** Ширина колонки сетки для размеров карточек (07 §3). */
export const CARD_SIZE_WIDTH: Record<CardSize, number> = { s: 120, m: 160, l: 210 }

export const ANIMATION_MODES = ['full', 'reduced', 'off'] as const
export type AnimationMode = (typeof ANIMATION_MODES)[number]

export const LOCALES = ['ru', 'en'] as const
export type Locale = (typeof LOCALES)[number]

/** Словесные подписи оценки 1–10 (06 §6.2). */
export const RATING_LABEL_KEYS: Record<number, string> = {
  1: 'rating.awful',
  2: 'rating.awful',
  3: 'rating.bad',
  4: 'rating.bad',
  5: 'rating.meh',
  6: 'rating.ok',
  7: 'rating.good',
  8: 'rating.veryGood',
  9: 'rating.great',
  10: 'rating.masterpiece'
}

/**
 * Источники, из которых форма игры умеет заполнять поля (08 §2).
 * Steam работает без ключей; RAWG — ключ по регистрации на почту; IGDB — ключи
 * приложения Twitch (там обязательна двухфакторная аутентификация по телефону).
 */
export const IMPORT_PROVIDERS = ['steam', 'rawg', 'igdb'] as const
export type ImportProvider = (typeof IMPORT_PROVIDERS)[number]

export const EXTERNAL_PROVIDERS = [
  'igdb',
  'steam',
  'steamgriddb',
  'hltb',
  'metacritic',
  'opencritic',
  'rawg',
  'wikidata',
  'pcgamingwiki',
  'twitch'
] as const
export type ExternalProvider = (typeof EXTERNAL_PROVIDERS)[number]

/** Текущая версия схемы БД (02 §6). */
export const SCHEMA_VERSION = 2
