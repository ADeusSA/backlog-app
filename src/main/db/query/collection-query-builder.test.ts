import { beforeEach, describe, expect, it } from 'vitest'
import {
  createTestDb,
  fixtureId,
  insertCompany,
  insertGame,
  insertList,
  insertListItem,
  insertSeries,
  insertUserGame,
  SEED,
  type TestDb
} from '../test-helpers'
import { buildCollectionQuery } from './collection-query-builder'
import { buildFacetQuery } from './facets-query-builder'
import type { CollectionQuery, Filters } from '@shared/schema/filters'

let db: TestDb

const CDPR = fixtureId('cdpr')
const FROM_SOFT = fixtureId('fromsoft')
const DARK_SOULS_SERIES = fixtureId('darksouls-series')

const G_WITCHER = fixtureId('witcher')
const G_CYBERPUNK = fixtureId('cyberpunk')
const G_HOLLOW = fixtureId('hollowknight')
const G_ELDEN = fixtureId('eldenring')
const G_DARKSOULS = fixtureId('darksouls')

function setupFixtures(conn: TestDb): void {
  insertCompany(conn, { id: CDPR, name: 'CD Projekt Red', isDeveloper: true, isPublisher: true, countryCode: 'PL' })
  insertCompany(conn, { id: FROM_SOFT, name: 'FromSoftware', isDeveloper: true, isPublisher: false, countryCode: 'JP' })
  insertSeries(conn, { id: DARK_SOULS_SERIES, name: 'Dark Souls' })

  insertGame(conn, {
    id: G_WITCHER,
    title: 'The Witcher 3: Wild Hunt',
    sortTitle: 'Witcher 3: Wild Hunt, The',
    releaseDate: '2015-05-19',
    metacriticScore: 92,
    hltbMainMin: 3000,
    genreIds: [SEED.genre.rpg, SEED.genre.actionRpg],
    primaryGenreId: SEED.genre.rpg,
    platformIds: [SEED.platform.pc, SEED.platform.ps5],
    developerIds: [CDPR],
    publisherIds: [CDPR]
  })
  insertUserGame(conn, {
    gameId: G_WITCHER,
    status: 'completed',
    rating: 10,
    playtimeMinutes: 6000,
    isFavorite: true,
    isMastered: true,
    addedAt: '2026-01-05T00:00:00.000Z',
    finishedAt: '2026-02-01',
    platformId: SEED.platform.pc,
    ownership: 'digital'
  })

  insertGame(conn, {
    id: G_CYBERPUNK,
    title: 'Cyberpunk 2077',
    releaseDate: '2020-12-10',
    metacriticScore: 86,
    hltbMainMin: 1500,
    genreIds: [SEED.genre.actionRpg],
    primaryGenreId: SEED.genre.actionRpg,
    platformIds: [SEED.platform.pc],
    developerIds: [CDPR],
    publisherIds: [CDPR]
  })
  insertUserGame(conn, {
    gameId: G_CYBERPUNK,
    status: 'playing',
    playtimeMinutes: 1200,
    addedAt: '2026-02-01T00:00:00.000Z',
    ownership: 'digital'
  })

  insertGame(conn, {
    id: G_HOLLOW,
    title: 'Hollow Knight',
    releaseDate: '2017-02-24',
    metacriticScore: 90,
    hltbMainMin: 1800,
    genreIds: [SEED.genre.indie, SEED.genre.adventure],
    primaryGenreId: SEED.genre.indie,
    platformIds: [SEED.platform.pc, SEED.platform.switch]
  })
  insertUserGame(conn, { gameId: G_HOLLOW, status: 'backlog', priority: 2, addedAt: '2026-01-10T00:00:00.000Z', ownership: 'digital' })

  insertGame(conn, {
    id: G_ELDEN,
    title: 'Elden Ring',
    releaseDate: '2022-02-25',
    metacriticScore: 96,
    genreIds: [SEED.genre.actionRpg],
    primaryGenreId: SEED.genre.actionRpg,
    platformIds: [SEED.platform.pc, SEED.platform.ps5],
    developerIds: [FROM_SOFT],
    seriesId: undefined
  })
  insertUserGame(conn, { gameId: G_ELDEN, status: 'wishlist', addedAt: '2026-01-15T00:00:00.000Z' })

  // Dark Souls: в каталоге, НЕ в библиотеке (нет user_game) — проверка LEFT JOIN.
  insertGame(conn, {
    id: G_DARKSOULS,
    title: 'Dark Souls',
    releaseDate: '2011-09-22',
    metacriticScore: 89,
    developerIds: [FROM_SOFT],
    seriesId: DARK_SOULS_SERIES,
    seriesPosition: 1
  })
}

beforeEach(() => {
  db = createTestDb()
  setupFixtures(db)
})

function runQuery(query: CollectionQuery): Array<Record<string, unknown>> {
  const built = buildCollectionQuery(query)
  return db.prepare(built.sql).all(...built.params) as Array<Record<string, unknown>>
}

const emptyFilters: Filters = {}

describe('buildCollectionQuery — scope: library', () => {
  it('возвращает только игры, у которых есть user_game (в библиотеке)', () => {
    const rows = runQuery({ scope: { kind: 'library' }, filters: emptyFilters, sort: { field: 'added_at', dir: 'desc' } })
    const ids = rows.map((r) => r.id)
    expect(ids).toContain(G_WITCHER)
    expect(ids).toContain(G_CYBERPUNK)
    expect(ids).not.toContain(G_DARKSOULS) // не в библиотеке
    expect(rows).toHaveLength(4)
  })

  it('сортирует по added_at DESC вторично по sort_title', () => {
    // addedAt: Witcher 01-05, Hollow 01-10, Elden 01-15, Cyberpunk 02-01 → DESC.
    const rows = runQuery({ scope: { kind: 'library' }, filters: emptyFilters, sort: { field: 'added_at', dir: 'desc' } })
    expect(rows.map((r) => r.id)).toEqual([G_CYBERPUNK, G_ELDEN, G_HOLLOW, G_WITCHER])
  })

  it('фильтр по статусу сужает выборку', () => {
    const rows = runQuery({
      scope: { kind: 'library' },
      filters: { status: ['completed'] },
      sort: { field: 'title', dir: 'asc' }
    })
    expect(rows.map((r) => r.id)).toEqual([G_WITCHER])
  })

  it('фильтр по жанрам: mode=any находит игры хотя бы с одним жанром', () => {
    // У Witcher тоже проставлен actionRpg (вторым жанром) — он должен попасть в выборку.
    const rows = runQuery({
      scope: { kind: 'library' },
      filters: { genres: { ids: [SEED.genre.actionRpg], mode: 'any' } },
      sort: { field: 'title', dir: 'asc' }
    })
    expect(rows.map((r) => r.id).sort()).toEqual([G_CYBERPUNK, G_ELDEN, G_WITCHER].sort())
  })

  it('фильтр по жанрам: mode=all требует оба жанра одновременно', () => {
    const rows = runQuery({
      scope: { kind: 'library' },
      filters: { genres: { ids: [SEED.genre.rpg, SEED.genre.actionRpg], mode: 'all' } },
      sort: { field: 'title', dir: 'asc' }
    })
    expect(rows.map((r) => r.id)).toEqual([G_WITCHER])
  })

  it('диапазон года с includeNull', () => {
    const rows = runQuery({
      scope: { kind: 'library' },
      filters: { year: { min: 2020, max: 2030, includeNull: false } },
      sort: { field: 'title', dir: 'asc' }
    })
    expect(rows.map((r) => r.id).sort()).toEqual([G_CYBERPUNK, G_ELDEN].sort())
  })

  it('NULL значения metacritic всегда в конце независимо от направления', () => {
    // У всех библиотечных игр metacritic задан — проверим на выборке, включающей игру без него,
    // временно добавив её в библиотеку.
    insertUserGame(db, { gameId: G_DARKSOULS, status: 'backlog', addedAt: '2026-03-01T00:00:00.000Z' })
    db.prepare('UPDATE games SET metacritic_score = NULL WHERE id = ?').run(G_DARKSOULS)
    const asc = runQuery({ scope: { kind: 'library' }, filters: emptyFilters, sort: { field: 'metacritic_score', dir: 'asc' } })
    const desc = runQuery({ scope: { kind: 'library' }, filters: emptyFilters, sort: { field: 'metacritic_score', dir: 'desc' } })
    expect(asc[asc.length - 1]?.id).toBe(G_DARKSOULS)
    expect(desc[desc.length - 1]?.id).toBe(G_DARKSOULS)
  })

  it('флаг favorite фильтрует избранное', () => {
    const rows = runQuery({ scope: { kind: 'library' }, filters: { flags: { favorite: true } }, sort: { field: 'title', dir: 'asc' } })
    expect(rows.map((r) => r.id)).toEqual([G_WITCHER])
  })

  it('developer + countries фильтруют по стране студии-разработчика', () => {
    const rows = runQuery({ scope: { kind: 'library' }, filters: { countries: ['JP'] }, sort: { field: 'title', dir: 'asc' } })
    expect(rows.map((r) => r.id)).toEqual([G_ELDEN])
  })

  it('random с одинаковым seed даёт одинаковый порядок', () => {
    const a = runQuery({ scope: { kind: 'library' }, filters: emptyFilters, sort: { field: 'random', dir: 'asc', seed: 42 } })
    const b = runQuery({ scope: { kind: 'library' }, filters: emptyFilters, sort: { field: 'random', dir: 'asc', seed: 42 } })
    expect(a.map((r) => r.id)).toEqual(b.map((r) => r.id))
  })

  it('перебор seed даёт хотя бы одну перестановку порядка (не константа)', () => {
    const orders = [1, 2, 3, 5, 8, 13, 21, 34, 55, 89].map((seed) =>
      runQuery({ scope: { kind: 'library' }, filters: emptyFilters, sort: { field: 'random', dir: 'asc', seed } })
        .map((r) => r.id)
        .join(',')
    )
    expect(new Set(orders).size).toBeGreaterThan(1)
  })
})

describe('buildCollectionQuery — scope: catalog', () => {
  it('включает игры без user_game и считает completeness', () => {
    const rows = runQuery({ scope: { kind: 'catalog' }, filters: emptyFilters, sort: { field: 'title', dir: 'asc' } })
    expect(rows).toHaveLength(5)
    const darkSouls = rows.find((r) => r.id === G_DARKSOULS)
    expect(darkSouls?.status).toBeNull()
    expect(typeof darkSouls?.completeness).toBe('number')
  })
})

describe('buildCollectionQuery — scope: list', () => {
  it('порядок и заметка берутся из list_items, показывает игры вне библиотеки', () => {
    const listId = fixtureId('list-cozy')
    insertList(db, { id: listId, name: 'Избранное' })
    insertListItem(db, { listId, gameId: G_WITCHER, position: 2 })
    insertListItem(db, { listId, gameId: G_DARKSOULS, position: 1, note: 'начать с этого' })

    const rows = runQuery({ scope: { kind: 'list', listId }, filters: emptyFilters, sort: { field: 'position', dir: 'asc' } })
    expect(rows.map((r) => r.id)).toEqual([G_DARKSOULS, G_WITCHER])
    expect(rows[0]?.positionNote).toBe('начать с этого')
    expect(rows[0]?.status).toBeNull() // Dark Souls не в библиотеке
  })
})

describe('buildCollectionQuery — scope: series', () => {
  it('позиция и метка берутся из series_games', () => {
    const rows = runQuery({
      scope: { kind: 'series', seriesId: DARK_SOULS_SERIES },
      filters: emptyFilters,
      sort: { field: 'position', dir: 'asc' }
    })
    expect(rows.map((r) => r.id)).toEqual([G_DARKSOULS])
    expect(rows[0]?.position).toBe(1)
  })
})

describe('buildCollectionQuery — scope: company', () => {
  it('фильтрует по роли и не дублирует строки при нескольких ролях', () => {
    const rows = runQuery({
      scope: { kind: 'company', companyId: CDPR, roles: ['developer', 'publisher'] },
      filters: emptyFilters,
      sort: { field: 'title', dir: 'asc' }
    })
    // CDPR — и разработчик, и издатель обеих игр: без DISTINCT было бы 4 строки.
    expect(rows.map((r) => r.id).sort()).toEqual([G_CYBERPUNK, G_WITCHER].sort())
    expect(rows).toHaveLength(2)
  })

  it('роль publisher одна не находит FromSoftware-игры', () => {
    const rows = runQuery({
      scope: { kind: 'company', companyId: FROM_SOFT, roles: ['publisher'] },
      filters: emptyFilters,
      sort: { field: 'title', dir: 'asc' }
    })
    expect(rows).toHaveLength(0)
  })
})

describe('buildCollectionQuery — scope: search', () => {
  it('ищет по названию с учётом регистра LIKE', () => {
    const rows = runQuery({ scope: { kind: 'search', query: 'witcher' }, filters: emptyFilters, sort: { field: 'title', dir: 'asc' } })
    expect(rows.map((r) => r.id)).toEqual([G_WITCHER])
  })
})

describe('buildFacetQuery', () => {
  it('секция сама себя исключает: статус-фасет считает по всем статусам вне зависимости от фильтра статуса', () => {
    const filters: Filters = { status: ['completed'] }
    const built = buildFacetQuery('status', { kind: 'library' }, filters)
    const rows = db.prepare(built.sql).all(...built.params) as Array<{ key: string; count: number }>
    const byKey = Object.fromEntries(rows.map((r) => [r.key, r.count]))
    expect(byKey.completed).toBe(1)
    expect(byKey.playing).toBe(1)
    expect(byKey.backlog).toBe(1)
    expect(byKey.wishlist).toBe(1)
  })

  it('фасет по жанрам учитывает остальные активные фильтры (например, по статусу)', () => {
    const filters: Filters = { status: ['playing', 'wishlist'] }
    const built = buildFacetQuery('genres', { kind: 'library' }, filters)
    const rows = db.prepare(built.sql).all(...built.params) as Array<{ key: string; count: number }>
    const byKey = Object.fromEntries(rows.map((r) => [r.key, r.count]))
    // Только Cyberpunk (playing) и Elden Ring (wishlist) остаются под условием status,
    // обе — actionRpg, значит genre-фасет должен показать actionRpg=2 и не должен включать rpg (только Witcher).
    expect(byKey[SEED.genre.actionRpg]).toBe(2)
    expect(byKey[SEED.genre.rpg]).toBeUndefined()
  })

  it('фасет flags считает избранное/просмотр/приоритет независимыми счётчиками', () => {
    const built = buildFacetQuery('flags', { kind: 'library' }, {})
    const rows = db.prepare(built.sql).all(...built.params) as Array<{ key: string; count: number }>
    const byKey = Object.fromEntries(rows.map((r) => [r.key, r.count]))
    expect(byKey.favorite).toBe(1)
    expect(byKey.prioritized).toBe(1)
  })
})
