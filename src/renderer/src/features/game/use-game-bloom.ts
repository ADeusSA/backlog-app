import { useEffect } from 'react'
import { animate } from 'motion/react'
import type { AnimationMode } from '@shared/constants'
import { DEFAULT_BLOOM_A, DEFAULT_BLOOM_B, bloomPair } from '@/lib/color'
import { DURATION, effectiveMotion } from '@/lib/motion'

/**
 * Перекраска фоновых свечений сцены в цвет обложки на странице игры (04 §2.4, §4).
 * Свечения рисует общий `BloomBackdrop` в оболочке приложения — он читает CSS-переменные
 * `--bloom-a`/`--bloom-b` "живьём" через `var()`, поэтому достаточно анимировать сами
 * переменные на `<html>` и вернуть исходные цвета при уходе со страницы — без обращения
 * к компонентам/сторам вне зоны ответственности этого блока.
 */
export function useGameBloom(dominantColor: string | null | undefined, motionSetting: AnimationMode): void {
  useEffect(() => {
    const root = document.documentElement
    const target = bloomPair(dominantColor)
    const durationSeconds = effectiveMotion(motionSetting) === 'off' ? 0 : DURATION.bloom
    const currentA = getComputedStyle(root).getPropertyValue('--bloom-a').trim() || DEFAULT_BLOOM_A
    const currentB = getComputedStyle(root).getPropertyValue('--bloom-b').trim() || DEFAULT_BLOOM_B

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
      animate(target.a, DEFAULT_BLOOM_A, {
        duration: durationSeconds,
        onUpdate: (value: string) => root.style.setProperty('--bloom-a', value)
      })
      animate(target.b, DEFAULT_BLOOM_B, {
        duration: durationSeconds,
        onUpdate: (value: string) => root.style.setProperty('--bloom-b', value)
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dominantColor])
}
