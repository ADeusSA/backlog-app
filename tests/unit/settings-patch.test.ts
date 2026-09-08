import { describe, expect, it } from 'vitest'
import { settingsPatchSchema, settingsSchema, DEFAULT_SETTINGS } from '../../src/shared/schema/settings'

/**
 * Регрессия: `settingsSchema.partial()` подставлял значения по умолчанию для всех полей,
 * и любое сохранение настройки сбрасывало `onboardingDone` (снова показывался мастер
 * первого запуска) и язык. Патч обязан содержать только переданные ключи.
 */
describe('settingsPatchSchema', () => {
  it('не подставляет значения по умолчанию для непереданных полей', () => {
    const patch = settingsPatchSchema.parse({ sidebarCollapsed: false })
    expect(Object.keys(patch)).toEqual(['sidebarCollapsed'])
    expect(patch).not.toHaveProperty('onboardingDone')
    expect(patch).not.toHaveProperty('locale')
  })

  it('смена языка не тянет за собой другие ключи', () => {
    const patch = settingsPatchSchema.parse({ locale: 'en' })
    expect(patch).toEqual({ locale: 'en' })
  })

  it('вложенные объекты можно передавать частично', () => {
    const patch = settingsPatchSchema.parse({ sync: { mode: 'manual' } })
    expect(patch).toEqual({ sync: { mode: 'manual' } })
  })

  it('полная схема по-прежнему заполняет значения по умолчанию', () => {
    expect(settingsSchema.parse({})).toEqual(DEFAULT_SETTINGS)
    expect(DEFAULT_SETTINGS.onboardingDone).toBe(false)
    expect(DEFAULT_SETTINGS.locale).toBe('ru')
  })

  it('отвергает неизвестные значения перечислений', () => {
    expect(() => settingsPatchSchema.parse({ locale: 'de' })).toThrow()
  })
})
