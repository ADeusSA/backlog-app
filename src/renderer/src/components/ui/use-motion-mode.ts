import { useEffect, useState } from 'react'

/**
 * Вспомогательный хук для JS-анимаций (`motion/react`), которые не могут читать
 * CSS-переменные `--d-*` напрямую (в отличие от CSS-transition/animation).
 * Источник истины — атрибут `[data-motion]` на `<html>` (проставляется приложением,
 * см. 04 §5) и системная настройка `prefers-reduced-motion`. Не экспортируется через
 * CONTRACT.md — внутренняя деталь реализации компонентов из этой папки.
 */
export type MotionMode = 'full' | 'reduced' | 'off'

function computeMotionMode(): MotionMode {
  if (typeof document === 'undefined') return 'full'
  const attr = document.documentElement.getAttribute('data-motion')
  // Явный «full» форсирует полные анимации даже при системном reduced-motion —
  // так же, как это делает медиа-запрос в tokens.css (`:root:not([data-motion='full'])`).
  if (attr === 'full') return 'full'
  const osReduced =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (osReduced) return 'off'
  if (attr === 'reduced') return 'reduced'
  if (attr === 'off') return 'off'
  return 'full'
}

/** Реактивный эффективный режим анимаций для компонента. */
export function useMotionMode(): MotionMode {
  const [mode, setMode] = useState<MotionMode>(() => computeMotionMode())

  useEffect(() => {
    if (typeof document === 'undefined') return
    const html = document.documentElement
    const update = (): void => setMode(computeMotionMode())
    const observer = new MutationObserver(update)
    observer.observe(html, { attributes: true, attributeFilter: ['data-motion'] })
    const mq = typeof window !== 'undefined' ? window.matchMedia('(prefers-reduced-motion: reduce)') : null
    mq?.addEventListener('change', update)
    return () => {
      observer.disconnect()
      mq?.removeEventListener('change', update)
    }
  }, [])

  return mode
}

/** `true`, если JS-анимации должны быть полностью отключены (мгновенно). */
export function useReducedMotion(): boolean {
  return useMotionMode() === 'off'
}

/**
 * Читает текущее значение длительности из CSS-переменной (например `--d-ring`),
 * заведённой в `tokens.css`, и переводит её в секунды для `motion/react`.
 * Так JS-анимация остаётся в синхроне с каскадом `[data-motion]`/`prefers-reduced-motion`
 * без дублирования чисел из словаря движения.
 */
export function readMotionDuration(cssVar: string, fallbackSeconds: number): number {
  if (typeof window === 'undefined' || typeof getComputedStyle !== 'function') return fallbackSeconds
  const raw = getComputedStyle(document.documentElement).getPropertyValue(cssVar).trim()
  if (!raw) return fallbackSeconds
  const value = Number.parseFloat(raw)
  if (Number.isNaN(value)) return fallbackSeconds
  return raw.endsWith('ms') ? value / 1000 : value
}
