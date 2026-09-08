import { beforeEach, describe, expect, it } from 'vitest'
import type { Database } from 'better-sqlite3'
import {
  applyDeleteSession,
  applySaveSession,
  syncGamePlaytime
} from '../../src/main/services/sessions.service'
import { currentStreak, longestStreak } from '../../src/main/services/sessions-stats'
import { addDays, dayDiff, startOfWeek } from '../../src/shared/dates'
import { listSessions } from '../../src/main/db/repositories/sessions.repo'
import { getPlaythrough } from '../../src/main/db/repositories/playthroughs.repo'
import { getUserGameRow } from '../../src/main/db/repositories/user-game.repo'
import { createTestDb, insertGame, insertUserGame, NOW, testId } from '../helpers/test-db'

const GAME = '019f0000-0000-7000-8000-0000000000aa'

let db: Database

function insertPlaythrough(id: string, fields: { number?: number; minutes?: number } = {}): string {
  db.prepare(
    `INSERT INTO playthroughs(id, game_id, number, status, playtime_minutes, created_at, updated_at)
     VALUES(?, ?, ?, 'in_progress', ?, ?, ?)`
  ).run(id, GAME, fields.number ?? 1, fields.minutes ?? 0, NOW, NOW)
  return id
}

beforeEach(() => {
  db = createTestDb()
  insertGame(db, { id: GAME, title: 'Hollow Knight' })
})

describe('арифметика дат (06 §1.9)', () => {
  it('считает разницу и сдвиг в днях через границу месяца', () => {
    expect(dayDiff('2026-03-01', '2026-02-28')).toBe(1)
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01')
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31')
  })

  it('переход на летнее время не сдвигает дни', () => {
    // В зоне пользователя 29 марта 2026 — переход на летнее время в ЕС;
    // расчёт идёт в UTC, поэтому разница остаётся целым числом дней.
    expect(dayDiff('2026-03-30', '2026-03-28')).toBe(2)
  })

  it('неделя начинается с понедельника', () => {
    expect(startOfWeek('2026-09-08')).toBe('2026-09-07') // вторник → понедельник
    expect(startOfWeek('2026-09-06')).toBe('2026-08-31') // воскресенье → понедельник той же недели
  })
})

describe('стрики (09 §3)', () => {
  it('текущая серия считает дни подряд до сегодня', () => {
    expect(currentStreak(['2026-09-06', '2026-09-07', '2026-09-08'], '2026-09-08')).toBe(3)
  })

  it('вчерашний последний день серию не рвёт — сегодня ещё не закончилось', () => {
    expect(currentStreak(['2026-09-06', '2026-09-07'], '2026-09-08')).toBe(2)
  })

  it('пропуск двух дней обнуляет текущую серию', () => {
    expect(currentStreak(['2026-09-01', '2026-09-02'], '2026-09-08')).toBe(0)
  })

  it('повторы одной даты не удлиняют серию', () => {
    expect(currentStreak(['2026-09-08', '2026-09-08', '2026-09-08'], '2026-09-08')).toBe(1)
  })

  it('лучшая серия берётся из всей истории, а не из последней', () => {
    const days = ['2026-01-01', '2026-01-02', '2026-01-03', '2026-01-04', '2026-05-01']
    expect(longestStreak(days)).toBe(4)
    expect(currentStreak(days, '2026-09-08')).toBe(0)
  })

  it('пустая история — нули', () => {
    expect(longestStreak([])).toBe(0)
    expect(currentStreak([], '2026-09-08')).toBe(0)
  })
})

describe('запись сессии', () => {
  it('создаёт сессию и пишет событие в ленту активности', () => {
    insertUserGame(db, { gameId: GAME, status: 'playing' })
    applySaveSession(db, { gameId: GAME, playedOn: '2026-09-08', minutes: 90, note: '  босс  ' })

    const [session] = listSessions(db, { gameId: GAME })
    expect(session?.minutes).toBe(90)
    expect(session?.note).toBe('босс')
    const activity = db
      .prepare("SELECT COUNT(*) AS n FROM activity_log WHERE type = 'session_logged'")
      .get() as { n: number }
    expect(activity.n).toBe(1)
  })

  it('в ручном режиме часы игры не трогает', () => {
    insertUserGame(db, { gameId: GAME, status: 'playing', playtimeMinutes: 600 })
    applySaveSession(db, { gameId: GAME, playedOn: '2026-09-08', minutes: 90 })
    expect(getUserGameRow(db, GAME)?.playtime_minutes).toBe(600)
  })

  it('в режиме сессий часы игры равны сумме журнала', () => {
    insertUserGame(db, { gameId: GAME, status: 'playing', playtimeMinutes: 600 })
    db.prepare("UPDATE user_game SET playtime_mode = 'sessions' WHERE game_id = ?").run(GAME)

    applySaveSession(db, { gameId: GAME, playedOn: '2026-09-07', minutes: 90 })
    applySaveSession(db, { gameId: GAME, playedOn: '2026-09-08', minutes: 30 })
    expect(getUserGameRow(db, GAME)?.playtime_minutes).toBe(120)
  })

  it('удаление сессии уменьшает часы в режиме сессий', () => {
    insertUserGame(db, { gameId: GAME, status: 'playing' })
    db.prepare("UPDATE user_game SET playtime_mode = 'sessions' WHERE game_id = ?").run(GAME)
    const id = applySaveSession(db, { gameId: GAME, playedOn: '2026-09-08', minutes: 90 })
    applySaveSession(db, { gameId: GAME, playedOn: '2026-09-07', minutes: 30 })

    applyDeleteSession(db, id)
    expect(getUserGameRow(db, GAME)?.playtime_minutes).toBe(30)
  })

  it('переключение режима сразу подменяет ручные часы суммой сессий', () => {
    insertUserGame(db, { gameId: GAME, status: 'playing', playtimeMinutes: 600 })
    applySaveSession(db, { gameId: GAME, playedOn: '2026-09-08', minutes: 45 })
    db.prepare("UPDATE user_game SET playtime_mode = 'sessions' WHERE game_id = ?").run(GAME)

    syncGamePlaytime(db, GAME, NOW)
    expect(getUserGameRow(db, GAME)?.playtime_minutes).toBe(45)
  })

  it('правка сессии не плодит вторую запись и не дублирует событие', () => {
    insertUserGame(db, { gameId: GAME, status: 'playing' })
    const id = applySaveSession(db, { gameId: GAME, playedOn: '2026-09-08', minutes: 60 })
    applySaveSession(db, { id, gameId: GAME, playedOn: '2026-09-08', minutes: 120 })

    const sessions = listSessions(db, { gameId: GAME })
    expect(sessions).toHaveLength(1)
    expect(sessions[0]?.minutes).toBe(120)
    const activity = db
      .prepare("SELECT COUNT(*) AS n FROM activity_log WHERE type = 'session_logged'")
      .get() as { n: number }
    expect(activity.n).toBe(1)
  })

  it('сессия без игры в каталоге не записывается', () => {
    expect(() => applySaveSession(db, { gameId: testId('x'), playedOn: '2026-09-08', minutes: 60 })).toThrow()
  })
})

describe('часы прохождения', () => {
  it('складываются из привязанных сессий', () => {
    const ptId = insertPlaythrough('019f0000-0000-7000-8000-0000000000b1')
    applySaveSession(db, { gameId: GAME, playthroughId: ptId, playedOn: '2026-09-07', minutes: 60 })
    applySaveSession(db, { gameId: GAME, playthroughId: ptId, playedOn: '2026-09-08', minutes: 30 })
    expect(getPlaythrough(db, ptId)?.playtimeMinutes).toBe(90)
    expect(getPlaythrough(db, ptId)?.sessionCount).toBe(2)
  })

  it('перенос сессии в другое прохождение пересчитывает оба', () => {
    const first = insertPlaythrough('019f0000-0000-7000-8000-0000000000b2', { number: 1 })
    const second = insertPlaythrough('019f0000-0000-7000-8000-0000000000b3', { number: 2 })
    const id = applySaveSession(db, {
      gameId: GAME,
      playthroughId: first,
      playedOn: '2026-09-08',
      minutes: 120
    })
    applySaveSession(db, { id, gameId: GAME, playthroughId: second, playedOn: '2026-09-08', minutes: 120 })

    // У первого сессий не осталось: часы остаются последними посчитанными,
    // а поле снова становится ручным (см. syncPlaythroughPlaytime).
    expect(getPlaythrough(db, first)?.sessionCount).toBe(0)
    expect(getPlaythrough(db, second)?.playtimeMinutes).toBe(120)
  })

  it('удаление прохождения оставляет сессии в журнале', () => {
    const ptId = insertPlaythrough('019f0000-0000-7000-8000-0000000000b4')
    applySaveSession(db, { gameId: GAME, playthroughId: ptId, playedOn: '2026-09-08', minutes: 60 })
    db.prepare('DELETE FROM playthroughs WHERE id = ?').run(ptId)

    const sessions = listSessions(db, { gameId: GAME })
    expect(sessions).toHaveLength(1)
    expect(sessions[0]?.playthroughId).toBeNull()
  })
})
