/**
 * Генератор нагрузочной базы (07 §11.2: «любая комбинация фильтров ≤ 200 мс на 2000 играх»).
 * Создаёт отдельный файл БД (не трогает рабочую `data/backlog.db`), заполняет её случайными
 * данными на заданное число игр и прогоняет несколько представительных запросов коллекции,
 * печатая время каждого.
 *
 * Запуск: npx tsx scripts/gen-demo-db.ts [count] [outPath]
 *   count   — число игр (по умолчанию 2000)
 *   outPath — путь к файлу БД (по умолчанию ./data/backlog-loadtest.db)
 *
 * Скрипт самодостаточен (не использует Electron): читает миграции напрямую с диска
 * и создаёт данные сырым SQL, не завязываясь на `db/connection.ts` (который тянет `electron`).
 */
import fs from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import { buildCollectionQuery } from '../src/main/db/query/collection-query-builder'
import type { CollectionQuery } from '../src/shared/schema/filters'

const ROOT = path.resolve(import.meta.dirname ?? __dirname, '..')
const MIGRATIONS_DIR = path.join(ROOT, 'src', 'main', 'db', 'migrations')

const argCount = Number(process.argv[2] ?? '2000')
const COUNT = Number.isFinite(argCount) && argCount > 0 ? Math.trunc(argCount) : 2000
const OUT_PATH = process.argv[3] ? path.resolve(process.argv[3]) : path.join(ROOT, 'data', 'backlog-loadtest.db')

function nowIso(): string {
  return new Date().toISOString()
}

/** Простой детерминированный ГПСЧ (mulberry32) — воспроизводимые данные между запусками. */
function makeRng(seed: number): () => number {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function pick<T>(rng: () => number, arr: readonly T[]): T {
  const item = arr[Math.floor(rng() * arr.length)]
  if (item === undefined) throw new Error('pick: пустой массив')
  return item
}

function pickSome<T>(rng: () => number, arr: readonly T[], min: number, max: number): T[] {
  const n = Math.min(arr.length, min + Math.floor(rng() * (max - min + 1)))
  const pool = [...arr]
  const out: T[] = []
  for (let i = 0; i < n; i += 1) {
    const idx = Math.floor(rng() * pool.length)
    out.push(pool[idx] as T)
    pool.splice(idx, 1)
  }
  return out
}

function uuidLike(rng: () => number, seq: number): string {
  // Не настоящий UUIDv7, но проходит `z.string().uuid()` — этого достаточно для нагрузочного файла.
  const hex = (n: number): string => Math.floor(rng() * n).toString(16)
  const tail = seq.toString(16).padStart(12, '0')
  return `${hex(16)}${hex(16)}${hex(16)}${hex(16)}${hex(16)}${hex(16)}${hex(16)}${hex(16)}-${hex(16)}${hex(16)}${hex(16)}${hex(16)}-7${hex(16)}${hex(16)}${hex(16)}-8${hex(16)}${hex(16)}${hex(16)}-${tail}`
}

const TITLE_WORDS = [
  'Shadow', 'Kingdom', 'Legends', 'Quest', 'Chronicles', 'Origins', 'Empire', 'Storm', 'Frontier',
  'Requiem', 'Ashes', 'Horizon', 'Depths', 'Vanguard', 'Ember', 'Ruins', 'Echo', 'Nova', 'Wraith', 'Dawn'
]
const TITLE_SUFFIXES = ['', 'II', 'III', 'IV', ': Remastered', ': Definitive Edition', ' Online', ': Rebirth', ': Awakening']

function randomTitle(rng: () => number, seq: number): string {
  const a = pick(rng, TITLE_WORDS)
  const b = pick(rng, TITLE_WORDS)
  const suffix = pick(rng, TITLE_SUFFIXES)
  return `${a} of ${b}${suffix} #${seq}`
}

function main(): void {
  console.log(`[gen-demo-db] генерирую ${COUNT} игр → ${OUT_PATH}`)
  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true })
  for (const suffix of ['', '-wal', '-shm']) {
    const p = `${OUT_PATH}${suffix}`
    if (fs.existsSync(p)) fs.rmSync(p)
  }

  const db = new Database(OUT_PATH)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  const t0 = performance.now()
  db.exec(fs.readFileSync(path.join(MIGRATIONS_DIR, '0001_init.sql'), 'utf8'))
  db.exec(fs.readFileSync(path.join(MIGRATIONS_DIR, '0002_seed.sql'), 'utf8'))

  const rng = makeRng(42)
  const genreIds = (db.prepare('SELECT id FROM genres').all() as Array<{ id: string }>).map((r) => r.id)
  const platformIds = (db.prepare('SELECT id FROM platforms').all() as Array<{ id: string }>).map((r) => r.id)
  const modeIds = (db.prepare('SELECT id FROM modes').all() as Array<{ id: string }>).map((r) => r.id)

  const insertCompany = db.prepare(
    `INSERT INTO companies(id, name, slug, sort_name, is_developer, is_publisher, country_code, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
  const COMPANY_COUNT = 40
  const companyIds: string[] = []
  const countries = ['US', 'JP', 'PL', 'GB', 'FR', 'DE', 'CA', 'SE', 'KR', 'CN']
  for (let i = 0; i < COMPANY_COUNT; i += 1) {
    const id = uuidLike(rng, 100_000 + i)
    const name = `Studio ${pick(rng, TITLE_WORDS)} ${i}`
    companyIds.push(id)
    insertCompany.run(id, name, `studio-${i}`, name, rng() < 0.85 ? 1 : 0, rng() < 0.4 ? 1 : 0, pick(rng, countries), nowIso(), nowIso())
  }

  const insertSeries = db.prepare(
    'INSERT INTO series(id, name, slug, sort_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
  )
  const SERIES_COUNT = 80
  const seriesIds: string[] = []
  const seriesNextPosition = new Map<string, number>()
  for (let i = 0; i < SERIES_COUNT; i += 1) {
    const id = uuidLike(rng, 200_000 + i)
    const name = `${pick(rng, TITLE_WORDS)} Series ${i}`
    seriesIds.push(id)
    seriesNextPosition.set(id, 1)
    insertSeries.run(id, name, `series-${i}`, name, nowIso(), nowIso())
  }

  const insertGame = db.prepare(
    `INSERT INTO games(id, title, sort_title, slug, category, release_date, release_date_precision,
                        release_year, release_status, metacritic_score, hltb_main_min, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'main', ?, 'day', ?, 'released', ?, ?, ?, ?)`
  )
  const insertGameGenre = db.prepare('INSERT INTO game_genres(game_id, genre_id, is_primary) VALUES (?, ?, ?)')
  const insertGamePlatform = db.prepare('INSERT INTO game_platforms(game_id, platform_id) VALUES (?, ?)')
  const insertGameMode = db.prepare('INSERT INTO game_modes(game_id, mode_id) VALUES (?, ?)')
  const insertGameCompany = db.prepare("INSERT INTO game_companies(game_id, company_id, role) VALUES (?, ?, ?)")
  const insertSeriesGame = db.prepare('INSERT INTO series_games(series_id, game_id, position, is_primary) VALUES (?, ?, ?, 1)')
  const insertUserGame = db.prepare(
    `INSERT INTO user_game(
       game_id, status, is_favorite, is_mastered, priority, rating, playtime_minutes, playtime_mode,
       times_completed, platform_id, ownership, started_at, finished_at, added_at, status_changed_at,
       last_activity_at, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, 'manual', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )

  const STATUS_WEIGHTS: Array<[string, number]> = [
    ['backlog', 30],
    ['completed', 25],
    ['playing', 8],
    ['wishlist', 15],
    ['shelved', 10],
    ['dropped', 7],
    ['played', 5]
  ]
  const totalWeight = STATUS_WEIGHTS.reduce((s, [, w]) => s + w, 0)
  function randomStatus(): string {
    let r = rng() * totalWeight
    for (const [status, w] of STATUS_WEIGHTS) {
      r -= w
      if (r <= 0) return status
    }
    return 'backlog'
  }
  const OWNERSHIPS = ['unknown', 'none', 'digital', 'physical', 'subscription', 'pirated', 'sold']

  const insertAll = db.transaction(() => {
    for (let i = 0; i < COUNT; i += 1) {
      const id = uuidLike(rng, i)
      const title = randomTitle(rng, i)
      const year = 1990 + Math.floor(rng() * 36)
      const month = 1 + Math.floor(rng() * 12)
      const day = 1 + Math.floor(rng() * 28)
      const releaseDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      const metacritic = rng() < 0.7 ? 40 + Math.floor(rng() * 60) : null
      const hltb = rng() < 0.6 ? 300 + Math.floor(rng() * 4000) : null

      insertGame.run(id, title, title, `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${i}`, releaseDate, year, metacritic, hltb, nowIso(), nowIso())

      const gGenres = pickSome(rng, genreIds, 1, 3)
      gGenres.forEach((gid, idx) => insertGameGenre.run(id, gid, idx === 0 ? 1 : 0))
      pickSome(rng, platformIds, 1, 3).forEach((pid) => insertGamePlatform.run(id, pid))
      pickSome(rng, modeIds, 1, 2).forEach((mid) => insertGameMode.run(id, mid))

      const developer = pick(rng, companyIds)
      insertGameCompany.run(id, developer, 'developer')
      if (rng() < 0.7) insertGameCompany.run(id, pick(rng, companyIds), 'publisher')

      if (rng() < 0.3) {
        const seriesId = pick(rng, seriesIds)
        const position = seriesNextPosition.get(seriesId) ?? 1
        seriesNextPosition.set(seriesId, position + 1)
        insertSeriesGame.run(seriesId, id, position)
      }

      if (rng() < 0.85) {
        const status = randomStatus()
        const rateable = status !== 'wishlist' && status !== 'backlog'
        const rating = rateable && rng() < 0.7 ? 1 + Math.floor(rng() * 10) : null
        const playtime = status === 'wishlist' ? 0 : Math.floor(rng() * 6000)
        const addedYear = 2022 + Math.floor(rng() * 4)
        const addedAt = `${addedYear}-${String(1 + Math.floor(rng() * 12)).padStart(2, '0')}-01T00:00:00.000Z`
        const startedAt = status === 'wishlist' || status === 'backlog' ? null : releaseDate
        const finishedAt = status === 'completed' ? releaseDate : null
        insertUserGame.run(
          id,
          status,
          rng() < 0.1 ? 1 : 0,
          status === 'completed' && rng() < 0.2 ? 1 : 0,
          Math.floor(rng() * 4),
          rating,
          playtime,
          status === 'completed' ? 1 : 0,
          rng() < 0.5 ? pick(rng, platformIds) : null,
          pick(rng, OWNERSHIPS),
          startedAt,
          finishedAt,
          addedAt,
          addedAt,
          addedAt,
          addedAt,
          addedAt
        )
      }

      if ((i + 1) % 500 === 0) console.log(`[gen-demo-db] ${i + 1}/${COUNT}`)
    }
  })
  insertAll()

  db.pragma('wal_checkpoint(TRUNCATE)')
  const genMs = performance.now() - t0
  console.log(`[gen-demo-db] готово за ${genMs.toFixed(0)} мс`)

  runTimedQueries(db)
  db.close()
}

/** Прогоняет несколько представительных комбинаций фильтров и печатает время (07 §11.2). */
function runTimedQueries(db: Database.Database): void {
  const genreIds = (db.prepare('SELECT id FROM genres LIMIT 3').all() as Array<{ id: string }>).map((r) => r.id)
  const platformIds = (db.prepare('SELECT id FROM platforms LIMIT 2').all() as Array<{ id: string }>).map((r) => r.id)

  const queries: Array<{ name: string; query: CollectionQuery }> = [
    { name: 'библиотека: все, сортировка по названию', query: { scope: { kind: 'library' }, filters: {}, sort: { field: 'title', dir: 'asc' } } },
    {
      name: 'библиотека: статус+год+жанры+метакритик',
      query: {
        scope: { kind: 'library' },
        filters: { status: ['backlog', 'playing'], year: { min: 2010, max: 2024 }, genres: { ids: genreIds, mode: 'any' }, metacritic: { min: 60 } },
        sort: { field: 'added_at', dir: 'desc' }
      }
    },
    {
      name: 'библиотека: платформы+владение+рейтинг',
      query: {
        scope: { kind: 'library' },
        filters: { platforms: platformIds, ownership: ['digital', 'physical'], rating: { min: 5 } },
        sort: { field: 'rating', dir: 'desc' }
      }
    },
    { name: 'каталог: без фильтров', query: { scope: { kind: 'catalog' }, filters: {}, sort: { field: 'title', dir: 'asc' } } },
    { name: 'поиск по названию', query: { scope: { kind: 'search', query: 'shadow' }, filters: {}, sort: { field: 'title', dir: 'asc' } } }
  ]

  console.log('[gen-demo-db] --- тайминги запросов коллекции (цель: ≤ 200 мс) ---')
  for (const { name, query } of queries) {
    const built = buildCollectionQuery(query)
    const start = performance.now()
    const rows = db.prepare(built.sql).all(...built.params)
    const ms = performance.now() - start
    const flag = ms > 200 ? '  !! ПРЕВЫШЕН ЛИМИТ' : ''
    console.log(`  ${name}: ${rows.length} строк за ${ms.toFixed(1)} мс${flag}`)
  }
}

main()
