import { handle } from './register'
import {
  getActivitySummary,
  getSessions,
  removeSession,
  saveSession
} from '../services/sessions.service'
import {
  getPlaythroughs,
  removePlaythrough,
  savePlaythrough
} from '../services/playthroughs.service'

/** Журнал сессий и прохождения (ТЗ 02 §3.9, 06 §1.9, 10 §1 итерация 2). */
export function registerSessionsIpc(): void {
  handle('sessions.list', (input) =>
    getSessions({
      limit: input.limit,
      offset: input.offset,
      ...(input.gameId ? { gameId: input.gameId } : {}),
      ...(input.playthroughId ? { playthroughId: input.playthroughId } : {}),
      ...(input.from ? { from: input.from } : {}),
      ...(input.to ? { to: input.to } : {})
    })
  )
  handle('sessions.save', (input) => saveSession(input))
  handle('sessions.delete', (input) => {
    removeSession(input.id)
    return { ok: true as const }
  })
  handle('sessions.activity', (input) =>
    getActivitySummary({
      from: input.from,
      to: input.to,
      ...(input.gameId ? { gameId: input.gameId } : {})
    })
  )

  handle('playthroughs.list', (input) => getPlaythroughs(input.gameId))
  handle('playthroughs.save', (input) => savePlaythrough(input))
  handle('playthroughs.delete', (input) => {
    removePlaythrough(input.id)
    return { ok: true as const }
  })
}
