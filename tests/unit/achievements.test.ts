import { describe, expect, it } from 'vitest'
import type { Database } from 'better-sqlite3'
import { computeAchievements, computeXp } from '../../src/main/achievements/compute'
import { levelFromXp, levelTitle } from '../../src/main/achievements/definitions'
import { createTestDb, insertGame, insertSession, insertUserGame, NOW } from '../helpers/test-db'

function progressOf(db: Database, key: string): number {
  const items = computeAchievements(db)
  return items.find((item) => item.key === key || item.baseKey === key)?.progress ?? -1
}

describe('достижения (ТЗ 09)', () => {
  it('на пустой базе ничего не открыто', () => {
    const db = createTestDb()
    expect(progressOf(db, 'first_blood')).toBe(0)
    expect(progressOf(db, 'backlog_minus')).toBe(0)
    expect(computeXp(db, 0)).toBe(0)
  })

  it('считает пройденные игры и «первую кровь»', () => {
    const db = createTestDb()
    for (let i = 1; i <= 3; i += 1) {
      const id = `019f0000-0000-7000-8000-00000000000${i}`
      insertGame(db, { id, title: `Game ${i}` })
      insertUserGame(db, { gameId: id, status: 'completed' })
    }
    expect(progressOf(db, 'first_blood')).toBe(1)
    expect(progressOf(db, 'backlog_minus')).toBe(3)
  })

  it('ретроман считает только игры до 2000 года', () => {
    const db = createTestDb()
    const old = '019f0000-0000-7000-8000-000000000101'
    const modern = '019f0000-0000-7000-8000-000000000102'
    insertGame(db, { id: old, title: 'Retro', releaseYear: 1998 })
    insertGame(db, { id: modern, title: 'Modern', releaseYear: 2020 })
    insertUserGame(db, { gameId: old, status: 'completed' })
    insertUserGame(db, { gameId: modern, status: 'completed' })
    expect(progressOf(db, 'retro')).toBe(1)
  })

  it('скороход считает игры, пройденные быстрее HLTB', () => {
    const db = createTestDb()
    const fast = '019f0000-0000-7000-8000-000000000201'
    const slow = '019f0000-0000-7000-8000-000000000202'
    insertGame(db, { id: fast, title: 'Fast', hltbMainMin: 600 })
    insertGame(db, { id: slow, title: 'Slow', hltbMainMin: 600 })
    insertUserGame(db, { gameId: fast, status: 'completed', playtimeMinutes: 300 })
    insertUserGame(db, { gameId: slow, status: 'completed', playtimeMinutes: 900 })
    expect(progressOf(db, 'speedrunner')).toBe(1)
  })

  it('«серийный» требует не меньше трёх основных игр серии', () => {
    const db = createTestDb()
    const seriesId = '019f0000-0000-7000-8000-000000000301'
    db.prepare(
      'INSERT INTO series(id, name, slug, sort_name, created_at, updated_at) VALUES(?,?,?,?,?,?)'
    ).run(seriesId, 'Souls', 'souls', 'Souls', NOW, NOW)
    for (let i = 1; i <= 3; i += 1) {
      const id = `019f0000-0000-7000-8000-00000000031${i}`
      insertGame(db, { id, title: `Souls ${i}` })
      insertUserGame(db, { gameId: id, status: 'completed' })
      db.prepare('INSERT INTO series_games(series_id, game_id, position) VALUES(?,?,?)').run(
        seriesId,
        id,
        i
      )
    }
    const item = computeAchievements(db).find((a) => a.key === `series_complete:${seriesId}`)
    expect(item?.progress).toBe(1)
    expect(item?.params['name']).toBe('Souls')
  })

  it('XP считается по формуле 09 §2 с капом 100 XP на игру', () => {
    const db = createTestDb()
    const id = '019f0000-0000-7000-8000-000000000401'
    insertGame(db, { id, title: 'Long' })
    // 200 часов → в зачёт идёт 100 XP; пройдена (+10), 100 % (+15)
    insertUserGame(db, {
      gameId: id,
      status: 'completed',
      isMastered: true,
      playtimeMinutes: 200 * 60
    })
    expect(computeXp(db, 0)).toBe(10 + 15 + 100)
    // каждый открытый уровень достижения — +20 XP
    expect(computeXp(db, 2)).toBe(10 + 15 + 100 + 40)
  })

  it('уровень и титул считаются по XP', () => {
    expect(levelFromXp(0)).toBe(1)
    expect(levelFromXp(499)).toBe(1)
    expect(levelFromXp(500)).toBe(2)
    expect(levelFromXp(5000)).toBe(11)
    expect(levelTitle(12).key).toBe('level.title.10')
    expect(levelTitle(1).key).toBe('level.title.1')
    expect(levelTitle(60).key).toBe('level.title.50')
  })

  it('достижения на журнале сессий больше не «скоро» (итерация 2)', () => {
    const db = createTestDb()
    const items = computeAchievements(db)
    for (const key of ['streak', 'night_owl']) {
      const item = items.find((a) => a.baseKey === key)
      expect(item?.definition.comingSoon, key).toBeUndefined()
      expect(item?.progress, key).toBe(0)
    }
  })

  it('«Стрик» берёт лучшую серию дней подряд с сессией', () => {
    const db = createTestDb()
    const id = '019f0000-0000-7000-8000-000000000501'
    insertGame(db, { id, title: 'Streaky' })
    // 4 дня подряд, пропуск, ещё 2 дня — в зачёт идут четыре
    for (const day of ['2026-03-01', '2026-03-02', '2026-03-03', '2026-03-04', '2026-03-08', '2026-03-09']) {
      insertSession(db, { gameId: id, playedOn: day, minutes: 60 })
    }
    expect(progressOf(db, 'streak')).toBe(4)
  })

  it('«Сова» считает только сессии с указанным временем после 23:00', () => {
    const db = createTestDb()
    const id = '019f0000-0000-7000-8000-000000000502'
    insertGame(db, { id, title: 'Night' })
    insertSession(db, { gameId: id, playedOn: '2026-03-01', minutes: 60, startedAtTime: '23:30' })
    insertSession(db, { gameId: id, playedOn: '2026-03-02', minutes: 60, startedAtTime: '23:00' })
    insertSession(db, { gameId: id, playedOn: '2026-03-03', minutes: 60, startedAtTime: '18:00' })
    insertSession(db, { gameId: id, playedOn: '2026-03-04', minutes: 60 })
    expect(progressOf(db, 'night_owl')).toBe(2)
  })
})
