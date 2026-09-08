/**
 * Прохождения игры (02 §3.9): первое прохождение, NG+, «на английском», реплеи.
 * Часы прохождения складываются из привязанных к нему сессий; если сессий нет,
 * остаётся введённое вручную число (см. `sessions.service.syncPlaythroughPlaytime`).
 */
import { getDb, write } from '../db/connection'
import { newId, now } from '../db/utils'
import {
  deletePlaythrough as deletePlaythroughRow,
  getPlaythrough,
  insertPlaythrough,
  listPlaythroughs,
  nextPlaythroughNumber,
  updatePlaythrough
} from '../db/repositories/playthroughs.repo'
import { countSessions, sumMinutesForPlaythrough } from '../db/repositories/sessions.repo'
import { AppError } from '@shared/errors'
import type { PlaythroughDto, PlaythroughInput } from '@shared/schema/sessions'

const PLAYTHROUGH_TABLES = ['playthroughs', 'play_sessions']

export function getPlaythroughs(gameId: string): PlaythroughDto[] {
  return listPlaythroughs(getDb(), gameId)
}

export function savePlaythrough(input: PlaythroughInput): PlaythroughDto {
  return write(PLAYTHROUGH_TABLES, (conn) => {
    const gameRow = conn.prepare('SELECT id FROM games WHERE id = ?').get(input.gameId) as
      | { id: string }
      | undefined
    if (!gameRow) throw new AppError('not_found', 'Игра не найдена в каталоге', { gameId: input.gameId })

    const existing = input.id ? getPlaythrough(conn, input.id) : null
    if (input.id && !existing) throw new AppError('not_found', 'Прохождение не найдено', { id: input.id })
    if (input.startedAt && input.finishedAt && input.finishedAt < input.startedAt) {
      throw new AppError('validation', 'Дата завершения не может быть раньше даты начала')
    }

    const id = existing?.id ?? newId()
    // Сессии — источник истины для часов: введённое вручную число берётся,
    // только пока к прохождению не привязано ни одной сессии.
    const hasSessions = existing ? countSessions(conn, { playthroughId: id }) > 0 : false
    const fields = {
      id,
      gameId: input.gameId,
      number: existing?.number ?? nextPlaythroughNumber(conn, input.gameId),
      title: input.title?.trim() ? input.title.trim() : null,
      platformId: input.platformId ?? null,
      status: input.status,
      isReplay: input.isReplay,
      isMastered: input.isMastered,
      rating: input.rating ?? null,
      playtimeMinutes: hasSessions ? sumMinutesForPlaythrough(conn, id) : input.playtimeMinutes,
      startedAt: input.startedAt ?? null,
      finishedAt: input.finishedAt ?? null,
      notes: input.notes?.trim() ? input.notes.trim() : null,
      now: now()
    }

    if (existing) updatePlaythrough(conn, fields)
    else insertPlaythrough(conn, fields)

    const dto = getPlaythrough(conn, id)
    if (!dto) throw new AppError('unknown', 'Не удалось сохранить прохождение')
    return dto
  })
}

export function removePlaythrough(id: string): void {
  write(PLAYTHROUGH_TABLES, (conn) => {
    deletePlaythroughRow(conn, id)
  })
}
