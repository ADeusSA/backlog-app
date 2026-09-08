import { handle } from './register'
import {
  addPlaytime,
  addToLibrary,
  bulkStatus,
  bulkTags,
  getUserGame,
  patchUserGame,
  removeFromLibrary,
  setStatus,
  setTags
} from '../services/user-game.service'

/** Каналы пользовательских данных по игре (02 §3.8, 06 §6.2). */
export function registerUserGameIpc(): void {
  handle('userGame.get', (input) => getUserGame(input.gameId))
  handle('userGame.setStatus', (input) => setStatus(input.gameId, input.status))
  handle('userGame.patch', (input) => patchUserGame(input.gameId, input.patch))
  handle('userGame.addToLibrary', (input) => {
    addToLibrary(input.gameIds, input.status)
    return { ok: true as const }
  })
  handle('userGame.removeFromLibrary', (input) => {
    removeFromLibrary(input.gameIds)
    return { ok: true as const }
  })
  handle('userGame.addPlaytime', (input) => addPlaytime(input.gameId, input.minutes))
  handle('userGame.bulkStatus', (input) => {
    bulkStatus(input.gameIds, input.status)
    return { ok: true as const }
  })
  handle('userGame.setTags', (input) => setTags(input.gameId, input.tagIds))
  handle('userGame.bulkTags', (input) => {
    bulkTags(input.gameIds, input.addTagIds, input.removeTagIds)
    return { ok: true as const }
  })
}
