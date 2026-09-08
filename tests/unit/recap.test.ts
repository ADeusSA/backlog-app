import { beforeEach, describe, expect, it } from 'vitest'
import type { Database } from 'better-sqlite3'
import { getRecap } from '../../src/main/services/recap.service'
import { createTestDb, insertGame, insertSession, insertUserGame, NOW, testId } from '../helpers/test-db'

const ELDEN = '019f0000-0000-7000-8000-0000000000e1'
const HADES = '019f0000-0000-7000-8000-0000000000e2'

let db: Database

/** Жанр создаётся один раз (имя уникально) и вешается на игру. */
function genreId(name: string): string {
  const existing = db.prepare('SELECT id FROM genres WHERE name = ?').get(name) as { id: string } | undefined
  if (existing) return existing.id
  const id = testId('g')
  db.prepare('INSERT INTO genres(id, name, slug, is_custom, created_at, updated_at) VALUES(?, ?, ?, 1, ?, ?)').run(
    id,
    name,
    `slug-${id}`,
    NOW,
    NOW
  )
  return id
}

function addGenre(gameId: string, name: string): void {
  db.prepare('INSERT INTO game_genres(game_id, genre_id) VALUES(?, ?)').run(gameId, genreId(name))
}

beforeEach(() => {
  db = createTestDb()
  insertGame(db, { id: ELDEN, title: 'Elden Ring' })
  insertGame(db, { id: HADES, title: 'Hades' })
})

describe('итоги года (00-TZ §6 п.10)', () => {
  it('на пустой базе год пустой', () => {
    const recap = getRecap(2026, db)
    expect(recap.hasData).toBe(false)
    expect(recap.years).toEqual([])
    expect(recap.completed).toBe(0)
    expect(recap.minutes).toBe(0)
  })

  it('считает пройденное, добавленное и часы за нужный год', () => {
    insertUserGame(db, {
      gameId: ELDEN,
      status: 'completed',
      rating: 9,
      addedAt: '2026-02-01T10:00:00.000Z',
      finishedAt: '2026-05-20'
    })
    insertUserGame(db, {
      gameId: HADES,
      status: 'completed',
      rating: 7,
      addedAt: '2025-02-01T10:00:00.000Z',
      finishedAt: '2025-11-02'
    })
    insertSession(db, { gameId: ELDEN, playedOn: '2026-05-18', minutes: 120 })
    insertSession(db, { gameId: ELDEN, playedOn: '2026-05-19', minutes: 60 })
    insertSession(db, { gameId: HADES, playedOn: '2025-11-01', minutes: 300 })

    const recap = getRecap(2026, db)
    expect(recap.hasData).toBe(true)
    expect(recap.completed).toBe(1)
    expect(recap.added).toBe(1)
    expect(recap.minutes).toBe(180)
    expect(recap.sessions).toBe(2)
    expect(recap.days).toBe(2)
    expect(recap.bestStreak).toBe(2)
    expect(recap.avgRating).toBe(9)
    expect(recap.ratedCount).toBe(1)
    expect(recap.years).toEqual([2026, 2025])
  })

  it('лучший месяц — по сумме минут', () => {
    insertSession(db, { gameId: ELDEN, playedOn: '2026-03-02', minutes: 60 })
    insertSession(db, { gameId: ELDEN, playedOn: '2026-07-02', minutes: 90 })
    insertSession(db, { gameId: HADES, playedOn: '2026-07-05', minutes: 30 })

    expect(getRecap(2026, db).bestMonth).toEqual({ month: 7, minutes: 120 })
  })

  it('топы по часам и по оценке ограничены годом', () => {
    insertUserGame(db, { gameId: ELDEN, status: 'completed', rating: 8, finishedAt: '2026-04-01' })
    insertUserGame(db, { gameId: HADES, status: 'completed', rating: 10, finishedAt: '2025-04-01' })
    insertSession(db, { gameId: HADES, playedOn: '2026-01-10', minutes: 500 })
    insertSession(db, { gameId: ELDEN, playedOn: '2026-01-11', minutes: 100 })

    const recap = getRecap(2026, db)
    expect(recap.topByHours.map((g) => [g.title, g.minutes])).toEqual([
      ['Hades', 500],
      ['Elden Ring', 100]
    ])
    // Оценка Hades стоит за 2025 год — в топ этого года она не попадает.
    expect(recap.topRated.map((g) => g.title)).toEqual(['Elden Ring'])
  })

  it('жанры и первая-последняя пройденные берутся за год', () => {
    insertUserGame(db, { gameId: ELDEN, status: 'completed', finishedAt: '2026-02-01' })
    insertUserGame(db, { gameId: HADES, status: 'completed', finishedAt: '2026-10-01' })
    addGenre(ELDEN, 'RPG')
    addGenre(HADES, 'RPG')
    addGenre(HADES, 'Рогалик')

    const recap = getRecap(2026, db)
    expect(recap.genres).toEqual([
      { name: 'RPG', count: 2 },
      { name: 'Рогалик', count: 1 }
    ])
    expect(recap.firstCompleted).toEqual({ title: 'Elden Ring', date: '2026-02-01' })
    expect(recap.lastCompleted).toEqual({ title: 'Hades', date: '2026-10-01' })
  })
})
