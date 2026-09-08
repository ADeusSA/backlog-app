/**
 * Бизнес-правила пользовательских данных по игре (02 §4). Единственная точка записи
 * `user_game` — все изменения статуса/оценки/времени идут через эти функции.
 */
import { getDb, write } from '../db/connection'
import type { Db } from '../db/connection'
import { now, today } from '../db/utils'
import {
  deleteUserGameRows,
  getUserGameDto,
  getUserGameRow,
  insertUserGameRow,
  setUserGameFields
} from '../db/repositories/user-game.repo'
import { addTagsToGames, ensureTag, getTagsForGame, removeTagsFromGames, setGameTags } from '../db/repositories/taxonomy.repo'
import { logActivity } from './activity.service'
import { AppError } from '@shared/errors'
import { MASTERABLE_STATUSES, RATEABLE_STATUSES } from '@shared/constants'
import type { GameStatus } from '@shared/constants'
import type { TagDto, UserGameDto, UserGamePatch } from '@shared/schema/entities'

/** Статусы, при переходе В которые из «активных» инкрементируется `times_completed`. */
const COMPLETION_SOURCE_STATUSES: GameStatus[] = ['playing', 'backlog', 'shelved']

function gameExistsRow(conn: Db, gameId: string): { id: string } | undefined {
  return conn.prepare('SELECT id FROM games WHERE id = ?').get(gameId) as { id: string } | undefined
}

function ensureExists(conn: Db, gameId: string): void {
  if (!gameExistsRow(conn, gameId)) throw new AppError('not_found', 'Игра не найдена в каталоге', { gameId })
}

/**
 * Создаёт `user_game`, если его ещё нет (автосоздание при первом действии, 02 §4).
 * Экспортируется для юнит-тестов бизнес-правил (10 §3 п.4) — принимает готовое
 * соединение, поэтому тестируется на `createTestDb()` без Electron/`write()`.
 */
export function ensureUserGame(conn: Db, gameId: string, initialStatus: GameStatus = 'backlog'): boolean {
  const existing = getUserGameRow(conn, gameId)
  if (existing) return false
  ensureExists(conn, gameId)
  const nowTs = now()
  insertUserGameRow(conn, gameId, {
    status: initialStatus,
    startedAt: initialStatus === 'playing' ? today() : null,
    finishedAt: initialStatus === 'completed' ? today() : null,
    timesCompleted: initialStatus === 'completed' ? 1 : 0,
    now: nowTs
  })
  logActivity(conn, 'game_added', { gameId, payload: { status: initialStatus } })
  return true
}

export function getUserGame(gameId: string): UserGameDto | null {
  return getUserGameDto(getDb(), gameId)
}

/** Применяет смену статуса с автодатами и счётчиком повторных прохождений (02 §4). */
export function applyStatusChange(conn: Db, gameId: string, status: GameStatus): void {
  const created = ensureUserGame(conn, gameId, status)
  if (created) return // строка уже создана сразу с нужным статусом

  const existing = getUserGameRow(conn, gameId)
  if (!existing) return
  const prevStatus = existing.status as GameStatus
  if (prevStatus === status) return

  const nowTs = now()
  const fields: Record<string, unknown> = {
    status,
    status_changed_at: nowTs,
    last_activity_at: nowTs,
    updated_at: nowTs
  }
  if (status === 'playing' && !existing.started_at) fields.started_at = today()
  if (status === 'completed') {
    if (!existing.finished_at) fields.finished_at = today()
    if (COMPLETION_SOURCE_STATUSES.includes(prevStatus)) fields.times_completed = existing.times_completed + 1
  }
  if (!MASTERABLE_STATUSES.includes(status)) fields.is_mastered = 0
  setUserGameFields(conn, gameId, fields)
  logActivity(conn, 'status_changed', { gameId, payload: { from: prevStatus, to: status } })
}

export function setStatus(gameId: string, status: GameStatus): UserGameDto {
  return write(['user_game', 'games'], (conn) => {
    applyStatusChange(conn, gameId, status)
    const dto = getUserGameDto(conn, gameId)
    if (!dto) throw new AppError('unknown', 'Не удалось получить пользовательские данные игры')
    return dto
  })
}

export function bulkStatus(gameIds: string[], status: GameStatus): void {
  write(['user_game', 'games'], (conn) => {
    for (const gameId of gameIds) applyStatusChange(conn, gameId, status)
  })
}

export function validatePatch(existingStatus: GameStatus, patch: UserGamePatch): void {
  const effectiveStatus = existingStatus
  if (patch.rating !== undefined && patch.rating !== null && !RATEABLE_STATUSES.includes(effectiveStatus)) {
    throw new AppError('validation', 'Нельзя оценивать игру со статусом «Хочу» или «Бэклог»')
  }
  if (patch.isMastered === true && !MASTERABLE_STATUSES.includes(effectiveStatus)) {
    throw new AppError('validation', 'Отметка «100%» доступна только для пройденных/сыгранных игр')
  }
  const startedAt = patch.startedAt
  const finishedAt = patch.finishedAt
  if (startedAt && finishedAt && finishedAt < startedAt) {
    throw new AppError('validation', 'Дата завершения не может быть раньше даты начала')
  }
}

const PATCH_COLUMN_MAP: Record<keyof UserGamePatch, string> = {
  isFavorite: 'is_favorite',
  isMastered: 'is_mastered',
  priority: 'priority',
  rating: 'rating',
  playtimeMinutes: 'playtime_minutes',
  platformId: 'platform_id',
  ownership: 'ownership',
  store: 'store',
  subscriptionService: 'subscription_service',
  startedAt: 'started_at',
  finishedAt: 'finished_at',
  resumeNote: 'resume_note',
  notes: 'notes',
  review: 'review',
  reviewHasSpoilers: 'review_has_spoilers'
}

/** Чистое применение патча к уже существующей/только что созданной строке `user_game`. */
export function applyUserGamePatch(conn: Db, gameId: string, patch: UserGamePatch): UserGameDto {
  ensureUserGame(conn, gameId)
  const existing = getUserGameRow(conn, gameId)
  if (!existing) throw new AppError('unknown', 'Не удалось создать пользовательские данные игры')
  validatePatch(existing.status as GameStatus, patch)

  const fields: Record<string, unknown> = {}
  for (const key of Object.keys(patch) as (keyof UserGamePatch)[]) {
    const value = patch[key]
    if (value === undefined) continue
    const column = PATCH_COLUMN_MAP[key]
    fields[column] = typeof value === 'boolean' ? (value ? 1 : 0) : value
  }
  if (Object.keys(fields).length === 0) return getUserGameDto(conn, gameId)!

  const nowTs = now()
  fields.last_activity_at = nowTs
  fields.updated_at = nowTs
  setUserGameFields(conn, gameId, fields)

  if (patch.rating !== undefined) logActivity(conn, 'rating_set', { gameId, payload: { rating: patch.rating } })
  if (patch.playtimeMinutes !== undefined) {
    logActivity(conn, 'playtime_set', { gameId, payload: { playtimeMinutes: patch.playtimeMinutes } })
  }
  if (patch.isMastered === true) logActivity(conn, 'mastered_set', { gameId, payload: {} })
  if (patch.review !== undefined && patch.review) logActivity(conn, 'review_written', { gameId, payload: {} })

  return getUserGameDto(conn, gameId)!
}

export function patchUserGame(gameId: string, patch: UserGamePatch): UserGameDto {
  return write(['user_game', 'games'], (conn) => applyUserGamePatch(conn, gameId, patch))
}

/** Чистое добавление времени к уже открытому соединению (для юнит-тестов и сервиса). */
export function applyAddPlaytime(conn: Db, gameId: string, minutes: number): UserGameDto {
  ensureUserGame(conn, gameId)
  const existing = getUserGameRow(conn, gameId)
  if (!existing) throw new AppError('unknown', 'Не удалось создать пользовательские данные игры')
  const total = Math.max(0, existing.playtime_minutes + minutes)
  const nowTs = now()
  setUserGameFields(conn, gameId, { playtime_minutes: total, last_activity_at: nowTs, updated_at: nowTs })
  logActivity(conn, 'playtime_set', { gameId, payload: { addedMinutes: minutes, totalMinutes: total } })
  return getUserGameDto(conn, gameId)!
}

export function addPlaytime(gameId: string, minutes: number): UserGameDto {
  return write(['user_game', 'games'], (conn) => applyAddPlaytime(conn, gameId, minutes))
}

export function addToLibrary(gameIds: string[], status: GameStatus): void {
  write(['user_game', 'games'], (conn) => {
    for (const gameId of gameIds) ensureUserGame(conn, gameId, status)
  })
}

export function removeFromLibrary(gameIds: string[]): void {
  write(['user_game'], (conn) => {
    deleteUserGameRows(conn, gameIds)
  })
}

export function setTags(gameId: string, tagIds: string[]): TagDto[] {
  return write(['game_tags', 'tags'], (conn) => {
    setGameTags(conn, gameId, tagIds)
    return getTagsForGame(conn, gameId)
  })
}

export function bulkTags(gameIds: string[], addTagIds: string[], removeTagIds: string[]): void {
  write(['game_tags', 'tags'], (conn) => {
    addTagsToGames(conn, gameIds, addTagIds)
    removeTagsFromGames(conn, gameIds, removeTagIds)
  })
}

/** Создаёт тег «на лету» по имени, если такого ещё нет (06 §6.2 — автодополнение тегов). */
export function ensureTagByName(name: string): string {
  return write(['tags'], (conn) => ensureTag(conn, name))
}
