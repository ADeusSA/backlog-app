/**
 * Вспомогательные функции для интеграционных тестов репозиториев/билдера (10 §3 п.4):
 * настоящая in-memory SQLite с применёнными миграциями, без Electron/paths.
 * Файл не подпадает под маску `*.test.ts`, поэтому vitest не запускает его как тест.
 */
import Database from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'

export type TestDb = Database.Database

const MIGRATIONS_DIR = path.join(__dirname, 'migrations')

export function createTestDb(): TestDb {
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  for (const file of ['0001_init.sql', '0002_seed.sql', '0003_sessions.sql']) {
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8')
    db.exec(sql)
  }
  return db
}

/** id платформ/жанров, зашитые в 0002_seed.sql — удобно ссылаться в фикстурах. */
export const SEED = {
  platform: {
    pc: '01900000-0001-7000-8000-000000000001',
    ps5: '01900000-0001-7000-8000-000000000014',
    switch: '01900000-0001-7000-8000-000000000036',
    xboxSeries: '01900000-0001-7000-8000-000000000023'
  },
  genre: {
    action: '01900000-0002-7000-8000-000000000001',
    adventure: '01900000-0002-7000-8000-000000000002',
    actionRpg: '01900000-0002-7000-8000-000000000003',
    rpg: '01900000-0002-7000-8000-000000000004',
    jrpg: '01900000-0002-7000-8000-000000000005',
    shooter: '01900000-0002-7000-8000-000000000006',
    indie: '01900000-0002-7000-8000-000000000030'
  },
  mode: {
    singlePlayer: '01900000-0003-7000-8000-000000000001',
    coop: '01900000-0003-7000-8000-000000000002',
    multiplayer: '01900000-0003-7000-8000-000000000003'
  }
} as const

let seq = 0
/**
 * Детерминированный псевдо-UUID для фикстур (не нужен настоящий UUIDv7 в тестах),
 * но обязан пройти `idSchema` (`z.string().uuid()`) — поэтому каждый символ префикса
 * переводится в hex-цифру, а не используется как есть.
 */
export function fixtureId(prefix: string): string {
  seq += 1
  const hexPrefix =
    prefix
      .split('')
      .map((ch) => (ch.charCodeAt(0) % 16).toString(16))
      .join('')
      .padEnd(8, '0')
      .slice(0, 8) || '00000000'
  const hex = seq.toString(16).padStart(12, '0')
  return `${hexPrefix}-0000-7000-8000-${hex}`
}

export function insertCompany(
  db: TestDb,
  input: {
    id: string
    name: string
    isDeveloper?: boolean
    isPublisher?: boolean
    countryCode?: string | null
    parentCompanyId?: string | null
  }
): void {
  const now = '2026-01-01T00:00:00.000Z'
  db.prepare(
    `INSERT INTO companies(id, name, slug, sort_name, is_developer, is_publisher, country_code, parent_company_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    input.id,
    input.name,
    input.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    input.name,
    input.isDeveloper === false ? 0 : 1,
    input.isPublisher ? 1 : 0,
    input.countryCode ?? null,
    input.parentCompanyId ?? null,
    now,
    now
  )
}

export function insertSeries(db: TestDb, input: { id: string; name: string }): void {
  const now = '2026-01-01T00:00:00.000Z'
  db.prepare('INSERT INTO series(id, name, slug, sort_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)').run(
    input.id,
    input.name,
    input.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    input.name,
    now,
    now
  )
}

export function insertList(db: TestDb, input: { id: string; name: string }): void {
  const now = '2026-01-01T00:00:00.000Z'
  db.prepare('INSERT INTO lists(id, name, slug, created_at, updated_at) VALUES (?, ?, ?, ?, ?)').run(
    input.id,
    input.name,
    input.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    now,
    now
  )
}

export interface GameFixture {
  id: string
  title: string
  sortTitle?: string
  category?: string
  releaseDate?: string | null
  metacriticScore?: number | null
  hltbMainMin?: number | null
  genreIds?: string[]
  primaryGenreId?: string
  platformIds?: string[]
  modeIds?: string[]
  developerIds?: string[]
  publisherIds?: string[]
  seriesId?: string
  seriesPosition?: number
  tagIds?: string[]
  parentGameId?: string | null
}

export function insertGame(db: TestDb, fixture: GameFixture): void {
  const now = '2026-01-01T00:00:00.000Z'
  const releaseDate = fixture.releaseDate ?? null
  const releaseYear = releaseDate ? Number(releaseDate.slice(0, 4)) : null
  db.prepare(
    `INSERT INTO games(id, title, sort_title, slug, category, parent_game_id, release_date, release_year,
                        metacritic_score, hltb_main_min, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    fixture.id,
    fixture.title,
    fixture.sortTitle ?? fixture.title,
    fixture.title.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + fixture.id.slice(-4),
    fixture.category ?? 'main',
    fixture.parentGameId ?? null,
    releaseDate,
    releaseYear,
    fixture.metacriticScore ?? null,
    fixture.hltbMainMin ?? null,
    now,
    now
  )
  for (const genreId of fixture.genreIds ?? []) {
    db.prepare('INSERT INTO game_genres(game_id, genre_id, is_primary) VALUES (?, ?, ?)').run(
      fixture.id,
      genreId,
      genreId === fixture.primaryGenreId ? 1 : 0
    )
  }
  for (const platformId of fixture.platformIds ?? []) {
    db.prepare('INSERT INTO game_platforms(game_id, platform_id) VALUES (?, ?)').run(fixture.id, platformId)
  }
  for (const modeId of fixture.modeIds ?? []) {
    db.prepare('INSERT INTO game_modes(game_id, mode_id) VALUES (?, ?)').run(fixture.id, modeId)
  }
  for (const companyId of fixture.developerIds ?? []) {
    db.prepare("INSERT INTO game_companies(game_id, company_id, role) VALUES (?, ?, 'developer')").run(fixture.id, companyId)
  }
  for (const companyId of fixture.publisherIds ?? []) {
    db.prepare("INSERT INTO game_companies(game_id, company_id, role) VALUES (?, ?, 'publisher')").run(fixture.id, companyId)
  }
  for (const tagId of fixture.tagIds ?? []) {
    db.prepare('INSERT INTO game_tags(game_id, tag_id) VALUES (?, ?)').run(fixture.id, tagId)
  }
  if (fixture.seriesId) {
    db.prepare('INSERT INTO series_games(series_id, game_id, position, is_primary) VALUES (?, ?, ?, 1)').run(
      fixture.seriesId,
      fixture.id,
      fixture.seriesPosition ?? 1
    )
  }
}

export interface UserGameFixture {
  gameId: string
  status: string
  rating?: number | null
  playtimeMinutes?: number
  isFavorite?: boolean
  isMastered?: boolean
  priority?: number
  ownership?: string
  platformId?: string | null
  addedAt?: string
  startedAt?: string | null
  finishedAt?: string | null
  lastActivityAt?: string
  review?: string | null
}

export function insertUserGame(db: TestDb, fixture: UserGameFixture): void {
  const now = fixture.addedAt ?? '2026-01-01T00:00:00.000Z'
  db.prepare(
    `INSERT INTO user_game(
       game_id, status, is_favorite, is_mastered, priority, rating, playtime_minutes, playtime_mode,
       times_completed, platform_id, ownership, started_at, finished_at, added_at, status_changed_at,
       last_activity_at, review, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, 'manual', 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    fixture.gameId,
    fixture.status,
    fixture.isFavorite ? 1 : 0,
    fixture.isMastered ? 1 : 0,
    fixture.priority ?? 0,
    fixture.rating ?? null,
    fixture.playtimeMinutes ?? 0,
    fixture.platformId ?? null,
    fixture.ownership ?? 'unknown',
    fixture.startedAt ?? null,
    fixture.finishedAt ?? null,
    now,
    now,
    fixture.lastActivityAt ?? now,
    fixture.review ?? null,
    now,
    now
  )
}

export function insertListItem(db: TestDb, input: { listId: string; gameId: string; position: number; note?: string | null }): void {
  db.prepare('INSERT INTO list_items(list_id, game_id, position, note, added_at) VALUES (?, ?, ?, ?, ?)').run(
    input.listId,
    input.gameId,
    input.position,
    input.note ?? null,
    '2026-01-01T00:00:00.000Z'
  )
}
