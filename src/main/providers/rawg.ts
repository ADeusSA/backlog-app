/**
 * RAWG как источник данных — замена IGDB там, где приложение Twitch недоступно.
 *
 * IGDB выдаёт токен только через приложение на dev.twitch.tv, а для его создания Twitch
 * требует двухфакторную аутентификацию по телефону и принимает не все страны. У RAWG
 * ключ выдаётся сразу после регистрации по почте (`rawg.io/apidocs`), телефон не нужен.
 *
 * Что даёт: **примерное время прохождения** (`playtime`, среднее в часах), оценку
 * Metacritic со ссылкой, описание, студии, жанры, теги, платформы, фон, ESRB.
 * Чего не даёт: раздельных «сюжет / с побочными / на 100 %» (это только IGDB
 * `game_time_to_beats`), вертикальной обложки и серий.
 *
 * Бесплатный тариф RAWG — 20 000 запросов в месяц, только некоммерческое использование
 * и обязательная видимая ссылка на источник (см. раздел настроек и подвал страницы игры).
 */
import crypto from 'node:crypto'
import { AppError } from '@shared/errors'
import type { CanonicalGame, NamedRef, ProviderHit } from '@shared/schema/providers'
import type { ReleaseDatePrecision } from '@shared/constants'
import { cached } from './cache'
import { httpJson } from './http'
import { acquire } from './rate-limit'
import { getCredentials } from './credentials'
import { bundledRawgKey } from './rawg.config'
import { uiLanguage } from './locale'
import { asRef, mapGenre, mapMode, mapPlatform, uniqueRefs } from './taxonomy-map'

const LABEL = 'RAWG'
const API = 'https://api.rawg.io/api'

/** Сколько тегов берём: у RAWG их бывает под сотню, и все они в каталог не нужны. */
const MAX_TAGS = 8

/**
 * Теги RAWG — это пользовательские теги Steam, и среди них половина описывает не игру,
 * а возможности витрины: «Steam Achievements», «Full controller support», «Steam Cloud».
 * В каталоге тегов им не место, поэтому отсеиваем по характерным словам в slug.
 */
const TECHNICAL_TAG_PATTERN =
  /^(steam-|remote-play|cross-platform|controller$)|achievements|trading-cards|controller-support|steam-cloud|workshop|leaderboards|captions|level-editor|in-app-purchases|vr-support|commentary|stats$|includes-source-sdk|valve-anti-cheat/

export function isTechnicalTag(slug: string | undefined): boolean {
  return TECHNICAL_TAG_PATTERN.test((slug ?? '').toLowerCase())
}

/* ----------------------------------------------------------------- ответы API */

interface RawgTag {
  name?: string
  slug?: string
  language?: string
  games_count?: number
}

interface RawgGame {
  id: number
  slug?: string
  name?: string
  name_original?: string
  released?: string | null
  tba?: boolean
  description_raw?: string
  background_image?: string | null
  background_image_additional?: string | null
  website?: string
  metacritic?: number | null
  metacritic_url?: string
  /** Среднее время прохождения в часах. */
  playtime?: number
  updated?: string
  esrb_rating?: { name?: string } | null
  genres?: Array<{ name?: string; slug?: string }>
  tags?: RawgTag[]
  platforms?: Array<{ platform?: { name?: string; slug?: string } }>
  developers?: Array<{ name?: string; slug?: string }>
  publishers?: Array<{ name?: string; slug?: string }>
  alternative_names?: string[]
}

interface RawgSearchResponse {
  count: number
  results?: RawgGame[]
}

/* ------------------------------------------------------------------- запросы */

/**
 * Ключ приложения: вшит в сборку через `.env` (см. rawg.config.ts), чтобы у тех, кому
 * отдали готовый архив, всё работало без регистрации. Ключ из защищённого хранилища
 * имеет приоритет — это запасной путь на случай, если общий ключ залимитили и кто-то
 * захочет подставить свой (канал `providers.setCredentials` для этого остался).
 */
function apiKey(): string {
  const stored = getCredentials('rawg')?.clientId?.trim()
  const key = stored || bundledRawgKey()
  if (!key) {
    throw new AppError(
      'sync_auth',
      'В этой сборке нет ключа RAWG. Ключ задаётся при сборке в файле .env (MAIN_VITE_RAWG_KEY).'
    )
  }
  return key
}

async function get<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const query = new URLSearchParams({ key: apiKey(), ...params })
  await acquire('rawg')
  return httpJson<T>(`${API}/${path}?${query.toString()}`, { label: LABEL })
}

/** Ссылка `rawg.io/games/<slug>` → slug; иначе `null`. */
export function parseRawgRef(input: string): string | null {
  const match = /rawg\.io\/games\/([a-z0-9-]+)/i.exec(input.trim())
  return match?.[1] ?? null
}

/* ------------------------------------------------------------------- маппинг */

/** `released` — всегда полная дата; при `tba` даты нет вовсе. */
export function mapDate(
  released: string | null | undefined,
  tba: boolean | undefined
): { date: string | null; precision: ReleaseDatePrecision } {
  if (tba || !released) return { date: null, precision: 'tba' }
  return /^\d{4}-\d{2}-\d{2}$/.test(released)
    ? { date: released, precision: 'day' }
    : { date: null, precision: 'tba' }
}

/**
 * Короткое описание RAWG не отдаёт — берём первый абзац полного,
 * чтобы «Аннотация» не осталась пустой, а остальное кладём в «Сюжет».
 */
/**
 * Предел поля «Аннотация» из схемы (`gameInputSchema.summary`). Держим именно его:
 * у RAWG описание часто идёт одним абзацем на 700–1500 символов, и при меньшем пороге
 * оно уезжало и в аннотацию, и в «Сюжет» — в диалоге импорта это выглядело дублем.
 */
const SUMMARY_LIMIT = 4000

export function splitDescription(raw: string | undefined): { summary: string | null; storyline: string | null } {
  // RAWG разделяет абзацы парой CRLF: без нормализации `\n{2,}` не совпадает,
  // и весь текст уезжал в оба поля целиком.
  const text = (raw ?? '').replace(/\r\n?/g, '\n').trim()
  if (!text) return { summary: null, storyline: null }

  const paragraphs = text.split(/\n{2,}/)
  const first = (paragraphs[0] ?? '').trim()
  const rest = paragraphs.slice(1).join('\n\n').trim()

  // Аннотация — первый абзац, «Сюжет» — то, что после него: класть в оба поля один
  // и тот же текст незачем, в диалоге импорта это выглядело как две одинаковые строки.
  // Исключение — очень длинный первый абзац: его приходится обрезать, и тогда полный
  // текст уходит в «Сюжет», чтобы ничего не потерялось.
  const summary = first.slice(0, SUMMARY_LIMIT)
  const storyline = first.length > SUMMARY_LIMIT ? text : rest || null

  return { summary: summary || null, storyline }
}

/**
 * Теги RAWG — это пользовательские теги Steam: их сотни, часть дублирует режимы
 * («Singleplayer», «Co-op»), часть приходит на других языках. Оставляем самые
 * популярные на нужном языке, а те, что на самом деле режимы, уводим в режимы.
 */
export function splitTags(tags: RawgTag[] | undefined, language: 'eng' | 'rus'): { modes: NamedRef[]; tags: NamedRef[] } {
  const all = tags ?? []
  // Английские теги — основа: по ним работает сопоставление режимов со справочником.
  const modes = uniqueRefs(all.map((tag) => (tag.slug ? mapMode(tag.slug) : null)))
  const modeSlugs = new Set(all.filter((tag) => tag.slug && mapMode(tag.slug)).map((tag) => tag.slug))

  const usable = (tag: RawgTag): boolean =>
    Boolean(tag.name) && !modeSlugs.has(tag.slug) && !isTechnicalTag(tag.slug)

  const wanted = all.filter((tag) => tag.language === language && usable(tag))
  // Если тегов на языке интерфейса нет, показываем английские — лучше, чем ничего.
  const source = wanted.length > 0 ? wanted : all.filter(usable)

  const picked = source
    .slice()
    .sort((a, b) => (b.games_count ?? 0) - (a.games_count ?? 0))
    .slice(0, MAX_TAGS)

  return { modes, tags: uniqueRefs(picked.map((tag) => asRef(tag.name!))) }
}

export function toCanonical(game: RawgGame, language: 'eng' | 'rus'): CanonicalGame {
  const rawJson = JSON.stringify(game)
  const { date, precision } = mapDate(game.released, game.tba)
  const { summary, storyline } = splitDescription(game.description_raw)
  const { modes, tags } = splitTags(game.tags, language)

  const title = game.name?.trim() || null
  const original = game.name_original?.trim()
  const altTitles = original && title && original !== title ? [original] : []

  return {
    provider: 'rawg',
    externalId: String(game.id),
    url: `https://rawg.io/games/${game.slug ?? game.id}`,
    // Своего checksum у RAWG нет — считаем хеш ответа сами.
    rawHash: crypto.createHash('sha256').update(rawJson).digest('hex'),
    rawJson,
    fetchedAt: new Date().toISOString(),

    title,
    altTitles,
    // Категорию RAWG не различает — всё считается основной игрой.
    category: 'main',
    releaseDate: date,
    releaseDatePrecision: precision,
    releaseStatus: game.tba ? 'announced' : 'released',
    summary,
    storyline,
    ageRating: game.esrb_rating?.name ?? null,
    website: game.website?.trim() || null,

    metacriticScore: typeof game.metacritic === 'number' ? game.metacritic : null,
    metacriticUrl: game.metacritic_url ? game.metacritic_url.split('?')[0] ?? null : null,
    // `playtime` — одно усреднённое число часов, поэтому заполняем только «сюжет».
    hltbMainMin: game.playtime && game.playtime > 0 ? game.playtime * 60 : null,
    hltbExtraMin: null,
    hltbCompleteMin: null,
    hltbCount: null,

    developers: uniqueRefs((game.developers ?? []).map((c) => (c.name ? asRef(c.name) : null))),
    publishers: uniqueRefs((game.publishers ?? []).map((c) => (c.name ? asRef(c.name) : null))),
    genres: uniqueRefs((game.genres ?? []).map((g) => (g.name ? mapGenre(g.slug ?? g.name) : null))),
    modes,
    platforms: uniqueRefs(
      (game.platforms ?? []).map((p) =>
        p.platform?.slug ? mapPlatform(p.platform.slug, p.platform.name ?? p.platform.slug) : null
      )
    ),
    tags,
    // Серий RAWG не даёт: `/games/{id}/game-series` возвращает список игр без названия серии.
    series: null,

    images: {
      // Вертикальной обложки у RAWG нет — только горизонтальные кадры.
      cover: null,
      backdrop: game.background_image ?? game.background_image_additional ?? null,
      logo: null
    },
    crossIds: { rawg: String(game.id) }
  }
}

/* ------------------------------------------------------------------- методы */

export async function search(term: string, limit: number): Promise<ProviderHit[]> {
  const slug = parseRawgRef(term)
  if (slug) {
    const game = await fetchGame(slug)
    return [
      {
        provider: 'rawg',
        externalId: game.externalId,
        title: game.title ?? slug,
        year: game.releaseDate ? Number(game.releaseDate.slice(0, 4)) : null,
        thumbUrl: game.images.backdrop ?? null,
        developer: game.developers[0]?.name ?? null,
        platforms: game.platforms.map((p) => p.name),
        kind: null,
        url: game.url ?? null
      }
    ]
  }

  const data = await cached(`rawg:search:${term.toLowerCase()}:${limit}`, () =>
    get<RawgSearchResponse>('games', { search: term, page_size: String(limit) })
  )

  return (data.results ?? []).map((game) => ({
    provider: 'rawg' as const,
    externalId: String(game.id),
    title: game.name ?? `#${game.id}`,
    year: game.released ? Number(game.released.slice(0, 4)) : null,
    thumbUrl: game.background_image ?? null,
    developer: null,
    platforms: (game.platforms ?? [])
      .map((p) => (p.platform?.slug ? mapPlatform(p.platform.slug, p.platform.name ?? '').name : ''))
      .filter(Boolean),
    kind: null,
    url: `https://rawg.io/games/${game.slug ?? game.id}`
  }))
}

export async function fetchGame(externalId: string): Promise<CanonicalGame> {
  const game = await cached(`rawg:game:${externalId}`, () => get<RawgGame>(`games/${externalId}`))
  if (!game?.id) throw new AppError('not_found', `RAWG не нашёл игру ${externalId}`)
  // Описания RAWG отдаёт только по-английски, а вот теги размечены языком —
  // при русском интерфейсе берём русские, если они есть.
  return toCanonical(game, uiLanguage() === 'ru' ? 'rus' : 'eng')
}

/** Проверка ключа из настроек: один дешёвый запрос. */
export async function test(): Promise<{ ok: boolean; message: string }> {
  try {
    await get<RawgSearchResponse>('games', { page_size: '1' })
    return { ok: true, message: 'RAWG отвечает, ключ принят' }
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : String(err) }
  }
}
