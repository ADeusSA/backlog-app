import { handle } from './register'
import { onAppEvent } from '../events'
import { getAchievementsSummary, recomputeAchievements, shouldRecompute } from '../achievements/service'
import { getSettings } from '../services/settings.service'
import { log } from '../log'

let recomputing = false

/** Пересчёт после коммита транзакции (ТЗ 09 §5), без повторного входа. */
function safeRecompute(): void {
  if (recomputing) return
  recomputing = true
  try {
    recomputeAchievements()
  } catch (err) {
    log.error('[achievements] пересчёт не удался', err)
  } finally {
    recomputing = false
  }
}

export function registerAchievementsIpc(): void {
  handle('achievements.get', () => getAchievementsSummary())

  handle('achievements.recompute', () => {
    safeRecompute()
    return getAchievementsSummary()
  })

  onAppEvent((event) => {
    if (event.type !== 'dbChanged') return
    if (!getSettings().showAchievements) return
    if (!shouldRecompute(event.tables)) return
    safeRecompute()
  })
}
