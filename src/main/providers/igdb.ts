/**
 * IGDB как источник данных (08 §2, §5) — основной провайдер каталога.
 *
 * Здесь же берётся **время прохождения**: эндпоинт `game_time_to_beats` отдаёт
 * hastily / normally / completely в секундах — ровно те три величины, что показывает
 * HowLongToBeat (main / main+extra / completionist). Скрапить сам HLTB нельзя: своего
 * API у него нет, а неофициальные обёртки ломаются и юридически небезопасны (08 §2).
 *
 * Доступ: приложение Twitch (client_id + client_secret) → app access token по
 * client_credentials. Ключи вводит пользователь, они лежат зашифрованными в credentials.ts.
 */
import crypto from 'node:crypto'
import { AppError } from '@shared/errors'
import type { CanonicalGame, ProviderHit } from '@shared/schema/providers'
import type { GameCategory, ReleaseDatePrecision, ReleaseStatus } from '@shared/constants'
import { cached } from './cache'
import { httpJson } from './http'
import { acquire } from './rate-limit'
import { getCredentials } from './credentials'
import { asRef, mapGenre, mapMode, mapPlatform, uniqueRefs } from './taxonomy-map'

const LABEL = 'IGDB'
const API = 'https://api.igdb.com/v4'
const IMAGES = 'https://images.igdb.com/igdb/image/upload'

/* --------------------------------------------------------------------- токен */

interface TokenResponse {
  access_token: string
  expires_in: number
}

let token: { value: string; expiresAt: number } | null = null

export function resetToken(): void {
  token = null
}

async function accessToken(): Promise<string> {
  const now = Date.now()
  if (token && token.expiresAt - 60_000 > now) return token.value

  const creds = getCredentials('igdb')
  // Client Secret обязателен именно у IGDB: токен выдаётся по client_credentials.
  if (!creds?.clientSecret) {
    throw new AppError('sync_auth', 'Не заданы ключи IGDB — укажите Client ID и Client Secret в «Настройки → Источники данных»')
  }
  const url =
    'https://id.twitch.tv/oauth2/token' +
    `?client_id=${encodeURIComponent(creds.clientId)}` +
    `&client_secret=${encodeURIComponent(creds.clientSecret)}` +
    '&grant_type=client_credentials'

  const body = await httpJson<TokenResponse>(url, { method: 'POST', label: 'Twitch' })
  if (!body.access_token) throw new AppError('sync_auth', 'Twitch не вернул токен — проверьте Client ID и Secret')
  token = { value: body.access_token, expiresAt: now + body.expires_in * 1000 }
  return token.value
}

/** Запрос к IGDB на языке Apicalypse. */
async function query<T>(endpoint: string, apicalypse: string): Promise<T[]> {
  const creds = getCredentials('igdb')
  if (!creds) {
    throw new AppError('sync_auth', 'Не заданы ключи IGDB — укажите их в «Настройки → Источники данных»')
  }
  const bearer = await accessToken()
  await acquire('igdb')
  return httpJson<T[]>(`${API}/${endpoint}`, {
    method: 'POST',
    label: LABEL,
    headers: { 'Client-ID': creds.clientId, Authorization: `Bearer ${bearer}`, 'Content-Type': 'text/plain' },
    body: apicalypse
  })
}

/* ------------------------------------------------------------------ ответы API */

interface IgdbCompany {
  developer?: boolean
  publisher?: boolean
  porting?: boolean
  supporting?: boolean
  company?: { name?: string; slug?: string }
}

interface IgdbGame {
  id: number
  name?: string
  slug?: string
  summary?: string
  storyline?: string
  first_release_date?: number
  checksum?: string
  url?: string
  rating?: number
  aggregated_rating?: number
  game_type?: { type?: string }
  game_status?: { status?: string }
  cover?: { image_id?: string }
  artworks?: Array<{ image_id?: string }>
  screenshots?: Array<{ image_id?: string }>
  alternative_names?: Array<{ name?: string }>
  genres?: Array<{ name?: string; slug?: string }>
  themes?: Array<{ name?: string; slug?: string }>
  game_modes?: Array<{ name?: string; slug?: string }>
  platforms?: Array<{ abbreviation?: string; name?: string }>
  involved_companies?: IgdbCompany[]
  collections?: Array<{ name?: string; slug?: string }>
  franchises?: Array<{ name?: string; slug?: string }>
  age_ratings?: Array<{ rating_category?: { rating?: string }; organization?: { name?: string } }>
  websites?: Array<{ url?: string; type?: { type?: string } }>
  release_dates?: Array<{ date?: number; date_format?: { format?: string } }>
  external_games?: Array<{ uid?: string; external_game_source?: { name?: string } }>
}

interface IgdbTimeToBeat {
  game_id?: number
  hastily?: number
  normally?: number
  completely?: number
  count?: number
}

const GAME_FIELDS = [
  'name', 'slug', 'summary', 'storyline', 'first_release_date', 'checksum', 'url',
  'rating', 'aggregated_rating',
  'game_type.type', 'game_status.status',
  'cover.image_id', 'artworks.image_id', 'screenshots.image_id',
  'alternative_names.name',
  'genres.name', 'genres.slug', 'themes.name', 'themes.slug',
  'game_modes.name', 'game_modes.slug',
  'platforms.abbreviation', 'platforms.name',
  'involved_companies.developer', 'involved_companies.publisher',
  'involved_companies.porting', 'involved_companies.supporting',
  'involved_companies.company.name', 'involved_companies.company.slug',
  'collections.name', 'collections.slug', 'franchises.name', 'franchises.slug',
  'age_ratings.rating_category.rating', 'age_ratings.organization.name',
  'websites.url', 'websites.type.type',
  'release_dates.date', 'release_dates.date_format.format',
  'external_games.uid', 'external_games.external_game_source.name'
].join(',')

/* ------------------------------------------------------------------- маппинг */

/** `game_type.type` → наша категория (08 §5). */
export function mapCategory(type: string | undefined): GameCategory {
  switch ((type ?? '').toLowerCase()) {
    case 'dlc':
    case 'pack':
      return 'dlc'
    case 'expansion':
    case 'expanded game':
      return 'expansion'
    case 'standalone expansion':
      return 'standalone_expansion'
    case 'remake':
      return 'remake'
    case 'remaster':
      return 'remaster'
    case 'port':
      return 'port'
    case 'bundle':
      return 'bundle'
    case 'mod':
      return 'mod'
    case 'episode':
      return 'episode'
    case 'season':
      return 'season'
    default:
      return 'main'
  }
}

/** `game_status.status` → наш статус релиза. */
export function mapReleaseStatus(status: string | undefined): ReleaseStatus {
  switch ((status ?? '').toLowerCase()) {
    case 'alpha':
    case 'beta':
    case 'early access':
      return 'early_access'
    case 'offline':
    case 'cancelled':
      return 'cancelled'
    case 'rumored':
      return 'announced'
    default:
      return 'released'
  }
}

/**
 * Точность даты: IGDB отдаёт unix-время первого релиза и отдельно формат
 * (`YYYYMMMMDD` / `YYYYMMMM` / `YYYY` / `TBD`…). Без формата считаем, что дата полная.
 */
export function mapDate(
  unixSeconds: number | undefined,
  format: string | undefined
): { date: string | null; precision: ReleaseDatePrecision } {
  if (!unixSeconds) return { date: null, precision: 'tba' }
  const iso = new Date(unixSeconds * 1000).toISOString().slice(0, 10)
  switch ((format ?? '').toUpperCase()) {
    case 'YYYYMMMM':
      return { date: iso.slice(0, 7), precision: 'month' }
    case 'YYYYQ1':
    case 'YYYYQ2':
    case 'YYYYQ3':
    case 'YYYYQ4':
      return { date: iso.slice(0, 4), precision: 'quarter' }
    case 'YYYY':
      return { date: iso.slice(0, 4), precision: 'year' }
    case 'TBD':
      return { date: null, precision: 'tba' }
    default:
      return { date: iso, precision: 'day' }
  }
}

function imageUrl(imageId: string | undefined, size: string): string | null {
  return imageId ? `${IMAGES}/${size}/${imageId}.jpg` : null
}

/** Возрастной рейтинг: берём первое человекочитаемое значение (PEGI/ESRB). */
function ageRating(game: IgdbGame): string | null {
  for (const entry of game.age_ratings ?? []) {
    const rating = entry.rating_category?.rating
    if (!rating) continue
    const org = entry.organization?.name
    return org ? `${org} ${rating}` : rating
  }
  return null
}

/** Секунды → минуты; 0 и отсутствие одинаково означают «нет данных». */
function minutes(seconds: number | undefined): number | null {
  return seconds && seconds > 0 ? Math.round(seconds / 60) : null
}

export function toCanonical(game: IgdbGame, ttb: IgdbTimeToBeat | null): CanonicalGame {
  const rawJson = JSON.stringify({ game, ttb })
  const { date, precision } = mapDate(
    game.first_release_date,
    game.release_dates?.[0]?.date_format?.format
  )
  const steamId = (game.external_games ?? []).find(
    (e) => (e.external_game_source?.name ?? '').toLowerCase() === 'steam'
  )?.uid

  const companies = game.involved_companies ?? []
  const official = (game.websites ?? []).find((w) => (w.type?.type ?? '').toLowerCase() === 'official')

  return {
    provider: 'igdb',
    externalId: String(game.id),
    url: game.url ?? `https://www.igdb.com/games/${game.slug ?? game.id}`,
    // `checksum` меняется при любом изменении записи — по нему видно, есть ли новые данные.
    rawHash: game.checksum ?? crypto.createHash('sha256').update(rawJson).digest('hex'),
    rawJson,
    fetchedAt: new Date().toISOString(),

    title: game.name ?? null,
    altTitles: (game.alternative_names ?? []).map((a) => a.name ?? '').filter(Boolean),
    category: mapCategory(game.game_type?.type),
    releaseDate: date,
    releaseDatePrecision: precision,
    releaseStatus: mapReleaseStatus(game.game_status?.status),
    summary: game.summary?.trim() || null,
    storyline: game.storyline?.trim() || null,
    ageRating: ageRating(game),
    website: official?.url ?? null,

    // Оценки критиков IGDB не выдаёт как Metacritic — их приносит Steam.
    metacriticScore: null,
    metacriticUrl: null,
    hltbMainMin: minutes(ttb?.hastily),
    hltbExtraMin: minutes(ttb?.normally),
    hltbCompleteMin: minutes(ttb?.completely),
    hltbCount: ttb?.count ?? null,

    developers: uniqueRefs(
      companies.filter((c) => c.developer || c.porting).map((c) => (c.company?.name ? asRef(c.company.name) : null))
    ),
    publishers: uniqueRefs(
      companies.filter((c) => c.publisher).map((c) => (c.company?.name ? asRef(c.company.name) : null))
    ),
    genres: uniqueRefs((game.genres ?? []).map((g) => (g.name ? mapGenre(g.slug ?? g.name) : null))),
    modes: uniqueRefs((game.game_modes ?? []).map((m) => (m.name ? mapMode(m.slug ?? m.name) : null))),
    platforms: uniqueRefs(
      (game.platforms ?? []).map((p) =>
        p.abbreviation || p.name ? mapPlatform(p.abbreviation ?? p.name ?? '', p.name ?? p.abbreviation ?? '') : null
      )
    ),
    // Темы IGDB («Horror», «Stealth») в нашем каталоге — теги.
    tags: uniqueRefs((game.themes ?? []).map((t) => (t.name ? asRef(t.name) : null))),
    series: (() => {
      const source = game.collections?.[0] ?? game.franchises?.[0]
      return source?.name ? asRef(source.name) : null
    })(),

    images: {
      cover: imageUrl(game.cover?.image_id, 't_cover_big_2x'),
      backdrop:
        imageUrl(game.artworks?.[0]?.image_id, 't_1080p') ??
        imageUrl(game.screenshots?.[0]?.image_id, 't_1080p'),
      logo: null
    },
    crossIds: { igdb: String(game.id), ...(steamId ? { steam: steamId } : {}) }
  }
}

/* ------------------------------------------------------------------- запросы */

/** Ссылка `igdb.com/games/<slug>` → slug; иначе `null`. */
export function parseIgdbRef(input: string): string | null {
  const match = /igdb\.com\/games\/([a-z0-9-]+)/i.exec(input.trim())
  return match?.[1] ?? null
}

export async function search(term: string, limit: number): Promise<ProviderHit[]> {
  const slug = parseIgdbRef(term)
  // `version_parent = null` отсекает региональные издания-дубликаты (08 research §D).
  const where = slug ? `where slug = "${slug}";` : 'where version_parent = null;'
  const head = slug ? '' : `search "${term.replace(/"/g, '')}";`
  const body = `${head}fields ${GAME_FIELDS};${where}limit ${limit};`

  const games = await cached(`igdb:search:${term.toLowerCase()}:${limit}`, () =>
    query<IgdbGame>('games', body)
  )

  return games.map((game) => {
    const canonical = toCanonical(game, null)
    return {
      provider: 'igdb' as const,
      externalId: String(game.id),
      title: game.name ?? `#${game.id}`,
      year: canonical.releaseDate ? Number(canonical.releaseDate.slice(0, 4)) : null,
      thumbUrl: imageUrl(game.cover?.image_id, 't_cover_small'),
      developer: canonical.developers[0]?.name ?? null,
      platforms: canonical.platforms.map((p) => p.name),
      kind: !canonical.category || canonical.category === 'main' ? null : canonical.category,
      url: canonical.url ?? null
    }
  })
}

/** Время прохождения: отдельный эндпоинт, ключ — id игры. */
async function timeToBeat(gameId: string): Promise<IgdbTimeToBeat | null> {
  try {
    const rows = await query<IgdbTimeToBeat>(
      'game_time_to_beats',
      `fields game_id,hastily,normally,completely,count;where game_id = ${Number(gameId)};limit 1;`
    )
    return rows[0] ?? null
  } catch {
    // Времени может просто не быть — это не повод проваливать весь импорт.
    return null
  }
}

export async function fetchGame(externalId: string): Promise<CanonicalGame> {
  const id = Number(externalId)
  if (!Number.isFinite(id)) throw new AppError('validation', `Некорректный id IGDB: ${externalId}`)

  const game = await cached(`igdb:game:${id}`, async () => {
    const rows = await query<IgdbGame>('games', `fields ${GAME_FIELDS};where id = ${id};limit 1;`)
    const row = rows[0]
    if (!row) throw new AppError('not_found', `IGDB не нашёл игру с id ${id}`)
    return row
  })

  const ttb = await cached(`igdb:ttb:${id}`, () => timeToBeat(String(id)))
  return toCanonical(game, ttb)
}

/** Проверка ключей из настроек: один дешёвый запрос. */
export async function test(): Promise<{ ok: boolean; message: string }> {
  resetToken()
  try {
    await query<{ id: number }>('games', 'fields id;limit 1;')
    return { ok: true, message: 'IGDB отвечает, ключи приняты' }
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : String(err) }
  }
}
