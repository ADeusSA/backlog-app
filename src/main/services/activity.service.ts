/** Запись и чтение ленты активности (02 §3.13, 06 §1.7). */
import type { Db } from '../db/connection'
import { getDb } from '../db/connection'
import { newId, now } from '../db/utils'
import {
  insertActivity,
  listActivity,
  type ListActivityOptions
} from '../db/repositories/activity.repo'
import type { ActivityDto } from '@shared/schema/entities'
import type { ActivityType } from '@shared/constants'

export interface LogActivityInput {
  gameId?: string | null
  entityType?: string | null
  entityId?: string | null
  payload?: Record<string, unknown>
}

/** Пишет запись активности. Вызывается ИЗНУТРИ уже открытой транзакции `write()`. */
export function logActivity(conn: Db, type: ActivityType, input: LogActivityInput = {}): void {
  insertActivity(conn, {
    id: newId(),
    happenedAt: now(),
    type,
    gameId: input.gameId ?? null,
    entityType: input.entityType ?? null,
    entityId: input.entityId ?? null,
    payload: input.payload
  })
}

export function getActivity(opts: ListActivityOptions): ActivityDto[] {
  return listActivity(getDb(), opts)
}
