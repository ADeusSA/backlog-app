/**
 * Реестр внешних источников (08 §4). Единственная точка, через которую IPC ходит
 * к провайдерам: тут же разрешается «кто что умеет» и делается взаимное дополнение
 * двух источников.
 */
import { IMPORT_PROVIDERS, type ImportProvider } from '@shared/constants'
import type { CanonicalGame, ProviderHit, ProviderStatus } from '@shared/schema/providers'
import { AppError } from '@shared/errors'
import { log } from '../log'
import * as steam from './steam'
import * as igdb from './igdb'
import * as rawg from './rawg'
import { getCredentials, isEncryptionAvailable } from './credentials'

interface Provider {
  needsCredentials: boolean
  search(query: string, limit: number): Promise<ProviderHit[]>
  fetchGame(externalId: string): Promise<CanonicalGame>
  test?(): Promise<{ ok: boolean; message: string }>
}

const REGISTRY: Record<ImportProvider, Provider> = {
  steam: { needsCredentials: false, search: steam.search, fetchGame: steam.fetchGame },
  rawg: { needsCredentials: true, search: rawg.search, fetchGame: rawg.fetchGame, test: rawg.test },
  igdb: { needsCredentials: true, search: igdb.search, fetchGame: igdb.fetchGame, test: igdb.test }
}

/** Настроен ли источник (для перекрёстного дополнения). */
function isReady(provider: ImportProvider): boolean {
  return statuses().find((status) => status.provider === provider)?.ready ?? false
}

export function statuses(): ProviderStatus[] {
  const encryption = isEncryptionAvailable()
  return IMPORT_PROVIDERS.map((provider) => {
    const spec = REGISTRY[provider]
    if (!spec.needsCredentials) {
      return { provider, needsCredentials: false, hasCredentials: false, ready: true, reason: 'ok' as const }
    }
    // У IGDB ключей два: с одним Client ID токен не получить.
    const creds = getCredentials(provider)
    const hasCredentials = Boolean(creds?.clientId) && (provider !== 'igdb' || Boolean(creds?.clientSecret))
    const reason = !encryption ? ('noEncryption' as const) : hasCredentials ? ('ok' as const) : ('noCredentials' as const)
    return { provider, needsCredentials: true, hasCredentials, ready: reason === 'ok', reason }
  })
}

function providerOf(id: ImportProvider): Provider {
  const spec = REGISTRY[id]
  if (!spec) throw new AppError('validation', `Неизвестный источник: ${id}`)
  return spec
}

export function search(provider: ImportProvider, query: string, limit: number): Promise<ProviderHit[]> {
  return providerOf(provider).search(query, limit)
}

/**
 * Карточка игры. Источники дополняют друг друга ровно там, где второй знает то,
 * чего первый не отдаёт (08 §2, таблица приоритетов):
 * - к записи IGDB добавляем оценку Metacritic из Steam (IGDB её не публикует);
 * - к записи Steam добавляем время прохождения из IGDB (Steam его не знает).
 * Дополнение — попытка: если второй источник недоступен или не настроен, карточка
 * просто приходит без этих полей.
 */
export async function fetchGame(provider: ImportProvider, externalId: string): Promise<CanonicalGame> {
  const base = await providerOf(provider).fetchGame(externalId)
  if (provider === 'igdb') return withSteamScore(base)
  if (provider === 'rawg') return base
  return withPlaytime(base)
}

async function withSteamScore(game: CanonicalGame): Promise<CanonicalGame> {
  const appId = game.crossIds.steam
  if (!appId || game.metacriticScore) return game
  try {
    const fromSteam = await steam.fetchGame(appId)
    return {
      ...game,
      metacriticScore: fromSteam.metacriticScore ?? null,
      metacriticUrl: fromSteam.metacriticUrl ?? null,
      // Hero-фон и логотип Steam качественнее артворков IGDB (research §B).
      images: {
        cover: game.images.cover ?? fromSteam.images.cover,
        backdrop: fromSteam.images.backdrop ?? game.images.backdrop,
        logo: fromSteam.images.logo ?? game.images.logo
      }
    }
  } catch (err) {
    log.warn('[providers] не удалось дополнить запись IGDB данными Steam', err)
    return game
  }
}

/**
 * Дополняет запись Steam временем прохождения. Steam его не знает, поэтому берём
 * у того источника, который настроен: сначала IGDB (три величины, как у HLTB),
 * иначе RAWG (одно усреднённое число часов). Ищем по названию — это эвристика,
 * поэтому оттуда берётся только время и серия, а тексты и картинки остаются Steam'овские.
 */
async function withPlaytime(game: CanonicalGame): Promise<CanonicalGame> {
  if (!game.title) return game
  const source = isReady('igdb') ? igdb : isReady('rawg') ? rawg : null
  if (!source) return game

  try {
    const best = (await source.search(game.title, 1))[0]
    if (!best) return game
    const extra = await source.fetchGame(best.externalId)
    if (!extra.hltbMainMin && !extra.hltbCompleteMin) return game
    return {
      ...game,
      hltbMainMin: extra.hltbMainMin ?? null,
      hltbExtraMin: extra.hltbExtraMin ?? null,
      hltbCompleteMin: extra.hltbCompleteMin ?? null,
      hltbCount: extra.hltbCount ?? null,
      series: game.series ?? extra.series ?? null,
      crossIds: { ...game.crossIds, ...extra.crossIds }
    }
  } catch (err) {
    log.warn('[providers] не удалось дополнить запись Steam временем прохождения', err)
    return game
  }
}

export async function test(provider: ImportProvider): Promise<{ ok: boolean; message: string }> {
  const spec = providerOf(provider)
  if (spec.test) return spec.test()
  try {
    await spec.search('portal', 1)
    return { ok: true, message: 'Источник отвечает' }
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : String(err) }
  }
}
