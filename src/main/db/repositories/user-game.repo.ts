/**
 * Репозиторий `user_game` (02 §3.8). Только подготовленные запросы и маппинг в DTO —
 * все бизнес-правила (автодаты, times_completed, is_mastered…) в `services/user-game.service.ts`.
 */
import type { Db } from '../connection'
import { toBool } from '../utils'
import { type UserGameDto, userGameDtoSchema } from '@shared/schema/entities'
import type { GameStatus, Ownership, PlaytimeMode } from '@shared/constants'

export interface UserGameRow {
  game_id: string
  status: string
  is_favorite: number
  is_mastered: number
  priority: number
  rating: number | null
  playtime_minutes: number
  playtime_mode: string
  times_completed: number
  platform_id: string | null
  ownership: string
  store: string | null
  subscription_service: string | null
  started_at: string | null
  finished_at: string | null
  added_at: string
  status_changed_at: string
  last_activity_at: string
  resume_note: string | null
  notes: string | null
  review: string | null
  review_has_spoilers: number
  created_at: string
  updated_at: string
}

export function getUserGameRow(db: Db, gameId: string): UserGameRow | undefined {
  return db.prepare('SELECT * FROM user_game WHERE game_id = ?').get(gameId) as UserGameRow | undefined
}

export function userGameExists(db: Db, gameId: string): boolean {
  return getUserGameRow(db, gameId) != null
}

export function mapUserGameDto(row: UserGameRow): UserGameDto {
  return userGameDtoSchema.parse({
    gameId: row.game_id,
    status: row.status as GameStatus,
    isFavorite: toBool(row.is_favorite),
    isMastered: toBool(row.is_mastered),
    priority: row.priority,
    rating: row.rating,
    playtimeMinutes: row.playtime_minutes,
    playtimeMode: row.playtime_mode as PlaytimeMode,
    timesCompleted: row.times_completed,
    platformId: row.platform_id,
    ownership: row.ownership as Ownership,
    store: row.store,
    subscriptionService: row.subscription_service,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    addedAt: row.added_at,
    statusChangedAt: row.status_changed_at,
    lastActivityAt: row.last_activity_at,
    resumeNote: row.resume_note,
    notes: row.notes,
    review: row.review,
    reviewHasSpoilers: toBool(row.review_has_spoilers),
    updatedAt: row.updated_at
  })
}

export function getUserGameDto(db: Db, gameId: string): UserGameDto | null {
  const row = getUserGameRow(db, gameId)
  return row ? mapUserGameDto(row) : null
}

export interface NewUserGameDefaults {
  status: GameStatus
  startedAt: string | null
  finishedAt: string | null
  timesCompleted: number
  now: string
}

/** Создаёт строку `user_game` со значениями по умолчанию (02 §4: автосоздание при первом действии). */
export function insertUserGameRow(db: Db, gameId: string, defaults: NewUserGameDefaults): void {
  db.prepare(
    `INSERT INTO user_game (
       game_id, status, is_favorite, is_mastered, priority, rating, playtime_minutes, playtime_mode,
       times_completed, platform_id, ownership, store, subscription_service, started_at, finished_at,
       added_at, status_changed_at, last_activity_at, resume_note, notes, review, review_has_spoilers,
       created_at, updated_at
     ) VALUES (?, ?, 0, 0, 0, NULL, 0, 'manual', ?, NULL, 'unknown', NULL, NULL, ?, ?, ?, ?, ?, NULL, NULL, NULL, 0, ?, ?)`
  ).run(
    gameId,
    defaults.status,
    defaults.timesCompleted,
    defaults.startedAt,
    defaults.finishedAt,
    defaults.now,
    defaults.now,
    defaults.now,
    defaults.now,
    defaults.now
  )
}

/** Обновляет произвольный набор колонок `user_game` (значения уже подготовлены сервисом). */
export function setUserGameFields(db: Db, gameId: string, fields: Record<string, unknown>): void {
  const keys = Object.keys(fields)
  if (keys.length === 0) return
  const setSql = keys.map((k) => `${k} = ?`).join(', ')
  db.prepare(`UPDATE user_game SET ${setSql} WHERE game_id = ?`).run(...keys.map((k) => fields[k]), gameId)
}

export function deleteUserGameRows(db: Db, gameIds: string[]): void {
  if (gameIds.length === 0) return
  const ph = gameIds.map(() => '?').join(',')
  db.prepare(`DELETE FROM user_game WHERE game_id IN (${ph})`).run(...gameIds)
}

/** Из переданного списка id — те, что уже в библиотеке (есть `user_game`). */
export function filterExistingUserGameIds(db: Db, gameIds: string[]): Set<string> {
  if (gameIds.length === 0) return new Set()
  const ph = gameIds.map(() => '?').join(',')
  const rows = db.prepare(`SELECT game_id FROM user_game WHERE game_id IN (${ph})`).all(...gameIds) as Array<{ game_id: string }>
  return new Set(rows.map((r) => r.game_id))
}
