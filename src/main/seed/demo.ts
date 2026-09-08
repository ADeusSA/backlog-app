/**
 * Демо-данные для первого запуска и разработки (05 §8, 02 §6): 12 игр, 3 студии,
 * 2 серии, 2 списка, разные статусы/оценки/часы, без картинок. Не сидируется в
 * релизной базе — вызывается явно (`onboarding.complete` с `withDemoData`, `demo.seed`).
 */
import { write } from '../db/connection'
import type { Db } from '../db/connection'
import { newId, now } from '../db/utils'
import { makeSlug, makeSortTitle, yearFromDate } from '@shared/text'
import {
  insertGameRow,
  setGameCompanyLinks,
  setGameGenreLinks,
  setGamePlatformLinks,
  type GameWriteColumns
} from '../db/repositories/games.repo'
import { insertCompanyRow, type CompanyWriteColumns } from '../db/repositories/companies.repo'
import { addGamesToSeries, insertSeriesRow, type SeriesWriteColumns } from '../db/repositories/series.repo'
import { addGamesToList, insertListRow, nextListSortOrder, type ListWriteColumns } from '../db/repositories/lists.repo'
import { upsertSearchIndex } from '../services/search-index.service'
import type { GameStatus, Ownership } from '@shared/constants'

// Справочники сидируются миграцией 0002_seed.sql — переиспользуем их фиксированные id.
const PLATFORM = {
  pc: '01900000-0001-7000-8000-000000000001',
  ps5: '01900000-0001-7000-8000-000000000014',
  ps4: '01900000-0001-7000-8000-000000000013',
  switch: '01900000-0001-7000-8000-000000000036'
}
const GENRE = {
  action: '01900000-0002-7000-8000-000000000001',
  adventure: '01900000-0002-7000-8000-000000000002',
  actionRpg: '01900000-0002-7000-8000-000000000003',
  rpg: '01900000-0002-7000-8000-000000000004',
  platformer: '01900000-0002-7000-8000-000000000007',
  metroidvania: '01900000-0002-7000-8000-000000000021',
  indie: '01900000-0002-7000-8000-000000000030'
}

interface DemoGame {
  title: string
  releaseDate: string
  genreIds: string[]
  platformIds: string[]
  developerKey: 'fromsoft' | 'cdpr' | 'nintendo' | null
  publisherKey?: 'fromsoft' | 'cdpr' | 'nintendo' | null
  status: GameStatus
  rating?: number | null
  playtimeMinutes?: number
  isMastered?: boolean
  priority?: number
  ownership?: Ownership
  resumeNote?: string | null
  hltbMainMin?: number | null
}

const GAMES: DemoGame[] = [
  {
    title: 'Dark Souls',
    releaseDate: '2011-09-22',
    genreIds: [GENRE.actionRpg],
    platformIds: [PLATFORM.pc],
    developerKey: 'fromsoft',
    status: 'completed',
    rating: 9,
    playtimeMinutes: 4200,
    ownership: 'digital'
  },
  {
    title: 'Dark Souls III',
    releaseDate: '2016-04-12',
    genreIds: [GENRE.actionRpg],
    platformIds: [PLATFORM.pc],
    developerKey: 'fromsoft',
    status: 'completed',
    rating: 10,
    playtimeMinutes: 5100,
    isMastered: true,
    ownership: 'digital'
  },
  {
    title: 'Elden Ring',
    releaseDate: '2022-02-25',
    genreIds: [GENRE.actionRpg],
    platformIds: [PLATFORM.pc, PLATFORM.ps5],
    developerKey: 'fromsoft',
    status: 'playing',
    playtimeMinutes: 3300,
    priority: 3,
    ownership: 'digital',
    resumeNote: 'У Малении опять'
  },
  {
    title: 'Bloodborne',
    releaseDate: '2015-03-24',
    genreIds: [GENRE.actionRpg],
    platformIds: [PLATFORM.ps4],
    developerKey: 'fromsoft',
    status: 'backlog',
    priority: 2,
    ownership: 'digital'
  },
  {
    title: 'The Witcher 3: Wild Hunt',
    releaseDate: '2015-05-19',
    genreIds: [GENRE.rpg, GENRE.actionRpg],
    platformIds: [PLATFORM.pc],
    developerKey: 'cdpr',
    status: 'completed',
    rating: 10,
    playtimeMinutes: 12000,
    isMastered: true,
    ownership: 'digital'
  },
  {
    title: 'The Witcher 2: Assassins of Kings',
    releaseDate: '2011-05-17',
    genreIds: [GENRE.rpg, GENRE.actionRpg],
    platformIds: [PLATFORM.pc],
    developerKey: 'cdpr',
    status: 'played',
    rating: 8,
    playtimeMinutes: 1800,
    ownership: 'digital'
  },
  {
    title: 'The Witcher',
    releaseDate: '2007-10-26',
    genreIds: [GENRE.rpg],
    platformIds: [PLATFORM.pc],
    developerKey: 'cdpr',
    status: 'shelved',
    rating: 7,
    playtimeMinutes: 400,
    ownership: 'digital'
  },
  {
    title: 'Cyberpunk 2077',
    releaseDate: '2020-12-10',
    genreIds: [GENRE.actionRpg],
    platformIds: [PLATFORM.pc],
    developerKey: 'cdpr',
    status: 'dropped',
    rating: 6,
    playtimeMinutes: 900,
    ownership: 'digital'
  },
  {
    title: 'The Legend of Zelda: Breath of the Wild',
    releaseDate: '2017-03-03',
    genreIds: [GENRE.action, GENRE.adventure],
    platformIds: [PLATFORM.switch],
    developerKey: 'nintendo',
    status: 'completed',
    rating: 10,
    playtimeMinutes: 6000,
    isMastered: true,
    ownership: 'physical'
  },
  {
    title: 'Super Mario Odyssey',
    releaseDate: '2017-10-27',
    genreIds: [GENRE.platformer],
    platformIds: [PLATFORM.switch],
    developerKey: 'nintendo',
    status: 'backlog',
    priority: 2,
    ownership: 'physical'
  },
  {
    title: 'Animal Crossing: New Horizons',
    releaseDate: '2020-03-20',
    genreIds: [GENRE.indie],
    platformIds: [PLATFORM.switch],
    developerKey: 'nintendo',
    publisherKey: 'nintendo',
    status: 'wishlist',
    ownership: 'none'
  },
  {
    title: 'Hollow Knight',
    releaseDate: '2017-02-24',
    genreIds: [GENRE.metroidvania, GENRE.indie],
    platformIds: [PLATFORM.pc, PLATFORM.switch],
    developerKey: null,
    status: 'played',
    rating: 9,
    playtimeMinutes: 2400,
    ownership: 'digital',
    hltbMainMin: 1740
  }
]

interface DemoCompany {
  key: 'fromsoft' | 'cdpr' | 'nintendo'
  name: string
  isDeveloper: boolean
  isPublisher: boolean
  countryCode: string
  countryNumeric: number
}

const COMPANIES: DemoCompany[] = [
  { key: 'fromsoft', name: 'FromSoftware', isDeveloper: true, isPublisher: false, countryCode: 'JP', countryNumeric: 392 },
  { key: 'cdpr', name: 'CD Projekt Red', isDeveloper: true, isPublisher: true, countryCode: 'PL', countryNumeric: 616 },
  { key: 'nintendo', name: 'Nintendo', isDeveloper: true, isPublisher: true, countryCode: 'JP', countryNumeric: 392 }
]

function insertUserGameForDemo(
  conn: Db,
  gameId: string,
  status: GameStatus,
  opts: {
    rating?: number | null
    playtimeMinutes?: number
    isMastered?: boolean
    priority?: number
    ownership?: Ownership
    resumeNote?: string | null
  }
): void {
  const nowTs = now()
  const startedAt = status === 'wishlist' || status === 'backlog' ? null : nowTs.slice(0, 10)
  const finishedAt = status === 'completed' ? nowTs.slice(0, 10) : null
  conn
    .prepare(
      `INSERT INTO user_game(
         game_id, status, is_favorite, is_mastered, priority, rating, playtime_minutes, playtime_mode,
         times_completed, platform_id, ownership, started_at, finished_at, added_at, status_changed_at,
         last_activity_at, resume_note, created_at, updated_at
       ) VALUES (?, ?, 0, ?, ?, ?, ?, 'manual', ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      gameId,
      status,
      opts.isMastered ? 1 : 0,
      opts.priority ?? 0,
      opts.rating ?? null,
      opts.playtimeMinutes ?? 0,
      status === 'completed' ? 1 : 0,
      opts.ownership ?? 'unknown',
      startedAt,
      finishedAt,
      nowTs,
      nowTs,
      nowTs,
      opts.resumeNote ?? null,
      nowTs,
      nowTs
    )
}

/** Заполняет базу демо-данными в одной транзакции. Возвращает число созданных игр. */
export function seedDemoData(): number {
  return write(
    ['games', 'game_genres', 'game_platforms', 'game_companies', 'companies', 'series', 'series_games', 'lists', 'list_items', 'user_game'],
    (conn) => {
      const nowTs = now()
      const companyIds = new Map<DemoCompany['key'], string>()
      for (const c of COMPANIES) {
        const id = newId()
        companyIds.set(c.key, id)
        const columns: CompanyWriteColumns = {
          name: c.name,
          sortName: makeSortTitle(c.name),
          slug: makeSlug(c.name),
          isDeveloper: c.isDeveloper,
          isPublisher: c.isPublisher,
          countryCode: c.countryCode,
          countryNumeric: c.countryNumeric,
          city: null,
          foundedYear: null,
          closedYear: null,
          description: null,
          website: null,
          logoImageId: null,
          bannerImageId: null,
          parentCompanyId: null
        }
        insertCompanyRow(conn, id, columns, nowTs)
        upsertSearchIndex(conn, 'company', id, c.name)
      }

      const darkSoulsSeriesId = newId()
      const witcherSeriesId = newId()
      const seriesDefs: Array<{ id: string; name: string }> = [
        { id: darkSoulsSeriesId, name: 'Dark Souls' },
        { id: witcherSeriesId, name: 'The Witcher' }
      ]
      for (const s of seriesDefs) {
        const columns: SeriesWriteColumns = {
          name: s.name,
          kind: 'series',
          sortName: makeSortTitle(s.name),
          slug: makeSlug(s.name),
          description: null,
          coverImageId: null,
          bannerImageId: null,
          parentSeriesId: null
        }
        insertSeriesRow(conn, s.id, columns, nowTs)
        upsertSearchIndex(conn, 'series', s.id, s.name)
      }

      const gameIds: string[] = []
      const gameIdByTitle = new Map<string, string>()

      for (const g of GAMES) {
        const id = newId()
        gameIds.push(id)
        gameIdByTitle.set(g.title, id)

        const columns: GameWriteColumns = {
          title: g.title,
          sortTitle: makeSortTitle(g.title),
          slug: makeSlug(g.title),
          altTitlesJson: '[]',
          category: 'main',
          parentGameId: null,
          releaseDate: g.releaseDate,
          releaseDatePrecision: 'day',
          releaseYear: yearFromDate(g.releaseDate),
          releaseStatus: 'released',
          summary: null,
          storyline: null,
          coverImageId: null,
          backdropImageId: null,
          logoImageId: null,
          metacriticScore: null,
          metacriticUrl: null,
          opencriticScore: null,
          hltbMainMin: g.hltbMainMin ?? null,
          hltbExtraMin: null,
          hltbCompleteMin: null,
          ageRating: null,
          website: null
        }
        insertGameRow(conn, id, columns, nowTs)
        setGameGenreLinks(conn, id, g.genreIds, g.genreIds[0] ?? null)
        setGamePlatformLinks(conn, id, g.platformIds)
        if (g.developerKey || g.publisherKey) {
          const developer = g.developerKey ? companyIds.get(g.developerKey) : undefined
          const publisher = g.publisherKey ? companyIds.get(g.publisherKey) : undefined
          setGameCompanyLinks(conn, id, {
            developer: developer ? [developer] : [],
            publisher: publisher ? [publisher] : [],
            supporting: [],
            porting: []
          })
        }
        upsertSearchIndex(conn, 'game', id, g.title)

        insertUserGameForDemo(conn, id, g.status, {
          rating: g.rating,
          playtimeMinutes: g.playtimeMinutes,
          isMastered: g.isMastered,
          priority: g.priority,
          ownership: g.ownership,
          resumeNote: g.resumeNote
        })
      }

      const darkSoulsGameIds = ['Dark Souls', 'Dark Souls III'].map((t) => gameIdByTitle.get(t)).filter((v): v is string => v != null)
      const witcherGameIds = ['The Witcher', 'The Witcher 2: Assassins of Kings', 'The Witcher 3: Wild Hunt']
        .map((t) => gameIdByTitle.get(t))
        .filter((v): v is string => v != null)
      addGamesToSeries(conn, darkSoulsSeriesId, darkSoulsGameIds)
      addGamesToSeries(conn, witcherSeriesId, witcherGameIds)

      const backlogListId = newId()
      const topRpgListId = newId()
      const backlogListColumns: ListWriteColumns = {
        name: 'Начать заново',
        slug: makeSlug('Начать заново'),
        description: 'Забросил, но когда-нибудь вернусь',
        icon: 'rotate-ccw',
        color: '#7C9CF0',
        coverImageId: null,
        isRanked: false,
        sortMode: 'manual',
        isPinned: true
      }
      insertListRow(conn, backlogListId, backlogListColumns, nextListSortOrder(conn), nowTs)
      const topRpgColumns: ListWriteColumns = {
        name: 'Топ RPG',
        slug: makeSlug('Топ RPG'),
        description: 'Лучшие ролевые игры по моей версии',
        icon: 'crown',
        color: '#F0B429',
        coverImageId: null,
        isRanked: true,
        sortMode: 'manual',
        isPinned: true
      }
      insertListRow(conn, topRpgListId, topRpgColumns, nextListSortOrder(conn), nowTs)
      upsertSearchIndex(conn, 'list', backlogListId, backlogListColumns.name)
      upsertSearchIndex(conn, 'list', topRpgListId, topRpgColumns.name)

      const backlogPicks = ['Bloodborne', 'Cyberpunk 2077', 'Super Mario Odyssey']
        .map((t) => gameIdByTitle.get(t))
        .filter((v): v is string => v != null)
      const topRpgPicks = ['Dark Souls', 'The Witcher 3: Wild Hunt', 'Elden Ring', 'Hollow Knight']
        .map((t) => gameIdByTitle.get(t))
        .filter((v): v is string => v != null)
      addGamesToList(conn, backlogListId, backlogPicks, nowTs)
      addGamesToList(conn, topRpgListId, topRpgPicks, nowTs)

      return gameIds.length
    }
  )
}
