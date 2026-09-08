import { handle } from './register'
import { completeOnboarding, getOnboardingState } from '../services/onboarding.service'
import { getSettings } from '../services/settings.service'
import { seedDemoData } from '../db/seed/demo'

/** Мастер первого запуска и демо-данные (ТЗ 05 §8). */
export function registerOnboardingIpc(): void {
  handle('onboarding.getState', () => getOnboardingState(getSettings().onboardingDone))

  handle('onboarding.complete', (input) => {
    completeOnboarding({
      displayName: input.displayName,
      withDemoData: input.withDemoData,
      ...(input.avatarImageId !== undefined ? { avatarImageId: input.avatarImageId } : {})
    })
    return { ok: true as const }
  })

  handle('demo.seed', () => seedDemoData())
}
