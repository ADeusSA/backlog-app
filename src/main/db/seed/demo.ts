import type { GameInput } from '@shared/schema/entities'
import type { GameStatus } from '@shared/constants'
import { write, type Db } from '../connection'
import { newId, now, today } from '../utils'
import { applySaveCompany } from '../../services/companies.service'
import { applySaveSeries } from '../../services/series.service'
import { applySaveGame } from '../../services/catalog-games.service'
import { makeSlug } from '@shared/text'

/**
 * Демо-контент для мастера первого запуска и разработки (ТЗ 02 §6, 05 §8):
 * 12 игр, 3 студии, 2 серии, 2 списка, разные статусы, оценки и часы. Без изображений —
 * карточки показывают плейсхолдеры, и это тоже полезная проверка вида.
 */

interface DemoGame {
  title: string
  year: number
  category?: GameInput['category']
  developer: 0 | 1 | 2
  publisher: 0 | 1 | 2
  series?: 0 | 1
  seriesPosition?: number
  genres: number[]
  platforms: number[]
  metacritic?: number
  hltbMainMin?: number
  summary: string
  status: GameStatus | null
  rating?: number
  playtimeHours?: number
  mastered?: boolean
  favorite?: boolean
  priority?: number
}

const COMPANIES = [
  { name: 'FromSoftware', country: 'JP', city: 'Токио', founded: 1986, developer: true, publisher: true },
  { name: 'CD Projekt RED', country: 'PL', city: 'Варшава', founded: 2002, developer: true, publisher: true },
  { name: 'Supergiant Games', country: 'US', city: 'Сан-Франциско', founded: 2009, developer: true, publisher: true }
]

const SERIES = [
  { name: 'Souls', description: 'Тяжёлые экшен-RPG FromSoftware' },
  { name: 'Ведьмак', description: 'Серия по книгам Анджея Сапковского' }
]

/** Жанры и платформы берутся из сида по фиксированным id (миграция 0002). */
const GENRE_IDS = [
  '01900000-0002-7000-8000-000000000003', // Action RPG
  '01900000-0002-7000-8000-000000000001', // Экшен
  '01900000-0002-7000-8000-000000000020', // Рогалик
  '01900000-0002-7000-8000-000000000004', // RPG
  '01900000-0002-7000-8000-000000000021' // Метроидвания
]

const PLATFORM_IDS = [
  '01900000-0001-7000-8000-000000000001', // PC
  '01900000-0001-7000-8000-000000000014', // PS5
  '01900000-0001-7000-8000-000000000036' // Switch
]

const GAMES: DemoGame[] = [
  {
    title: 'Elden Ring',
    year: 2022,
    developer: 0,
    publisher: 0,
    series: 0,
    seriesPosition: 3,
    genres: [0, 1],
    platforms: [0, 1],
    metacritic: 96,
    hltbMainMin: 3480,
    summary: 'Открытый мир Между земель, кольцо Элден разбито, а вы — Погасший.',
    status: 'playing',
    playtimeHours: 61,
    favorite: true
  },
  {
    title: 'Dark Souls',
    year: 2011,
    developer: 0,
    publisher: 0,
    series: 0,
    seriesPosition: 1,
    genres: [0, 1],
    platforms: [0],
    metacritic: 89,
    hltbMainMin: 2700,
    summary: 'Лордран, костры и очень терпеливые игроки.',
    status: 'completed',
    rating: 10,
    playtimeHours: 78,
    mastered: true,
    favorite: true
  },
  {
    title: 'Dark Souls III',
    year: 2016,
    developer: 0,
    publisher: 0,
    series: 0,
    seriesPosition: 2,
    genres: [0, 1],
    platforms: [0, 1],
    metacritic: 89,
    hltbMainMin: 2100,
    summary: 'Финал трилогии: угасающее пламя и Пепельный.',
    status: 'completed',
    rating: 9,
    playtimeHours: 52
  },
  {
    title: 'Sekiro: Shadows Die Twice',
    year: 2019,
    developer: 0,
    publisher: 0,
    genres: [1],
    platforms: [0, 1],
    metacritic: 90,
    hltbMainMin: 1800,
    summary: 'Синоби на протезе против всей Асины.',
    status: 'shelved',
    rating: 8,
    playtimeHours: 14
  },
  {
    title: 'Ведьмак 3: Дикая Охота',
    year: 2015,
    developer: 1,
    publisher: 1,
    series: 1,
    seriesPosition: 3,
    genres: [0, 3],
    platforms: [0, 1, 2],
    metacritic: 92,
    hltbMainMin: 3480,
    summary: 'Геральт ищет Цири, попутно разбираясь с судьбами Севера.',
    status: 'completed',
    rating: 10,
    playtimeHours: 121,
    favorite: true
  },
  {
    title: 'Ведьмак 2: Убийцы королей',
    year: 2011,
    developer: 1,
    publisher: 1,
    series: 1,
    seriesPosition: 2,
    genres: [0, 3],
    platforms: [0],
    metacritic: 88,
    hltbMainMin: 1500,
    summary: 'Политика, заговоры и два очень разных прохождения.',
    status: 'completed',
    rating: 8,
    playtimeHours: 31
  },
  {
    title: 'Ведьмак',
    year: 2007,
    developer: 1,
    publisher: 1,
    series: 1,
    seriesPosition: 1,
    genres: [0, 3],
    platforms: [0],
    metacritic: 81,
    hltbMainMin: 2700,
    summary: 'С чего всё начиналось: Вызима, ведьмачий знак и алхимия.',
    status: 'dropped',
    rating: 6,
    playtimeHours: 9
  },
  {
    title: 'Cyberpunk 2077',
    year: 2020,
    developer: 1,
    publisher: 1,
    genres: [0, 3],
    platforms: [0, 1],
    metacritic: 86,
    hltbMainMin: 1500,
    summary: 'Найт-Сити, чип с Джонни Сильверхендом и очень плотный город.',
    status: 'backlog',
    priority: 3
  },
  {
    title: 'Hades',
    year: 2020,
    developer: 2,
    publisher: 2,
    genres: [2, 1],
    platforms: [0, 2],
    metacritic: 93,
    hltbMainMin: 1260,
    summary: 'Загрей снова и снова сбегает из Подземного царства.',
    status: 'played',
    rating: 9,
    playtimeHours: 47
  },
  {
    title: 'Hades II',
    year: 2026,
    developer: 2,
    publisher: 2,
    genres: [2, 1],
    platforms: [0],
    hltbMainMin: 1500,
    summary: 'Мелиноя против Хроноса; ранний доступ.',
    status: 'wishlist'
  },
  {
    title: 'Pyre',
    year: 2017,
    developer: 2,
    publisher: 2,
    genres: [3],
    platforms: [0],
    metacritic: 85,
    hltbMainMin: 900,
    summary: 'Изгнанники, обряды и спортивная тактика в фэнтезийном чистилище.',
    status: 'backlog',
    priority: 1
  },
  {
    title: 'Elden Ring: Shadow of the Erdtree',
    year: 2024,
    category: 'dlc',
    developer: 0,
    publisher: 0,
    genres: [0],
    platforms: [0, 1],
    metacritic: 94,
    hltbMainMin: 1800,
    summary: 'Дополнение о Земле Теней и Микелле.',
    status: 'backlog',
    priority: 2
  }
]

const LISTS = [
  { name: 'Пройти до конца года', icon: 'flag', color: '#8b7cff', titles: ['Cyberpunk 2077', 'Pyre', 'Sekiro: Shadows Die Twice'] },
  { name: 'Любимое', icon: 'heart', color: '#34d6c4', titles: ['Dark Souls', 'Ведьмак 3: Дикая Охота', 'Elden Ring'] }
]

function daysAgo(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return date.toISOString()
}

/** Дата 'YYYY-MM-DD' N дней назад — журнал сессий хранит именно дни (02 §3.9). */
function dayAgo(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() - days)
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/**
 * Линейный конгруэнтный генератор: демо-журнал должен выглядеть живым, но
 * оставаться одинаковым при каждом заполнении — иначе скриншоты и проверки «пляшут».
 */
function makeRandom(seed: number): () => number {
  let state = seed
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296
    return state / 4294967296
  }
}

/** Игры, по которым в демо есть сессии: те, в которые «играли». */
const SESSION_TITLES = [
  'Elden Ring',
  'Hades',
  'Hollow Knight',
  'Ведьмак 3: Дикая Охота',
  'Cyberpunk 2077',
  'Dark Souls'
]

/**
 * Журнал сессий за последние 10 месяцев + два прохождения одной игры (06 §1.9).
 * Без него карта активности в профиле у нового пользователя пустая, и непонятно,
 * что она вообще умеет.
 */
function seedSessions(db: Db, idByTitle: Map<string, string>): void {
  const timestamp = now()
  const gameIds = SESSION_TITLES.map((title) => idByTitle.get(title)).filter(
    (id): id is string => Boolean(id)
  )
  if (gameIds.length === 0) return

  const random = makeRandom(20260908)
  const insert = db.prepare(
    `INSERT INTO play_sessions(id, game_id, playthrough_id, played_on, started_at_time, minutes, note,
                               created_at, updated_at)
     VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )

  // Два прохождения первой игры: обычное и NG+ — сессии последних недель идут в NG+.
  const heroId = gameIds[0]!
  const firstRun = newId()
  const newGamePlus = newId()
  const insertPlaythrough = db.prepare(
    `INSERT INTO playthroughs(id, game_id, number, title, status, is_replay, is_mastered, rating,
                              playtime_minutes, started_at, finished_at, notes, created_at, updated_at)
     VALUES(?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?)`
  )
  insertPlaythrough.run(
    firstRun, heroId, 1, 'Первое прохождение', 'completed', 0, 0, 9,
    dayAgo(280), dayAgo(150), 'Обычная концовка', timestamp, timestamp
  )
  insertPlaythrough.run(
    newGamePlus, heroId, 2, 'NG+', 'in_progress', 1, 0, null,
    dayAgo(60), null, 'Иду за платиной', timestamp, timestamp
  )

  let created = 0
  for (let ago = 300; ago >= 0; ago -= 1) {
    // Плотность растёт к сегодняшнему дню, плюс гарантированная серия из девяти дней.
    const streakDay = ago <= 8
    const chance = ago < 60 ? 0.45 : ago < 180 ? 0.3 : 0.18
    if (!streakDay && random() > chance) continue

    const sessionsToday = random() < 0.2 ? 2 : 1
    for (let i = 0; i < sessionsToday; i += 1) {
      const gameId = gameIds[Math.floor(random() * gameIds.length)]!
      const minutes = 30 + Math.floor(random() * 5) * 30
      // Часть сессий — с временем начала: по нему считается достижение «Сова».
      const hour = random() < 0.15 ? 23 : 17 + Math.floor(random() * 5)
      const startedAt = random() < 0.6 ? `${String(hour % 24).padStart(2, '0')}:00` : null
      const playthroughId = gameId === heroId ? (ago > 60 ? firstRun : newGamePlus) : null
      insert.run(newId(), gameId, playthroughId, dayAgo(ago), startedAt, minutes, null, timestamp, timestamp)
      created += 1
    }
  }

  // Часы прохождений — сумма их сессий (правило `sessions.service.syncPlaythroughPlaytime`).
  for (const playthroughId of [firstRun, newGamePlus]) {
    db.prepare(
      `UPDATE playthroughs SET playtime_minutes =
         (SELECT COALESCE(SUM(minutes), 0) FROM play_sessions WHERE playthrough_id = ?)
       WHERE id = ?`
    ).run(playthroughId, playthroughId)
  }

  if (created > 0) {
    db.prepare(
      `INSERT INTO activity_log(id, happened_at, type, game_id, payload_json)
       VALUES(?, ?, 'session_logged', ?, ?)`
    ).run(newId(), timestamp, heroId, JSON.stringify({ minutes: 60, playedOn: dayAgo(0) }))
  }
}

function baseGameInput(demo: DemoGame, companyIds: string[], seriesIds: string[]): GameInput {
  const developerId = companyIds[demo.developer]
  const publisherId = companyIds[demo.publisher]
  return {
    title: demo.title,
    altTitles: [],
    category: demo.category ?? 'main',
    releaseDate: String(demo.year),
    releaseDatePrecision: 'year',
    releaseStatus: 'released',
    summary: demo.summary,
    developerIds: developerId ? [developerId] : [],
    publisherIds: publisherId ? [publisherId] : [],
    supportingIds: [],
    portingIds: [],
    genreIds: demo.genres.map((index) => GENRE_IDS[index]).filter((id): id is string => Boolean(id)),
    primaryGenreId: GENRE_IDS[demo.genres[0] ?? 0] ?? null,
    platformIds: demo.platforms.map((index) => PLATFORM_IDS[index]).filter((id): id is string => Boolean(id)),
    modeIds: [],
    tagIds: [],
    ...(demo.metacritic != null ? { metacriticScore: demo.metacritic } : {}),
    ...(demo.hltbMainMin != null ? { hltbMainMin: demo.hltbMainMin } : {}),
    ...(demo.series != null ? { seriesId: seriesIds[demo.series] ?? null } : {}),
    ...(demo.seriesPosition != null ? { seriesPosition: demo.seriesPosition } : {}),
    addToLibrary: false
  }
}

function insertUserGame(db: Db, gameId: string, demo: DemoGame, index: number): void {
  if (!demo.status) return
  const timestamp = now()
  const added = daysAgo(200 - index * 12)
  const finished = demo.status === 'completed' ? today() : null
  db.prepare(
    `INSERT INTO user_game(game_id, status, is_favorite, is_mastered, priority, rating, playtime_minutes,
                           ownership, started_at, finished_at, added_at, status_changed_at, last_activity_at,
                           times_completed, created_at, updated_at)
     VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    gameId,
    demo.status,
    demo.favorite ? 1 : 0,
    demo.mastered ? 1 : 0,
    demo.priority ?? 0,
    demo.rating ?? null,
    (demo.playtimeHours ?? 0) * 60,
    demo.status === 'wishlist' ? 'none' : 'digital',
    demo.status === 'backlog' || demo.status === 'wishlist' ? null : today(),
    finished,
    added,
    added,
    daysAgo(index),
    demo.status === 'completed' ? 1 : 0,
    timestamp,
    timestamp
  )
}

/** Заполняет базу демо-контентом. Идемпотентность не требуется — вызывается один раз из мастера. */
export function seedDemoData(): { games: number } {
  return write(
    [
      'companies',
      'series',
      'games',
      'game_companies',
      'game_genres',
      'game_platforms',
      'series_games',
      'user_game',
      'lists',
      'list_items',
      'activity_log',
      'playthroughs',
      'play_sessions'
    ],
    (db) => {
      const companyIds = COMPANIES.map((company) =>
        applySaveCompany(db, {
          name: company.name,
          isDeveloper: company.developer,
          isPublisher: company.publisher,
          countryCode: company.country,
          city: company.city,
          foundedYear: company.founded
        })
      )

      const seriesIds = SERIES.map((series) =>
        applySaveSeries(db, { name: series.name, kind: 'series', description: series.description })
      )

      const idByTitle = new Map<string, string>()
      for (const [index, demo] of GAMES.entries()) {
        const gameId = applySaveGame(db, baseGameInput(demo, companyIds, seriesIds))
        idByTitle.set(demo.title, gameId)
        insertUserGame(db, gameId, demo, index)
      }

      const timestamp = now()
      for (const [order, list] of LISTS.entries()) {
        const listId = newId()
        db.prepare(
          `INSERT INTO lists(id, name, slug, icon, color, is_ranked, sort_mode, sort_order, is_pinned, created_at, updated_at)
           VALUES(?, ?, ?, ?, ?, 0, 'manual', ?, 1, ?, ?)`
        ).run(listId, list.name, `${makeSlug(list.name)}-${order + 1}`, list.icon, list.color, order, timestamp, timestamp)

        list.titles.forEach((title, position) => {
          const gameId = idByTitle.get(title)
          if (!gameId) return
          db.prepare(
            'INSERT INTO list_items(list_id, game_id, position, added_at) VALUES(?, ?, ?, ?)'
          ).run(listId, gameId, position + 1, timestamp)
        })
      }

      seedSessions(db, idByTitle)

      return { games: GAMES.length }
    }
  )
}
