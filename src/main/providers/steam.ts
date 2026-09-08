/**
 * Steam как источник данных (08 §2). Ключи не нужны.
 *
 * - поиск: `store.steampowered.com/api/storesearch` — тот же JSON, которым пользуется
 *   поисковая строка магазина;
 * - карточка: `store.steampowered.com/api/appdetails` — оттуда же берётся **оценка
 *   Metacritic** (score + ссылка), единственный легальный способ её получить: своего
 *   API у Metacritic нет, а скрапинг сайта запрещён (08 §2, research §E п. 7);
 * - картинки: CDN Steam — вертикальная обложка 600×900, hero-фон и логотип.
 *
 * SteamDB здесь не запрашивается: публичного API у него нет, а скрапинг прямо запрещён
 * правилами сайта и карается автобаном. Ссылку вида `steamdb.info/app/<id>` мы принимаем —
 * но лишь чтобы взять из неё appid и сходить в API самого Steam.
 */
import crypto from 'node:crypto'
import { AppError } from '@shared/errors'
import type { CanonicalGame, ProviderHit } from '@shared/schema/providers'
import type { GameCategory, ReleaseDatePrecision, ReleaseStatus } from '@shared/constants'
import { cached } from './cache'
import { httpJson } from './http'
import { acquire } from './rate-limit'
import { steamLanguage, uiLanguage, unquote } from './locale'
import { log } from '../log'
import { asRef, mapGenre, mapMode, mapPlatform, uniqueRefs } from './taxonomy-map'

const LABEL = 'Steam'
const CDN = 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps'

/* ----------------------------------------------------------------- ответы API */

interface StoreSearchResponse {
  total: number
  items?: Array<{
    id: number
    name: string
    type?: string
    tiny_image?: string
    metascore?: string
    platforms?: Record<string, boolean>
  }>
}

interface AppDetails {
  type?: string
  name?: string
  steam_appid?: number
  required_age?: number | string
  short_description?: string
  detailed_description?: string
  about_the_game?: string
  website?: string | null
  developers?: string[]
  publishers?: string[]
  metacritic?: { score?: number; url?: string }
  genres?: Array<{ id?: string; description?: string }>
  categories?: Array<{ id?: number; description?: string }>
  platforms?: Record<string, boolean>
  release_date?: { coming_soon?: boolean; date?: string }
  dlc?: number[]
  fullgame?: { appid?: string; name?: string }
}

type AppDetailsResponse = Record<string, { success: boolean; data?: AppDetails }>

/* ------------------------------------------------------------------ разбор ссылок */

/**
 * Достаёт appid из того, что пользователь вставил: ссылка магазина, `steam://`,
 * ссылка SteamDB или просто число.
 */
export function parseSteamRef(input: string): string | null {
  const value = input.trim()
  if (/^\d{1,8}$/.test(value)) return value
  const patterns = [
    /store\.steampowered\.com\/app\/(\d+)/i,
    /steamcommunity\.com\/app\/(\d+)/i,
    /steamdb\.info\/app\/(\d+)/i,
    /^steam:\/\/(?:store|run)\/(\d+)/i
  ]
  for (const pattern of patterns) {
    const match = pattern.exec(value)
    if (match?.[1]) return match[1]
  }
  return null
}

/* ------------------------------------------------------------------ разбор данных */

const MONTHS: Record<string, string> = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
}

/**
 * Дата релиза Steam — локализованная строка, поэтому запрашиваем `l=english`
 * и разбираем три её вида: «Feb 24, 2022», «February 2022», «2022».
 */
export function parseSteamDate(
  raw: string | undefined
): { date: string | null; precision: ReleaseDatePrecision } {
  const value = (raw ?? '').trim()
  if (!value) return { date: null, precision: 'tba' }

  const full = /^(\d{1,2})?\s*([A-Za-z]{3,})\s*(\d{1,2})?,?\s*(\d{4})$/.exec(value)
  if (full) {
    const [, dayBefore, monthName, dayAfter, year] = full
    const month = MONTHS[(monthName ?? '').slice(0, 3).toLowerCase()]
    const day = dayBefore ?? dayAfter
    if (month && day) return { date: `${year}-${month}-${String(day).padStart(2, '0')}`, precision: 'day' }
    if (month) return { date: `${year}-${month}`, precision: 'month' }
  }
  const quarter = /^Q([1-4])\s+(\d{4})$/i.exec(value)
  if (quarter) return { date: `${quarter[2]}`, precision: 'quarter' }
  const yearOnly = /^(\d{4})$/.exec(value)
  if (yearOnly) return { date: yearOnly[1] ?? null, precision: 'year' }

  return { date: null, precision: 'tba' }
}

/** `type` Steam → наша категория. Всё, кроме DLC и демо, считаем основной игрой. */
function mapCategory(type: string | undefined): GameCategory {
  switch ((type ?? '').toLowerCase()) {
    case 'dlc':
      return 'dlc'
    case 'episode':
      return 'episode'
    case 'mod':
      return 'mod'
    default:
      return 'main'
  }
}

function mapReleaseStatus(details: AppDetails, genres: string[]): ReleaseStatus {
  if (details.release_date?.coming_soon) return 'announced'
  if (genres.some((g) => g.toLowerCase() === 'early access')) return 'early_access'
  return 'released'
}

/** HTML описания Steam → простой текст: в наших полях разметки нет. */
export function stripHtml(html: string | undefined): string | null {
  if (!html) return null
  const text = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h\d)>/gi, '\n')
    .replace(/<li>/gi, '• ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return text || null
}

/**
 * Ответ `appdetails` → каноническая игра. Вынесено отдельно ради тестов на фикстурах.
 *
 * `localized` — тот же ответ на языке интерфейса (при русском). Из него берутся только
 * тексты: название, краткое описание и подробности. Жанры, категории и дата читаются
 * из английского ответа, иначе ломается сопоставление со справочниками (см. locale.ts).
 */
export function toCanonical(appId: string, details: AppDetails, localized?: AppDetails): CanonicalGame {
  const rawJson = JSON.stringify(localized ? { details, localized } : details)
  const genreNames = (details.genres ?? []).map((g) => g.description ?? '').filter(Boolean)
  const { date, precision } = parseSteamDate(details.release_date?.date)
  const requiredAge = Number(details.required_age ?? 0)

  const platformKeys = Object.entries(details.platforms ?? {})
    .filter(([, enabled]) => enabled)
    .map(([key]) => key)

  // Витрина переводит и название: «Ведьмак 3: Дикая Охота» вместо «The Witcher 3».
  // Локализованное становится основным, оригинальное — альтернативным.
  const original = unquote(details.name)
  const translated = localized ? unquote(localized.name) : null
  const title = translated ?? original
  const altTitles = translated && original && translated !== original ? [original] : []
  const text = localized ?? details

  return {
    provider: 'steam',
    externalId: appId,
    url: `https://store.steampowered.com/app/${appId}`,
    rawHash: crypto.createHash('sha256').update(rawJson).digest('hex'),
    rawJson,
    fetchedAt: new Date().toISOString(),

    title,
    altTitles,
    category: mapCategory(details.type),
    releaseDate: date,
    releaseDatePrecision: precision,
    releaseStatus: mapReleaseStatus(details, genreNames),
    // Короткое описание идёт в «Аннотацию», длинное — в «Сюжет/подробности».
    // Через stripHtml обязательно: в коротком описании тоже встречаются HTML-сущности
    // (`The &quot;Perpetual Testing Initiative&quot;` у Portal 2).
    summary: stripHtml(text.short_description) ?? stripHtml(details.short_description),
    storyline:
      stripHtml(text.about_the_game ?? text.detailed_description) ??
      stripHtml(details.about_the_game ?? details.detailed_description),
    ageRating: requiredAge > 0 ? `${requiredAge}+` : null,
    website: details.website?.trim() || null,

    metacriticScore: typeof details.metacritic?.score === 'number' ? details.metacritic.score : null,
    // У ссылки Metacritic из Steam есть партнёрский хвост `?ftag=…` — он нам не нужен.
    metacriticUrl: details.metacritic?.url ? details.metacritic.url.split('?')[0] ?? null : null,
    hltbMainMin: null,
    hltbExtraMin: null,
    hltbCompleteMin: null,
    hltbCount: null,

    developers: uniqueRefs((details.developers ?? []).map((name) => asRef(name))),
    publishers: uniqueRefs((details.publishers ?? []).map((name) => asRef(name))),
    // «Early Access» у Steam лежит в жанрах, но это статус релиза, а не жанр.
    genres: uniqueRefs(
      genreNames.filter((name) => name.toLowerCase() !== 'early access').map((name) => mapGenre(name))
    ),
    modes: uniqueRefs((details.categories ?? []).map((c) => mapMode(c.description ?? ''))),
    platforms: uniqueRefs(platformKeys.map((key) => mapPlatform(key))),
    tags: [],
    series: null,

    images: {
      cover: `${CDN}/${appId}/library_600x900_2x.jpg`,
      backdrop: `${CDN}/${appId}/library_hero.jpg`,
      logo: `${CDN}/${appId}/logo.png`
    },
    crossIds: { steam: appId }
  }
}

/* ------------------------------------------------------------------- запросы */

export async function search(query: string, limit: number): Promise<ProviderHit[]> {
  const direct = parseSteamRef(query)
  if (direct) {
    // Вставили ссылку или appid — показываем ровно одну карточку вместо поиска по названию.
    const game = await fetchGame(direct)
    return [
      {
        provider: 'steam',
        externalId: direct,
        title: game.title ?? `App ${direct}`,
        year: game.releaseDate ? Number(game.releaseDate.slice(0, 4)) : null,
        thumbUrl: `${CDN}/${direct}/header.jpg`,
        developer: game.developers[0]?.name ?? null,
        platforms: game.platforms.map((p) => p.name),
        kind: !game.category || game.category === 'main' ? null : game.category,
        url: game.url ?? null
      }
    ]
  }

  // Поиск — на языке интерфейса: так в списке видно русские названия изданий.
  const language = steamLanguage(uiLanguage())
  const url = `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(query)}&l=${language}&cc=us`
  const data = await cached(`steam:search:${language}:${query.toLowerCase()}`, async () => {
    await acquire('steam')
    return httpJson<StoreSearchResponse>(url, { label: LABEL })
  })

  return (data.items ?? []).slice(0, limit).map((item) => ({
    provider: 'steam' as const,
    externalId: String(item.id),
    title: unquote(item.name) ?? item.name,
    year: null,
    thumbUrl: item.tiny_image ?? null,
    developer: null,
    platforms: Object.entries(item.platforms ?? {})
      .filter(([, enabled]) => enabled)
      .map(([key]) => mapPlatform(key).name),
    kind: item.type && item.type !== 'app' ? item.type : null,
    url: `https://store.steampowered.com/app/${item.id}`
  }))
}

/** Один запрос `appdetails` на конкретном языке, с кешем и учётом лимита. */
async function appDetails(appId: string, language: string): Promise<AppDetails> {
  const url = `https://store.steampowered.com/api/appdetails?appids=${appId}&cc=us&l=${language}`
  return cached(`steam:app:${appId}:${language}`, async () => {
    await acquire('steam')
    const body = await httpJson<AppDetailsResponse>(url, { label: LABEL })
    const entry = body[appId]
    if (!entry?.success || !entry.data) {
      // Steam отвечает `success: false` для удалённых из продажи и региональных ограничений.
      throw new AppError('not_found', `Steam не отдал данные по приложению ${appId}: игра удалена из магазина или недоступна в этом регионе`)
    }
    return entry.data
  })
}

export async function fetchGame(externalId: string): Promise<CanonicalGame> {
  const appId = parseSteamRef(externalId) ?? externalId
  // Английский ответ — основа: по нему сопоставляются жанры, режимы и разбирается дата.
  const details = await appDetails(appId, 'english')

  const language = steamLanguage(uiLanguage())
  if (language === 'english') return toCanonical(appId, details)

  // Второй запрос — только за текстами на языке интерфейса. Если перевода нет
  // или запрос не прошёл, остаёмся на английском варианте.
  try {
    return toCanonical(appId, details, await appDetails(appId, language))
  } catch (err) {
    log.warn(`[providers] Steam не отдал данные на языке «${language}», берём английские`, err)
    return toCanonical(appId, details)
  }
}
