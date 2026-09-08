import { z } from 'zod'
import {
  GAME_CATEGORIES,
  IMPORT_PROVIDERS,
  RELEASE_DATE_PRECISIONS,
  RELEASE_STATUSES
} from '../constants'
import { partialDateSchema } from './common'

/**
 * Импорт данных из внешних источников (ТЗ 08).
 *
 * Каноническая модель (`canonicalGameSchema`) намеренно не зависит от провайдера:
 * связанные сущности приходят **именами**, а не идентификаторами, потому что на
 * стороне провайдера наших id не существует. Сопоставление имён с каталогом и
 * создание недостающих записей происходит при сохранении формы (08 §3 п. 3).
 */

export const importProviderSchema = z.enum(IMPORT_PROVIDERS)
export type ImportProviderId = z.infer<typeof importProviderSchema>

/** Строка результата поиска — то, что показываем в списке совпадений (08 §3 п. 2). */
export const providerHitSchema = z.object({
  provider: importProviderSchema,
  externalId: z.string(),
  title: z.string(),
  year: z.number().int().nullable(),
  /** Мелкая обложка для списка; грузится main-процессом, в renderer приходит уже как data URL. */
  thumbUrl: z.string().nullable(),
  developer: z.string().nullable(),
  platforms: z.array(z.string()),
  /** Подсказка «DLC», «Демо» и т.п., чтобы не выбрать не ту запись. */
  kind: z.string().nullable(),
  url: z.string().nullable()
})
export type ProviderHit = z.infer<typeof providerHitSchema>

/**
 * Связанная сущность в ответе провайдера. Кроме имени несём slug нашей схемы:
 * жанры, режимы и студии в каталоге названы по-русски («Экшен», «Одиночная»),
 * поэтому сопоставление идёт по slug, а имя нужно только на случай создания новой записи.
 */
export const namedRefSchema = z.object({ slug: z.string(), name: z.string() })
export type NamedRef = z.infer<typeof namedRefSchema>

/** Картинки провайдера — ссылки, скачиванием занимается renderer через `images.fetchUrl`. */
export const canonicalImagesSchema = z.object({
  cover: z.string().nullish(),
  backdrop: z.string().nullish(),
  logo: z.string().nullish()
})

export const canonicalGameSchema = z.object({
  provider: importProviderSchema,
  externalId: z.string(),
  url: z.string().nullish(),
  /** sha256 сырого ответа: повторный импорт без изменений ничего не пишет (08 §7 п. 3). */
  rawHash: z.string(),
  rawJson: z.string(),
  fetchedAt: z.string(),

  title: z.string().nullish(),
  altTitles: z.array(z.string()).default([]),
  category: z.enum(GAME_CATEGORIES).nullish(),
  releaseDate: partialDateSchema.nullish(),
  releaseDatePrecision: z.enum(RELEASE_DATE_PRECISIONS).nullish(),
  releaseStatus: z.enum(RELEASE_STATUSES).nullish(),
  summary: z.string().nullish(),
  storyline: z.string().nullish(),
  ageRating: z.string().nullish(),
  website: z.string().nullish(),

  metacriticScore: z.number().int().min(0).max(100).nullish(),
  metacriticUrl: z.string().nullish(),
  /** Минуты, как и в `games.hltb_*`: main / extra / completionist. */
  hltbMainMin: z.number().int().min(0).nullish(),
  hltbExtraMin: z.number().int().min(0).nullish(),
  hltbCompleteMin: z.number().int().min(0).nullish(),
  /** Сколько прохождений усреднено — показываем рядом со временем, чтобы видеть надёжность. */
  hltbCount: z.number().int().min(0).nullish(),

  developers: z.array(namedRefSchema).default([]),
  publishers: z.array(namedRefSchema).default([]),
  genres: z.array(namedRefSchema).default([]),
  modes: z.array(namedRefSchema).default([]),
  platforms: z.array(namedRefSchema).default([]),
  tags: z.array(namedRefSchema).default([]),
  series: namedRefSchema.nullish(),

  images: canonicalImagesSchema.default({}),
  /** Идентификаторы у других провайдеров: IGDB отдаёт Steam appid, Steam — ссылку на Metacritic. */
  crossIds: z.record(z.string(), z.string()).default({})
})
export type CanonicalGame = z.infer<typeof canonicalGameSchema>

/** Готовность провайдера к работе — для панели импорта и раздела настроек. */
export const providerStatusSchema = z.object({
  provider: importProviderSchema,
  /**
   * Просит ли источник ключи у пользователя. Steam не просит вовсе, RAWG получает
   * ключ приложения при сборке (`.env`), и только IGDB требует ключи от каждого.
   */
  needsCredentials: z.boolean(),
  hasCredentials: z.boolean(),
  ready: z.boolean(),
  /**
   * Код причины для i18n:
   * `ok` — работает; `noCredentials` — пользователь не ввёл ключи;
   * `noEncryption` — недоступно защищённое хранилище ОС;
   * `notBundled` — ключ не вшит в эту сборку (пустой `.env` при сборке).
   */
  reason: z.enum(['ok', 'noCredentials', 'noEncryption', 'notBundled'])
})
export type ProviderStatus = z.infer<typeof providerStatusSchema>

/**
 * Что импорт записывает в `external_ids` и `field_provenance` при сохранении формы
 * (08 §3 п. 4). `fields` — имена полей канонической модели, применённые пользователем.
 */
export const importProvenanceSchema = z.object({
  provider: importProviderSchema,
  externalId: z.string(),
  url: z.string().nullish(),
  rawHash: z.string(),
  rawJson: z.string(),
  fields: z.array(z.string()).default([])
})
export type ImportProvenance = z.infer<typeof importProvenanceSchema>

/**
 * Имена сущностей, которых ещё нет в каталоге. Backend ищет их по имени
 * без учёта регистра и создаёт только действительно новые — так повторный
 * импорт той же студии не плодит дубликаты.
 */
export const createEntitiesSchema = z.object({
  developers: z.array(namedRefSchema).default([]),
  publishers: z.array(namedRefSchema).default([]),
  genres: z.array(namedRefSchema).default([]),
  platforms: z.array(namedRefSchema).default([]),
  modes: z.array(namedRefSchema).default([]),
  tags: z.array(namedRefSchema).default([]),
  series: namedRefSchema.nullish()
})
export type CreateEntities = z.infer<typeof createEntitiesSchema>
