import { beforeEach, describe, expect, it } from 'vitest'
import type { Database } from 'better-sqlite3'
import { insertActivity, listActivity } from '../../src/main/db/repositories/activity.repo'
import { createTestDb, insertGame } from '../helpers/test-db'

const GAME = '019f0000-0000-7000-8000-0000000000aa'

let db: Database

/** id растут вместе с датой — как у uuidv7, чтобы курсор проверялся на реалистичных данных. */
function log(index: number, type: 'status_changed' | 'rating_set' | 'session_logged'): void {
  insertActivity(db, {
    id: `019f0000-0000-7000-8000-${String(index).padStart(12, '0')}`,
    happenedAt: `2026-09-${String(index).padStart(2, '0')}T10:00:00.000Z`,
    type,
    gameId: GAME
  })
}

beforeEach(() => {
  db = createTestDb()
  insertGame(db, { id: GAME, title: 'Hollow Knight' })
})

describe('лента активности (06 §1.7)', () => {
  it('отдаёт записи от новой к старой', () => {
    log(1, 'status_changed')
    log(2, 'rating_set')
    log(3, 'session_logged')
    const rows = listActivity(db, { limit: 10 })
    expect(rows.map((row) => row.happenedAt.slice(8, 10))).toEqual(['03', '02', '01'])
    expect(rows[0]?.gameTitle).toBe('Hollow Knight')
  })

  it('курсор продолжает ленту без пропусков и повторов', () => {
    for (let index = 1; index <= 5; index += 1) log(index, 'status_changed')

    const first = listActivity(db, { limit: 2 })
    const last = first[first.length - 1]!
    const second = listActivity(db, { limit: 2, cursor: `${last.happenedAt}|${last.id}` })

    expect(first.map((row) => row.happenedAt.slice(8, 10))).toEqual(['05', '04'])
    expect(second.map((row) => row.happenedAt.slice(8, 10))).toEqual(['03', '02'])
  })

  it('одинаковое время разводит по id, запись не показывается дважды', () => {
    const stamp = '2026-09-09T10:00:00.000Z'
    for (const suffix of ['a1', 'a2', 'a3']) {
      insertActivity(db, {
        id: `019f0000-0000-7000-8000-0000000000${suffix}`,
        happenedAt: stamp,
        type: 'status_changed',
        gameId: GAME
      })
    }
    const first = listActivity(db, { limit: 2 })
    const last = first[first.length - 1]!
    const second = listActivity(db, { limit: 2, cursor: `${last.happenedAt}|${last.id}` })

    expect(first.map((row) => row.id.slice(-2))).toEqual(['a3', 'a2'])
    expect(second.map((row) => row.id.slice(-2))).toEqual(['a1'])
  })

  it('фильтр по группе событий', () => {
    log(1, 'status_changed')
    log(2, 'rating_set')
    log(3, 'session_logged')

    expect(listActivity(db, { limit: 10, category: 'ratings' }).map((row) => row.type)).toEqual([
      'rating_set'
    ])
    expect(listActivity(db, { limit: 10, category: 'sessions' }).map((row) => row.type)).toEqual([
      'session_logged'
    ])
    expect(listActivity(db, { limit: 10, category: 'library' }).map((row) => row.type)).toEqual([
      'status_changed'
    ])
  })

  it('битый курсор не роняет запрос', () => {
    log(1, 'status_changed')
    expect(listActivity(db, { limit: 10, cursor: 'мусор' })).toHaveLength(1)
  })
})
