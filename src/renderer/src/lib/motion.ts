import type { Transition, Variants } from 'motion/react'

/**
 * Словарь движения (ТЗ 04 §5). Компоненты импортируют отсюда и не задают числа сами.
 * Кривые: standard = cubic-bezier(.2,.7,.2,1), emphasized = cubic-bezier(.2,.8,.2,1).
 */

export const EASE_STANDARD = [0.2, 0.7, 0.2, 1] as const
export const EASE_EMPHASIZED = [0.2, 0.8, 0.2, 1] as const

export const DURATION = {
  micro: 0.12,
  hover: 0.18,
  enter: 0.24,
  page: 0.4,
  ring: 0.9,
  countUp: 0.6,
  bloom: 0.6
} as const

export const transitions = {
  micro: { duration: DURATION.micro, ease: EASE_STANDARD },
  hover: { duration: DURATION.hover, ease: EASE_STANDARD },
  enter: { duration: DURATION.enter, ease: EASE_STANDARD },
  exit: { duration: DURATION.micro, ease: EASE_STANDARD },
  page: { duration: DURATION.page, ease: EASE_EMPHASIZED },
  ring: { duration: DURATION.ring, ease: EASE_EMPHASIZED },
  bloom: { duration: DURATION.bloom, ease: EASE_STANDARD }
} satisfies Record<string, Transition>

/** spring для drag-n-drop и скользящего индикатора сегмента (04 §5). */
export const springDrag = {
  type: 'spring',
  stiffness: 420,
  damping: 34,
  mass: 0.8
} satisfies Transition

/** Вход элементов: opacity 0→1 + translateY(8px→0); выход быстрее и без сдвига. */
export const variants = {
  enter: {
    hidden: { opacity: 0, y: 8 },
    visible: { opacity: 1, y: 0, transition: transitions.enter },
    exit: { opacity: 0, transition: transitions.exit }
  },
  card: {
    hidden: { opacity: 0, y: 8, scale: 0.98 },
    visible: { opacity: 1, y: 0, scale: 1, transition: transitions.enter },
    exit: { opacity: 0, transition: transitions.exit }
  },
  popover: {
    hidden: { opacity: 0, scale: 0.96, y: 6 },
    visible: { opacity: 1, scale: 1, y: 0, transition: transitions.enter },
    exit: { opacity: 0, scale: 0.98, transition: transitions.exit }
  },
  toast: {
    hidden: { opacity: 0, x: 24 },
    visible: { opacity: 1, x: 0, transition: transitions.enter },
    exit: { opacity: 0, transition: { duration: 0.16, ease: EASE_STANDARD } }
  },
  page: {
    hidden: (dir: number) => ({ opacity: 0, x: 12 * dir }),
    visible: { opacity: 1, x: 0, transition: transitions.page },
    exit: (dir: number) => ({ opacity: 0, x: -12 * dir, transition: transitions.exit })
  }
} satisfies Record<string, Variants>

/** Стаггер: 40 мс между первыми 8 элементами, дальше — без задержки (04 §5). */
export function staggerDelay(index: number): number {
  return index < 8 ? index * 0.04 : 0
}

/** FLIP при пересортировке отключается на больших коллекциях (04 §5). */
export const FLIP_LIMIT = 300

/** Порог, после которого анимации перестановки заменяются простым fade. */
export function shouldAnimateLayout(count: number, motionEnabled: boolean): boolean {
  return motionEnabled && count <= FLIP_LIMIT
}

/** Уровень анимаций из настроек / системы. */
export type MotionLevel = 'full' | 'reduced' | 'off'

export function systemPrefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** Эффективный уровень: системная настройка сильнее «полных» анимаций. */
export function effectiveMotion(setting: MotionLevel): MotionLevel {
  if (setting === 'off') return 'off'
  if (systemPrefersReducedMotion()) return 'off'
  return setting
}
