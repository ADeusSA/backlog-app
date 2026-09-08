import fs from 'node:fs'
import { getDb, write } from '../db/connection'
import { now } from '../db/utils'
import { paths } from '../paths'
import { patchSettings } from './settings.service'
import { seedDemoData } from '../db/seed/demo'
import { updateProfileRow } from '../db/repositories/profile.repo'

/** Мастер первого запуска (ТЗ 05 §8). */

export interface OnboardingState {
  done: boolean
  hasDb: boolean
  dbDate: string | null
  isEmpty: boolean
}

export function getOnboardingState(done: boolean): OnboardingState {
  const dbPath = paths().dbPath
  const hasDb = fs.existsSync(dbPath)
  const dbDate = hasDb ? fs.statSync(dbPath).mtime.toISOString() : null
  const row = getDb().prepare('SELECT COUNT(*) AS c FROM games').get() as { c: number }
  return { done, hasDb, dbDate, isEmpty: row.c === 0 }
}

export function completeOnboarding(input: {
  displayName: string
  avatarImageId?: string | null
  withDemoData: boolean
}): void {
  write(['profile'], (db) => {
    updateProfileRow(
      db,
      {
        displayName: input.displayName,
        ...(input.avatarImageId !== undefined ? { avatarImageId: input.avatarImageId } : {})
      },
      now()
    )
  })
  if (input.withDemoData) seedDemoData()
  patchSettings({ onboardingDone: true })
}
