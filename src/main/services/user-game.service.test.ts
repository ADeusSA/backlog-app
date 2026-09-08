import { beforeEach, describe, expect, it } from 'vitest'
import { createTestDb, fixtureId, insertGame, insertUserGame, type TestDb } from '../db/test-helpers'
import { getUserGameRow } from '../db/repositories/user-game.repo'
import { applyAddPlaytime, applyStatusChange, applyUserGamePatch, ensureUserGame, validatePatch } from './user-game.service'
import { AppError } from '@shared/errors'

const GAME_ID = fixtureId('test-game')

let db: TestDb

beforeEach(() => {
  db = createTestDb()
  insertGame(db, { id: GAME_ID, title: 'Test Game' })
})

describe('ensureUserGame', () => {
  it('создаёт запись со статусом по умолчанию backlog', () => {
    const created = ensureUserGame(db, GAME_ID)
    expect(created).toBe(true)
    const row = getUserGameRow(db, GAME_ID)
    expect(row?.status).toBe('backlog')
    expect(row?.started_at).toBeNull()
  })

  it('повторный вызов не пересоздаёт строку', () => {
    ensureUserGame(db, GAME_ID, 'playing')
    const createdAgain = ensureUserGame(db, GAME_ID, 'completed')
    expect(createdAgain).toBe(false)
    expect(getUserGameRow(db, GAME_ID)?.status).toBe('playing')
  })

  it('создание сразу со статусом completed проставляет finished_at и times_completed=1', () => {
    ensureUserGame(db, GAME_ID, 'completed')
    const row = getUserGameRow(db, GAME_ID)
    expect(row?.finished_at).not.toBeNull()
    expect(row?.times_completed).toBe(1)
  })
})

describe('applyStatusChange (02 §4)', () => {
  it('переход в playing проставляет started_at, если он не был задан', () => {
    ensureUserGame(db, GAME_ID, 'backlog')
    applyStatusChange(db, GAME_ID, 'playing')
    const row = getUserGameRow(db, GAME_ID)
    expect(row?.status).toBe('playing')
    expect(row?.started_at).not.toBeNull()
  })

  it('переход в completed из playing проставляет finished_at и увеличивает times_completed', () => {
    ensureUserGame(db, GAME_ID, 'playing')
    applyStatusChange(db, GAME_ID, 'completed')
    const row = getUserGameRow(db, GAME_ID)
    expect(row?.finished_at).not.toBeNull()
    expect(row?.times_completed).toBe(1)
  })

  it('повторное прохождение (completed → backlog → completed) снова увеличивает счётчик', () => {
    ensureUserGame(db, GAME_ID, 'playing')
    applyStatusChange(db, GAME_ID, 'completed')
    applyStatusChange(db, GAME_ID, 'backlog')
    applyStatusChange(db, GAME_ID, 'completed')
    expect(getUserGameRow(db, GAME_ID)?.times_completed).toBe(2)
  })

  it('переход из wishlist в completed НЕ увеличивает times_completed (не входит в источники)', () => {
    ensureUserGame(db, GAME_ID, 'wishlist')
    applyStatusChange(db, GAME_ID, 'completed')
    expect(getUserGameRow(db, GAME_ID)?.times_completed).toBe(0)
  })

  it('is_mastered сбрасывается при уходе со статуса completed/played', () => {
    ensureUserGame(db, GAME_ID, 'completed')
    applyUserGamePatch(db, GAME_ID, { isMastered: true })
    expect(getUserGameRow(db, GAME_ID)?.is_mastered).toBe(1)
    applyStatusChange(db, GAME_ID, 'shelved')
    expect(getUserGameRow(db, GAME_ID)?.is_mastered).toBe(0)
  })

  it('смена на тот же статус — no-op', () => {
    ensureUserGame(db, GAME_ID, 'playing')
    const before = getUserGameRow(db, GAME_ID)
    applyStatusChange(db, GAME_ID, 'playing')
    const after = getUserGameRow(db, GAME_ID)
    expect(after?.status_changed_at).toBe(before?.status_changed_at)
  })
})

describe('validatePatch (02 §4 — запрет оценки/мастеринга)', () => {
  it('запрещает оценку при wishlist', () => {
    expect(() => validatePatch('wishlist', { rating: 8 })).toThrow(AppError)
  })
  it('запрещает оценку при backlog', () => {
    expect(() => validatePatch('backlog', { rating: 8 })).toThrow(AppError)
  })
  it('разрешает оценку при playing/completed/played/shelved/dropped', () => {
    for (const status of ['playing', 'completed', 'played', 'shelved', 'dropped'] as const) {
      expect(() => validatePatch(status, { rating: 8 })).not.toThrow()
    }
  })
  it('снятие оценки (null) разрешено всегда', () => {
    expect(() => validatePatch('wishlist', { rating: null })).not.toThrow()
  })
  it('запрещает is_mastered вне completed/played', () => {
    expect(() => validatePatch('playing', { isMastered: true })).toThrow(AppError)
    expect(() => validatePatch('completed', { isMastered: true })).not.toThrow()
    expect(() => validatePatch('played', { isMastered: true })).not.toThrow()
  })
  it('запрещает finishedAt раньше startedAt', () => {
    expect(() => validatePatch('completed', { startedAt: '2026-02-01', finishedAt: '2026-01-01' })).toThrow(AppError)
  })
})

describe('applyUserGamePatch', () => {
  it('автосоздаёт user_game при первом действии (02 §4)', () => {
    const dto = applyUserGamePatch(db, GAME_ID, { isFavorite: true })
    expect(dto.isFavorite).toBe(true)
    expect(dto.status).toBe('backlog')
  })

  it('бросает AppError и не пишет поле при недопустимой оценке', () => {
    ensureUserGame(db, GAME_ID, 'backlog')
    expect(() => applyUserGamePatch(db, GAME_ID, { rating: 9 })).toThrow(AppError)
    expect(getUserGameRow(db, GAME_ID)?.rating).toBeNull()
  })
})

describe('applyAddPlaytime', () => {
  it('прибавляет минуты к текущему значению', () => {
    insertUserGame(db, { gameId: GAME_ID, status: 'playing', playtimeMinutes: 60 })
    const dto = applyAddPlaytime(db, GAME_ID, 30)
    expect(dto.playtimeMinutes).toBe(90)
  })

  it('не уходит в минус при отрицательной корректировке', () => {
    insertUserGame(db, { gameId: GAME_ID, status: 'playing', playtimeMinutes: 10 })
    const dto = applyAddPlaytime(db, GAME_ID, -100)
    expect(dto.playtimeMinutes).toBe(0)
  })
})
