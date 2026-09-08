import { handle } from './register'
import { getProfile, nowPlayingCards, patchProfile } from '../services/profile.service'
import { getStats } from '../services/stats.service'
import { getRecap } from '../services/recap.service'
import { getActivity } from '../services/activity.service'

/** Профиль, статистика и лента активности (ТЗ 06 §1). */
export function registerProfileIpc(): void {
  handle('profile.get', () => getProfile())
  handle('profile.patch', (patch) => patchProfile(patch))
  handle('stats.get', () => getStats())
  handle('stats.recap', ({ year }) => getRecap(year))
  handle('activity.list', (input) =>
    getActivity({ limit: input?.limit ?? 20, ...(input?.gameId ? { gameId: input.gameId } : {}) })
  )
  handle('profile.nowPlaying', () => nowPlayingCards())
}
