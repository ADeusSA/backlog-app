import { describe, expect, it } from 'vitest'
import { mapCategory, mapDate, mapReleaseStatus, parseIgdbRef, toCanonical } from '../../src/main/providers/igdb'

/**
 * Маппер IGDB на сокращённой фикстуре ответа `/v4/games` (структура — из
 * docs/research/03-external-apis.md §D) плюс отдельная запись `game_time_to_beats`,
 * из которой берётся время прохождения (08 §5).
 */
const ELDEN_RING = {
  id: 119133,
  name: 'Elden Ring',
  slug: 'elden-ring',
  summary: 'A new fantasy action RPG.',
  storyline: 'Rise, Tarnished.',
  first_release_date: 1645660800,
  checksum: 'b1e5b4a0-0000-0000-0000-000000000000',
  url: 'https://www.igdb.com/games/elden-ring',
  game_type: { type: 'Main Game' },
  game_status: { status: 'Released' },
  cover: { image_id: 'co4jni' },
  artworks: [{ image_id: 'ar8yz' }],
  alternative_names: [{ name: 'ER' }],
  genres: [{ name: 'Role-playing (RPG)', slug: 'role-playing-rpg' }],
  themes: [{ name: 'Fantasy', slug: 'fantasy' }],
  game_modes: [{ name: 'Single player', slug: 'single-player' }, { name: 'Co-operative', slug: 'co-operative' }],
  platforms: [{ abbreviation: 'PC', name: 'PC (Microsoft Windows)' }, { abbreviation: 'PS5', name: 'PlayStation 5' }],
  involved_companies: [
    { developer: true, publisher: false, company: { name: 'FromSoftware', slug: 'fromsoftware' } },
    { developer: false, publisher: true, company: { name: 'Bandai Namco Entertainment', slug: 'bandai-namco' } }
  ],
  collections: [{ name: 'Elden Ring', slug: 'elden-ring' }],
  age_ratings: [{ rating_category: { rating: 'Sixteen' }, organization: { name: 'PEGI' } }],
  websites: [{ url: 'https://eldenring.com', type: { type: 'official' } }],
  release_dates: [{ date: 1645660800, date_format: { format: 'YYYYMMMMDD' } }],
  external_games: [{ uid: '1245620', external_game_source: { name: 'Steam' } }]
}

/** Секунды, как их отдаёт IGDB: 32 ч / 55 ч / 132 ч. */
const TIME_TO_BEAT = { game_id: 119133, hastily: 115_200, normally: 198_000, completely: 475_200, count: 1420 }

describe('mapCategory', () => {
  it('переводит типы IGDB в наши категории', () => {
    expect(mapCategory('Main Game')).toBe('main')
    expect(mapCategory('DLC')).toBe('dlc')
    expect(mapCategory('Standalone expansion')).toBe('standalone_expansion')
    expect(mapCategory('Expanded Game')).toBe('expansion')
    expect(mapCategory(undefined)).toBe('main')
  })
})

describe('mapReleaseStatus', () => {
  it('альфу и бету считает ранним доступом, отменённое — отменённым', () => {
    expect(mapReleaseStatus('Released')).toBe('released')
    expect(mapReleaseStatus('Alpha')).toBe('early_access')
    expect(mapReleaseStatus('Early Access')).toBe('early_access')
    expect(mapReleaseStatus('Cancelled')).toBe('cancelled')
    expect(mapReleaseStatus('Rumored')).toBe('announced')
  })
})

describe('mapDate', () => {
  it('учитывает точность из date_format', () => {
    expect(mapDate(1645660800, 'YYYYMMMMDD')).toEqual({ date: '2022-02-24', precision: 'day' })
    expect(mapDate(1645660800, 'YYYYMMMM')).toEqual({ date: '2022-02', precision: 'month' })
    expect(mapDate(1645660800, 'YYYY')).toEqual({ date: '2022', precision: 'year' })
    expect(mapDate(1645660800, 'YYYYQ1')).toEqual({ date: '2022', precision: 'quarter' })
    expect(mapDate(undefined, 'YYYY')).toEqual({ date: null, precision: 'tba' })
  })
})

describe('parseIgdbRef', () => {
  it('достаёт slug из ссылки igdb.com', () => {
    expect(parseIgdbRef('https://www.igdb.com/games/elden-ring')).toBe('elden-ring')
    expect(parseIgdbRef('Elden Ring')).toBeNull()
  })
})

describe('igdb.toCanonical', () => {
  const game = toCanonical(ELDEN_RING, TIME_TO_BEAT)

  it('переносит основные поля и checksum как хеш ответа', () => {
    expect(game.title).toBe('Elden Ring')
    expect(game.altTitles).toEqual(['ER'])
    expect(game.releaseDate).toBe('2022-02-24')
    expect(game.ageRating).toBe('PEGI Sixteen')
    expect(game.website).toBe('https://eldenring.com')
    expect(game.rawHash).toBe(ELDEN_RING.checksum)
  })

  it('переводит секунды game_time_to_beats в минуты', () => {
    expect(game.hltbMainMin).toBe(1920)
    expect(game.hltbExtraMin).toBe(3300)
    expect(game.hltbCompleteMin).toBe(7920)
    expect(game.hltbCount).toBe(1420)
  })

  it('без записи о времени поля остаются пустыми', () => {
    const noTime = toCanonical(ELDEN_RING, null)
    expect(noTime.hltbMainMin).toBeNull()
    expect(noTime.hltbCount).toBeNull()
  })

  it('сопоставляет жанры, режимы и платформы с каталогом', () => {
    expect(game.genres.map((g) => g.slug)).toEqual(['rpg'])
    expect(game.modes.map((m) => m.slug)).toEqual(['single-player', 'co-op'])
    expect(game.platforms.map((p) => p.name)).toEqual(['PC (Windows)', 'PlayStation 5'])
  })

  it('темы становятся тегами, collection — серией', () => {
    expect(game.tags.map((t) => t.name)).toEqual(['Fantasy'])
    expect(game.series?.name).toBe('Elden Ring')
  })

  it('запоминает Steam appid для перекрёстного дозапроса Metacritic', () => {
    expect(game.crossIds.steam).toBe('1245620')
    expect(game.crossIds.igdb).toBe('119133')
  })

  it('оценку Metacritic сам не даёт — она приходит из Steam', () => {
    expect(game.metacriticScore).toBeNull()
  })
})
