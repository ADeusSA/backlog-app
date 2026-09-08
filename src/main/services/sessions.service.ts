/**
 * Журнал сессий (ТЗ 10 §1, итерация 2). Единственная точка записи `play_sessions`:
 * здесь же пересчитываются часы игры и прохождения и пишется активность.
 *
 * Модуль намеренно не создаёт `user_game`: журнал доступен только для игр из библиотеки,
 * а обратная зависимость сервисов друг на друга дала бы цикл импортов
 * (`user-game.service` вызывает отсюда запись сессии для быстрых кнопок «+1 ч»).
 */
import { getDb, write } from '../db/connection'
import type { Db } from '../db/connection'
import { newId, now, today } from '../db/utils'
import {
  activityDays,
  activityGameCount,
  allPlayedDays,
  countSessions,
  deleteSession as deleteSessionRow,
  getSession,
  insertSession,
  listSessions,
  sessionYears,
  sumMinutesForGame,
  sumMinutesForPlaythrough,
  updateSession,
  type ListSessionsOptions
} from '../db/repositories/sessions.repo'
import { getUserGameRow, setUserGameFields } from '../db/repositories/user-game.repo'
import { setPlaythroughMinutes } from '../db/repositories/playthroughs.repo'
import { logActivity } from './activity.service'
import { currentStreak, longestStreak } from './sessions-stats'
import { AppError } from '@shared/errors'
import {
  type ActivitySummary,
  activitySummarySchema,
  type PlaySessionDto,
  type SessionInput
} from '@shared/schema/sessions'

/** Таблицы, которые меняет запись сессии, — по ним renderer инвалидирует кеши (01 §9). */
export const SESSION_TABLES = ['play_sessions', 'user_game', 'playthroughs']

function ensureGameExists(conn: Db, gameId: string): void {
  const row = conn.prepare('SELECT id FROM games WHERE id = ?').get(gameId) as { id: string } | undefined
  if (!row) throw new AppError('not_found', 'Игра не найдена в каталоге', { gameId })
}

/**
 * Приводит `user_game.playtime_minutes` к сумме сессий, если игра в режиме `sessions`
 * (02 §3.8: `playtime_mode`). В ручном режиме число принадлежит пользователю — не трогаем.
 */
export function syncGamePlaytime(conn: Db, gameId: string, timestamp: string): void {
  const row = getUserGameRow(conn, gameId)
  if (!row || row.playtime_mode !== 'sessions') return
  const total = sumMinutesForGame(conn, gameId)
  if (total === row.playtime_minutes) return
  setUserGameFields(conn, gameId, {
    playtime_minutes: total,
    last_activity_at: timestamp,
    updated_at: timestamp
  })
}

/**
 * У прохождения с сессиями часы всегда равны их сумме (поле в форме при этом
 * блокируется). Прохождение без сессий сохраняет введённое вручную число — поэтому
 * удаление последней сессии не обнуляет часы, а возвращает поле в ручной режим.
 */
export function syncPlaythroughPlaytime(conn: Db, playthroughId: string, timestamp: string): void {
  const count = countSessions(conn, { playthroughId })
  if (count === 0) return
  setPlaythroughMinutes(conn, playthroughId, sumMinutesForPlaythrough(conn, playthroughId), timestamp)
}

/** Запись сессии внутри уже открытой транзакции. Возвращает id сессии. */
export function applySaveSession(conn: Db, input: SessionInput): string {
  ensureGameExists(conn, input.gameId)
  const timestamp = now()
  const previous = input.id ? getSession(conn, input.id) : null
  if (input.id && !previous) throw new AppError('not_found', 'Сессия не найдена', { id: input.id })

  const fields = {
    id: previous?.id ?? newId(),
    gameId: input.gameId,
    playthroughId: input.playthroughId ?? null,
    playedOn: input.playedOn,
    startedAtTime: input.startedAtTime ?? null,
    minutes: input.minutes,
    note: input.note?.trim() ? input.note.trim() : null,
    now: timestamp
  }

  if (previous) updateSession(conn, fields)
  else insertSession(conn, fields)

  syncGamePlaytime(conn, input.gameId, timestamp)
  // Прохождение могли сменить: пересчитываем и старое, и новое.
  for (const playthroughId of new Set(
    [previous?.playthroughId, fields.playthroughId].filter((id): id is string => Boolean(id))
  )) {
    syncPlaythroughPlaytime(conn, playthroughId, timestamp)
  }

  if (!previous) {
    logActivity(conn, 'session_logged', {
      gameId: input.gameId,
      payload: { minutes: fields.minutes, playedOn: fields.playedOn }
    })
  }
  return fields.id
}

export function saveSession(input: SessionInput): PlaySessionDto {
  return write(SESSION_TABLES, (conn) => {
    const id = applySaveSession(conn, input)
    const dto = getSession(conn, id)
    if (!dto) throw new AppError('unknown', 'Не удалось сохранить сессию')
    return dto
  })
}

/** Удаление сессии внутри уже открытой транзакции. */
export function applyDeleteSession(conn: Db, id: string): void {
  const existing = getSession(conn, id)
  if (!existing) return
  deleteSessionRow(conn, id)
  const timestamp = now()
  syncGamePlaytime(conn, existing.gameId, timestamp)
  if (existing.playthroughId) syncPlaythroughPlaytime(conn, existing.playthroughId, timestamp)
}

export function removeSession(id: string): void {
  write(SESSION_TABLES, (conn) => applyDeleteSession(conn, id))
}

export function getSessions(opts: ListSessionsOptions): PlaySessionDto[] {
  return listSessions(getDb(), opts)
}

export function countGameSessions(gameId: string): number {
  return countSessions(getDb(), { gameId })
}

/** Свод для карты активности профиля и страницы игры (06 §1.9). */
export function getActivitySummary(query: { from: string; to: string; gameId?: string }): ActivitySummary {
  const db = getDb()
  const days = activityDays(db, query)
  // Стрики считаются по всей истории, а не по показанному окну.
  const everyDay = allPlayedDays(db, query.gameId)
  return activitySummarySchema.parse({
    from: query.from,
    to: query.to,
    days,
    streak: {
      current: currentStreak(everyDay, today()),
      longest: longestStreak(everyDay)
    },
    totals: {
      minutes: days.reduce((sum, day) => sum + day.minutes, 0),
      sessions: days.reduce((sum, day) => sum + day.sessions, 0),
      days: days.length,
      games: activityGameCount(db, query)
    },
    years: sessionYears(db, query.gameId)
  })
}
