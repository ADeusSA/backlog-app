import { z } from 'zod'
import {
  achievementsSummarySchema,
  activityDtoSchema,
  collectionResultSchema,
  companyDtoSchema,
  companyInputSchema,
  facetsSchema,
  filterPresetDtoSchema,
  gameCardDtoSchema,
  gameDetailSchema,
  gameInputSchema,
  genreDtoSchema,
  imageDtoSchema,
  listDtoSchema,
  listInputSchema,
  modeDtoSchema,
  platformDtoSchema,
  profileDtoSchema,
  profilePatchSchema,
  progressSchema,
  searchResultSchema,
  seriesDtoSchema,
  seriesInputSchema,
  statsSchema,
  tagDtoSchema,
  userGameDtoSchema,
  userGamePatchSchema
} from './schema/entities'
import { collectionQuerySchema, filtersSchema, scopeSchema } from './schema/filters'
import {
  canonicalGameSchema,
  importProviderSchema,
  providerHitSchema,
  providerStatusSchema
} from './schema/providers'
import {
  appPathsSchema,
  backupDtoSchema,
  settingsPatchSchema,
  settingsSchema,
  syncStateSchema
} from './schema/settings'
import {
  activitySummarySchema,
  playSessionDtoSchema,
  playthroughDtoSchema,
  playthroughInputSchema,
  sessionInputSchema
} from './schema/sessions'
import { dateSchema, hexColorSchema, idSchema } from './schema/common'
import { GAME_STATUSES, IMAGE_KINDS, PLATFORM_FAMILIES } from './constants'

const nothing = z.void()
const ok = z.object({ ok: z.literal(true) })
const idOnly = z.object({ id: idSchema })

/**
 * Единый контракт IPC (01 §5). Ключ — имя канала, значение — zod-схемы входа и выхода.
 * main/ipc/register.ts реализует обработчики, preload генерирует по этому же объекту
 * `window.backlog.<channel>(input)`, renderer получает типы из `IpcApi`.
 */
export const channels = {
  /* ------------------------------------------------------------- app */
  'app.getPaths': { input: nothing, output: appPathsSchema },
  'app.getVersion': { input: nothing, output: z.object({ app: z.string(), electron: z.string(), chrome: z.string(), node: z.string(), sqlite: z.string(), fts5: z.boolean() }) },
  'app.openExternal': { input: z.object({ url: z.string().url() }), output: ok },
  'app.openPath': { input: z.object({ target: z.enum(['data', 'logs', 'backups', 'images']) }), output: ok },
  'app.log': { input: z.object({ level: z.enum(['debug', 'info', 'warn', 'error']), message: z.string(), data: z.unknown().optional() }), output: ok },
  'app.relaunch': { input: nothing, output: ok },

  /* -------------------------------------------------------- settings */
  'settings.get': { input: nothing, output: settingsSchema },
  'settings.patch': { input: settingsPatchSchema, output: settingsSchema },
  'settings.chooseDataDir': { input: nothing, output: z.object({ dir: z.string().nullable() }) },
  'settings.moveDataDir': { input: z.object({ dir: z.string() }), output: ok },

  /* ------------------------------------------------------ onboarding */
  'onboarding.getState': { input: nothing, output: z.object({ done: z.boolean(), hasDb: z.boolean(), dbDate: z.string().nullable(), isEmpty: z.boolean() }) },
  'onboarding.complete': { input: z.object({ displayName: z.string().min(1).max(80), avatarImageId: idSchema.nullish(), withDemoData: z.boolean() }), output: ok },
  'demo.seed': { input: nothing, output: z.object({ games: z.number().int() }) },

  /* ------------------------------------------------------ коллекция */
  'collection.query': { input: collectionQuerySchema, output: collectionResultSchema },
  'collection.facets': { input: z.object({ scope: scopeSchema, filters: filtersSchema }), output: facetsSchema },
  'collection.random': { input: z.object({ scope: scopeSchema, filters: filtersSchema, excludeIds: z.array(idSchema).optional() }), output: gameCardDtoSchema.nullable() },
  'collection.progress': { input: z.object({ scope: scopeSchema }), output: progressSchema },

  /* ---------------------------------------------------------- игры */
  'games.getDetail': { input: z.object({ id: idSchema }), output: gameDetailSchema.nullable() },
  'games.quickSearch': { input: z.object({ q: z.string(), limit: z.number().int().min(1).max(50).default(20), onlyLibrary: z.boolean().optional(), excludeIds: z.array(idSchema).optional() }), output: z.array(gameCardDtoSchema) },

  /* ------------------------------------------------- пользовательские */
  'userGame.get': { input: z.object({ gameId: idSchema }), output: userGameDtoSchema.nullable() },
  'userGame.setStatus': { input: z.object({ gameId: idSchema, status: z.enum(GAME_STATUSES) }), output: userGameDtoSchema },
  'userGame.patch': { input: z.object({ gameId: idSchema, patch: userGamePatchSchema }), output: userGameDtoSchema },
  'userGame.addToLibrary': { input: z.object({ gameIds: z.array(idSchema).min(1), status: z.enum(GAME_STATUSES).default('backlog') }), output: ok },
  'userGame.removeFromLibrary': { input: z.object({ gameIds: z.array(idSchema).min(1) }), output: ok },
  'userGame.addPlaytime': { input: z.object({ gameId: idSchema, minutes: z.number().int() }), output: userGameDtoSchema },
  'userGame.bulkStatus': { input: z.object({ gameIds: z.array(idSchema).min(1), status: z.enum(GAME_STATUSES) }), output: ok },
  'userGame.setTags': { input: z.object({ gameId: idSchema, tagIds: z.array(idSchema) }), output: z.array(tagDtoSchema) },
  'userGame.bulkTags': { input: z.object({ gameIds: z.array(idSchema).min(1), addTagIds: z.array(idSchema).default([]), removeTagIds: z.array(idSchema).default([]) }), output: ok },

  /* ------------------------------------------------------- списки */
  'lists.list': { input: z.object({ pinnedOnly: z.boolean().optional() }).optional(), output: z.array(listDtoSchema) },
  'lists.get': { input: z.object({ id: idSchema }), output: listDtoSchema.nullable() },
  'lists.save': { input: listInputSchema, output: listDtoSchema },
  'lists.delete': { input: z.object({ id: idSchema }), output: ok },
  'lists.duplicate': { input: z.object({ id: idSchema }), output: listDtoSchema },
  'lists.addGames': { input: z.object({ listId: idSchema, gameIds: z.array(idSchema).min(1) }), output: z.object({ added: z.number().int() }) },
  'lists.addFromFilter': { input: z.object({ listId: idSchema, scope: scopeSchema, filters: filtersSchema }), output: z.object({ added: z.number().int() }) },
  'lists.removeGames': { input: z.object({ listId: idSchema, gameIds: z.array(idSchema).min(1) }), output: ok },
  'lists.reorder': { input: z.object({ listId: idSchema, orderedGameIds: z.array(idSchema) }), output: ok },
  'lists.setItemNote': { input: z.object({ listId: idSchema, gameId: idSchema, note: z.string().max(300).nullable() }), output: ok },
  'lists.reorderLists': { input: z.object({ orderedIds: z.array(idSchema) }), output: ok },
  'lists.forGame': { input: z.object({ gameId: idSchema }), output: z.array(z.object({ id: idSchema, name: z.string(), icon: z.string().nullable(), color: hexColorSchema.nullable(), contains: z.boolean() })) },
  // Текст собирает renderer — там локализация; main показывает диалог и пишет файл (10 §1).
  'lists.exportMarkdown': { input: z.object({ fileName: z.string().min(1).max(160), markdown: z.string().min(1).max(4_000_000) }), output: z.object({ path: z.string() }).nullable() },

  /* -------------------------------------------------------- серии */
  'series.list': { input: z.object({ q: z.string().optional(), sort: z.enum(['name', 'games', 'latest', 'progress']).default('name') }).optional(), output: z.array(seriesDtoSchema) },
  'series.get': { input: z.object({ id: idSchema }), output: seriesDtoSchema.nullable() },
  'series.children': { input: z.object({ id: idSchema }), output: z.array(seriesDtoSchema) },
  'series.reorder': { input: z.object({ seriesId: idSchema, orderedGameIds: z.array(idSchema) }), output: ok },
  'series.setPosition': { input: z.object({ seriesId: idSchema, gameId: idSchema, position: z.number().int().min(1) }), output: ok },
  'series.addGames': { input: z.object({ seriesId: idSchema, gameIds: z.array(idSchema).min(1) }), output: z.object({ added: z.number().int() }) },
  'series.removeGames': { input: z.object({ seriesId: idSchema, gameIds: z.array(idSchema).min(1) }), output: ok },
  'series.autoNumber': { input: z.object({ seriesId: idSchema }), output: ok },
  'series.setLabel': { input: z.object({ seriesId: idSchema, gameId: idSchema, label: z.string().max(60).nullable() }), output: ok },
  'series.timeline': { input: z.object({ seriesId: idSchema }), output: z.array(z.object({ gameId: idSchema, title: z.string(), year: z.number().int().nullable(), coverFile: z.string().nullable(), status: z.enum(GAME_STATUSES).nullable() })) },

  /* ----------------------------------------------------- компании */
  'companies.list': { input: z.object({ role: z.enum(['all', 'developer', 'publisher']).default('all'), q: z.string().optional(), country: z.string().length(2).optional(), letter: z.string().max(2).optional(), sort: z.enum(['name', 'games', 'country', 'founded']).default('name') }).optional(), output: z.array(companyDtoSchema) },
  'companies.get': { input: z.object({ id: idSchema }), output: companyDtoSchema.nullable() },
  'companies.series': { input: z.object({ id: idSchema }), output: z.array(seriesDtoSchema.extend({ companyGameCount: z.number().int() })) },
  'companies.children': { input: z.object({ id: idSchema }), output: z.array(companyDtoSchema) },

  /* ------------------------------------------------------ каталог */
  'catalog.counts': { input: nothing, output: z.object({ games: z.number().int(), companies: z.number().int(), series: z.number().int(), genres: z.number().int(), platforms: z.number().int(), tags: z.number().int() }) },
  'catalog.recent': { input: z.object({ limit: z.number().int().default(10) }).optional(), output: z.array(z.object({ entityType: z.string(), id: idSchema, name: z.string(), createdAt: z.string(), coverFile: z.string().nullable() })) },
  'catalog.games.get': { input: z.object({ id: idSchema }), output: gameInputSchema.nullable() },
  'catalog.games.save': { input: gameInputSchema, output: idOnly },
  'catalog.games.delete': { input: z.object({ ids: z.array(idSchema).min(1) }), output: ok },
  'catalog.games.similar': { input: z.object({ title: z.string(), excludeId: idSchema.optional() }), output: z.array(z.object({ id: idSchema, title: z.string(), releaseYear: z.number().int().nullable() })) },
  'catalog.games.bulkAssign': { input: z.object({ gameIds: z.array(idSchema).min(1), genreIds: z.array(idSchema).optional(), platformIds: z.array(idSchema).optional(), seriesId: idSchema.nullish() }), output: ok },

  'catalog.companies.save': { input: companyInputSchema, output: idOnly },
  'catalog.companies.delete': { input: z.object({ id: idSchema }), output: ok },
  'catalog.companies.merge': { input: z.object({ fromId: idSchema, intoId: idSchema }), output: ok },
  'catalog.companies.get': { input: z.object({ id: idSchema }), output: companyInputSchema.nullable() },

  'catalog.series.save': { input: seriesInputSchema, output: idOnly },
  'catalog.series.delete': { input: z.object({ id: idSchema }), output: ok },
  'catalog.series.get': { input: z.object({ id: idSchema }), output: seriesInputSchema.nullable() },

  'catalog.genres.list': { input: nothing, output: z.array(genreDtoSchema) },
  'catalog.genres.save': { input: z.object({ id: idSchema.optional(), name: z.string().min(1).max(80), description: z.string().max(1000).nullish(), color: hexColorSchema.nullish() }), output: idOnly },
  'catalog.genres.delete': { input: z.object({ id: idSchema }), output: ok },
  'catalog.genres.merge': { input: z.object({ fromId: idSchema, intoId: idSchema }), output: ok },

  'catalog.platforms.list': { input: nothing, output: z.array(platformDtoSchema) },
  'catalog.platforms.save': { input: z.object({ id: idSchema.optional(), name: z.string().min(1).max(80), shortName: z.string().min(1).max(20), family: z.enum(PLATFORM_FAMILIES), sortOrder: z.number().int().default(0) }), output: idOnly },
  'catalog.platforms.delete': { input: z.object({ id: idSchema }), output: ok },
  'catalog.platforms.merge': { input: z.object({ fromId: idSchema, intoId: idSchema }), output: ok },

  'catalog.modes.list': { input: nothing, output: z.array(modeDtoSchema) },

  'catalog.tags.list': { input: nothing, output: z.array(tagDtoSchema) },
  'catalog.tags.save': { input: z.object({ id: idSchema.optional(), name: z.string().min(1).max(60), color: hexColorSchema.nullish() }), output: idOnly },
  'catalog.tags.delete': { input: z.object({ id: idSchema }), output: ok },
  'catalog.tags.merge': { input: z.object({ fromId: idSchema, intoId: idSchema }), output: ok },

  /* ------------------------------------------- внешние источники (08) */
  'providers.status': { input: nothing, output: z.array(providerStatusSchema) },
  'providers.search': { input: z.object({ provider: importProviderSchema, query: z.string().min(1).max(200), limit: z.number().int().min(1).max(20).default(10) }), output: z.array(providerHitSchema) },
  'providers.fetch': { input: z.object({ provider: importProviderSchema, externalId: z.string().min(1).max(120) }), output: canonicalGameSchema },
  // `clientSecret` не нужен источникам с одним ключом (RAWG) — только IGDB через Twitch.
  'providers.setCredentials': { input: z.object({ provider: importProviderSchema, clientId: z.string().min(1).max(200), clientSecret: z.string().min(1).max(200).optional() }), output: z.array(providerStatusSchema) },
  'providers.clearCredentials': { input: z.object({ provider: importProviderSchema }), output: z.array(providerStatusSchema) },
  'providers.test': { input: z.object({ provider: importProviderSchema }), output: z.object({ ok: z.boolean(), message: z.string() }) },
  'providers.clearCache': { input: nothing, output: z.object({ removed: z.number().int() }) },

  /* --------------------------------------------------- изображения */
  'images.save': { input: z.object({ bytes: z.instanceof(Uint8Array), kind: z.enum(IMAGE_KINDS), mime: z.string(), width: z.number().int(), height: z.number().int(), dominantColor: hexColorSchema.nullish(), sourceUrl: z.string().nullish() }), output: imageDtoSchema },
  'images.fetchUrl': { input: z.object({ url: z.string().url() }), output: z.object({ bytes: z.instanceof(Uint8Array), mime: z.string() }) },
  'images.delete': { input: z.object({ id: idSchema }), output: ok },
  'images.gc': { input: nothing, output: z.object({ removed: z.number().int(), freedBytes: z.number().int() }) },

  /* ------------------------------------- журнал сессий и прохождения */
  'sessions.list': { input: z.object({ gameId: idSchema.optional(), playthroughId: idSchema.optional(), from: dateSchema.optional(), to: dateSchema.optional(), limit: z.number().int().min(1).max(500).default(100), offset: z.number().int().min(0).default(0) }), output: z.array(playSessionDtoSchema) },
  'sessions.save': { input: sessionInputSchema, output: playSessionDtoSchema },
  'sessions.delete': { input: z.object({ id: idSchema }), output: ok },
  // Свод для карты активности: дни окна + стрики по всей истории (06 §1.9).
  'sessions.activity': { input: z.object({ from: dateSchema, to: dateSchema, gameId: idSchema.optional() }), output: activitySummarySchema },
  'playthroughs.list': { input: z.object({ gameId: idSchema }), output: z.array(playthroughDtoSchema) },
  'playthroughs.save': { input: playthroughInputSchema, output: playthroughDtoSchema },
  'playthroughs.delete': { input: z.object({ id: idSchema }), output: ok },

  /* ------------------------------------------------------- профиль */
  'profile.get': { input: nothing, output: profileDtoSchema },
  'profile.patch': { input: profilePatchSchema, output: profileDtoSchema },
  'stats.get': { input: nothing, output: statsSchema },
  'activity.list': { input: z.object({ limit: z.number().int().min(1).max(200).default(20), gameId: idSchema.optional() }).optional(), output: z.array(activityDtoSchema) },
  'profile.nowPlaying': { input: nothing, output: z.array(gameCardDtoSchema.extend({ resumeNote: z.string().nullable() })) },

  /* --------------------------------------------------- достижения */
  'achievements.get': { input: nothing, output: achievementsSummarySchema },
  'achievements.recompute': { input: nothing, output: achievementsSummarySchema },

  /* -------------------------------------------------------- поиск */
  'search.query': { input: z.object({ q: z.string(), limit: z.number().int().min(1).max(50).default(8) }), output: searchResultSchema },
  'search.recent': { input: nothing, output: z.array(z.object({ entityType: z.string(), id: idSchema, name: z.string(), coverFile: z.string().nullable() })) },
  'search.pushRecent': { input: z.object({ entityType: z.string(), id: idSchema }), output: ok },
  'search.reindex': { input: nothing, output: z.object({ rows: z.number().int() }) },

  /* ------------------------------------------------------ пресеты */
  'presets.list': { input: z.object({ scope: z.string() }), output: z.array(filterPresetDtoSchema) },
  'presets.save': { input: z.object({ id: idSchema.optional(), scope: z.string(), name: z.string().min(1).max(60), filtersJson: z.string(), sortJson: z.string(), view: z.string() }), output: filterPresetDtoSchema },
  'presets.delete': { input: z.object({ id: idSchema }), output: ok },

  /* ------------------------------------------------------- бэкапы */
  'backups.list': { input: nothing, output: z.array(backupDtoSchema) },
  'backups.create': { input: nothing, output: backupDtoSchema },
  'backups.restore': { input: z.object({ fileName: z.string() }), output: ok },
  'backups.delete': { input: z.object({ fileName: z.string() }), output: ok },
  'exportImport.export': { input: nothing, output: z.object({ path: z.string(), sizeBytes: z.number().int() }).nullable() },
  'exportImport.import': { input: nothing, output: z.object({ imported: z.boolean() }) },
  'data.wipe': { input: z.object({ confirm: z.literal('УДАЛИТЬ') }), output: ok },

  /* ------------------------------------------------ синхронизация */
  'sync.getState': { input: nothing, output: syncStateSchema },
  'sync.signIn': { input: nothing, output: syncStateSchema },
  'sync.signOut': { input: nothing, output: syncStateSchema },
  'sync.now': { input: nothing, output: syncStateSchema },
  'sync.resolveConflict': { input: z.object({ choice: z.enum(['local', 'remote', 'keep_both']) }), output: syncStateSchema },
  'sync.getLog': { input: nothing, output: z.array(z.object({ at: z.string(), kind: z.string(), message: z.string() })) }
} as const

export type Channels = typeof channels
export type ChannelName = keyof Channels
export type ChannelInput<K extends ChannelName> = z.infer<Channels[K]['input']>
export type ChannelOutput<K extends ChannelName> = z.infer<Channels[K]['output']>

export const channelNames = Object.keys(channels) as ChannelName[]

/* ---------------------------------------------------------------- события */

export const appEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('dbChanged'), tables: z.array(z.string()), revision: z.number().int() }),
  z.object({ type: z.literal('dbReplaced') }),
  z.object({ type: z.literal('syncState'), state: syncStateSchema }),
  z.object({ type: z.literal('achievementUnlocked'), key: z.string(), title: z.string(), level: z.number().int(), icon: z.string() }),
  z.object({ type: z.literal('imagesDownloaded'), count: z.number().int() }),
  z.object({ type: z.literal('progress'), job: z.string(), value: z.number(), message: z.string().optional() }),
  z.object({ type: z.literal('navigate'), to: z.string() })
])
export type AppEvent = z.infer<typeof appEventSchema>
export type AppEventType = AppEvent['type']

/** Карта «таблица → ключи кеша TanStack Query» (01 §9). */
export const TABLE_TO_QUERY_KEYS: Record<string, string[]> = {
  games: ['collection', 'game', 'catalog', 'series', 'companies', 'stats', 'search'],
  user_game: ['collection', 'game', 'stats', 'profile', 'achievements', 'activity', 'lists', 'series', 'companies'],
  play_sessions: ['sessions', 'game', 'collection', 'profile', 'stats', 'achievements', 'activity'],
  playthroughs: ['playthroughs', 'sessions', 'game'],
  lists: ['lists', 'collection', 'profile', 'achievements'],
  list_items: ['lists', 'collection', 'game', 'profile'],
  series: ['series', 'collection', 'game', 'catalog'],
  series_games: ['series', 'collection', 'game', 'achievements'],
  companies: ['companies', 'collection', 'game', 'catalog', 'stats'],
  game_companies: ['companies', 'collection', 'game', 'stats'],
  genres: ['catalog', 'collection', 'game', 'stats'],
  game_genres: ['collection', 'game', 'stats', 'achievements'],
  platforms: ['catalog', 'collection', 'game', 'stats'],
  game_platforms: ['collection', 'game', 'stats'],
  tags: ['catalog', 'collection', 'game'],
  game_tags: ['collection', 'game'],
  modes: ['catalog', 'game'],
  images: ['game', 'collection', 'profile', 'lists', 'series', 'companies', 'catalog'],
  profile: ['profile', 'achievements'],
  activity_log: ['activity', 'profile'],
  user_achievements: ['achievements', 'profile'],
  filter_presets: ['presets']
}
