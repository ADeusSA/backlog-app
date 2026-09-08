import { useEffect } from 'react'
import { animate } from 'motion/react'
import type { AnimationMode } from '@shared/constants'
import { bloomPair, defaultBloom } from '@/lib/color'
import { resolveTheme, type ThemeSetting } from '@/lib/theme'
import { DURATION, effectiveMotion } from '@/lib/motion'

/**
 * Перекраска фоновых свечений сцены в цвет обложки на странице игры (04 §2.4, §4).
 * Свечения рисует общий `BloomBackdrop` в оболочке приложения — он читает CSS-переменные
 * `--bloom-a`/`--bloom-b` "живьём" через `var()`, поэтому достаточно анимировать сами
 * переменные на `<html>` и вернуть исходные цвета при уходе со страницы — без обращения
 * к компонентам/сторам вне зоны ответственности этого блока.
 */
export function useGameBloom(
  dominantColor: string | null | undefined,
  motionSetting: AnimationMode,
  themeSetting: ThemeSetting
): void {
  useEffect(() => {
    const root = document.documentElement
    // Границы светлоты и цвета «по умолчанию» разные у тёмной и светлой сцены (04 §8).
    const theme = resolveTheme(themeSetting)
    const base = defaultBloom(theme)
    const target = bloomPair(dominantColor, theme)
    const durationSeconds = effectiveMotion(motionSetting) === 'off' ? 0 : DURATION.bloom
    const currentA = getComputedStyle(root).getPropertyValue('--bloom-a').trim() || base.a
    const currentB = getComputedStyle(root).getPropertyValue('--bloom-b').trim() || base.b

    const inA = animate(currentA, target.a, {
      duration: durationSeconds,
      onUpdate: (value: string) => root.style.setProperty('--bloom-a', value)
    })
    const inB = animate(currentB, target.b, {
      duration: durationSeconds,
      onUpdate: (value: string) => root.style.setProperty('--bloom-b', value)
    })

    return () => {
      inA.stop()
      inB.stop()
      // Возврат к сцене: анимация в цвет темы, затем инлайновые значения снимаются,
      // иначе смена темы оставила бы на <html> свечения предыдущей.
      animate(target.a, base.a, {
        duration: durationSeconds,
        onUpdate: (value: string) => root.style.setProperty('--bloom-a', value),
        onComplete: () => root.style.removeProperty('--bloom-a')
      })
      animate(target.b, base.b, {
        duration: durationSeconds,
        onUpdate: (value: string) => root.style.setProperty('--bloom-b', value),
        onComplete: () => root.style.removeProperty('--bloom-b')
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dominantColor, themeSetting])
}
