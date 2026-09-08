import Database from 'better-sqlite3'
import init from '../../src/main/db/migrations/0001_init.sql?raw'
import seed from '../../src/main/db/migrations/0002_seed.sql?raw'

/** База в памяти с применёнными миграциями — для юнит- и интеграционных тестов. */
export function createTestDb(): Database.Database {
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  db.exec(init)
  db.exec(seed)
  return db
}

let counter = 0

/** Детерминированный UUID-подобный id для фикстур. */
export function testId(prefix = 'a'): string {
  counter += 1
  const tail = String(counter).padStart(12, '0')
  return `019f0000-0000-7000-8000-${tail}`.replace('019f', `019${prefix.charCodeAt(0) % 10}`)
}

export const NOW = '2026-09-07T10:00:00.000Z'

export function insertGame(
  db: Database.Database,
  fields: {
    id: string
    title: string
    releaseYear?: number | null
    category?: string
    hltbMainMin?: number | null
  }
): void {
  db.prepare(
    `INSERT INTO games(id, title, sort_title, slug, category, release_year, hltb_main_min, created_at, updated_at)
     VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    fields.id,
    fields.title,
    fields.title,
    fields.id,
    fields.category ?? 'main',
    fields.releaseYear ?? null,
    fields.hltbMainMin ?? null,
    NOW,
    NOW
  )
}

export function insertUserGame(
  db: Database.Database,
  fields: {
    gameId: string
    status?: string
    isMastered?: boolean
    rating?: number | null
    playtimeMinutes?: number
    platformId?: string | null
    review?: string | null
    addedAt?: string
    finishedAt?: string | null
  }
): void {
  db.prepare(
    `INSERT INTO user_game(game_id, status, is_mastered, rating, playtime_minutes, platform_id, review,
                           added_at, status_changed_at, last_activity_at, finished_at, created_at, updated_at)
     VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    fields.gameId,
    fields.status ?? 'backlog',
    fields.isMastered ? 1 : 0,
    fields.rating ?? null,
    fields.playtimeMinutes ?? 0,
    fields.platformId ?? null,
    fields.review ?? null,
    fields.addedAt ?? NOW,
    NOW,
    NOW,
    fields.finishedAt ?? null,
    NOW,
    NOW
  )
}
