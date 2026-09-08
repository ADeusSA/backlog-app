import type { GameStatus } from '@shared/constants'
import { STATUS_META } from '@shared/constants'

/** Цветовые утилиты Aurora (ТЗ 04 §2.3–2.4, §9). */

export interface Hsl {
  h: number
  s: number
  l: number
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m?.[1]) return null
  const int = Number.parseInt(m[1], 16)
  return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 }
}

export function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (n: number): number => Math.max(0, Math.min(255, Math.round(n)))
  return `#${((clamp(r) << 16) | (clamp(g) << 8) | clamp(b)).toString(16).padStart(6, '0')}`
}

export function hexToHsl(hex: string): Hsl | null {
  const rgb = hexToRgb(hex)
  if (!rgb) return null
  const r = rgb.r / 255
  const g = rgb.g / 255
  const b = rgb.b / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return { h: 0, s: 0, l }
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h: number
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6
  else if (max === g) h = ((b - r) / d + 2) / 6
  else h = ((r - g) / d + 4) / 6
  return { h: h * 360, s, l }
}

export function hslToHex({ h, s, l }: Hsl): string {
  const hue = ((h % 360) + 360) % 360
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1))
  const m = l - c / 2
  let rgb: [number, number, number]
  if (hue < 60) rgb = [c, x, 0]
  else if (hue < 120) rgb = [x, c, 0]
  else if (hue < 180) rgb = [0, c, x]
  else if (hue < 240) rgb = [0, x, c]
  else if (hue < 300) rgb = [x, 0, c]
  else rgb = [c, 0, x]
  return rgbToHex((rgb[0] + m) * 255, (rgb[1] + m) * 255, (rgb[2] + m) * 255)
}

export const DEFAULT_BLOOM_A = '#4b3bc7'
export const DEFAULT_BLOOM_B = '#0f7c6e'
/** Те же оттенки, но в светлоте светлой темы (04 §8) — значения из `tokens.css`. */
export const LIGHT_BLOOM_A = '#b3a6f5'
export const LIGHT_BLOOM_B = '#7fd0c4'

type BloomTheme = 'dark' | 'light'

/** Границы светлоты свечения: тёмная сцена требует приглушённых, светлая — бледных (04 §2.4, §8). */
const BLOOM_RANGE: Record<BloomTheme, { s: [number, number]; l: [number, number] }> = {
  dark: { s: [0.4, 0.62], l: [0.28, 0.4] },
  light: { s: [0.35, 0.55], l: [0.55, 0.7] }
}

export function defaultBloom(theme: BloomTheme = 'dark'): { a: string; b: string } {
  return theme === 'light'
    ? { a: LIGHT_BLOOM_A, b: LIGHT_BLOOM_B }
    : { a: DEFAULT_BLOOM_A, b: DEFAULT_BLOOM_B }
}

/**
 * Ограничение насыщенности и светлоты свечения (04 §2.4).
 * Слишком светлые обложки (l > 0.7) в тёмной теме дают палитру по умолчанию,
 * чтобы не «засветить» экран; в светлой так же поступают слишком тёмные (l < 0.15).
 */
export function clampBloom(hex: string | null | undefined, theme: BloomTheme = 'dark'): string {
  const fallback = defaultBloom(theme).a
  if (!hex) return fallback
  const hsl = hexToHsl(hex)
  if (!hsl) return fallback
  if (theme === 'dark' ? hsl.l > 0.7 : hsl.l < 0.15) return fallback
  const range = BLOOM_RANGE[theme]
  return hslToHex({
    h: hsl.h,
    s: Math.min(range.s[1], Math.max(range.s[0], hsl.s)),
    l: Math.min(range.l[1], Math.max(range.l[0], hsl.l))
  })
}

/** Второе свечение — тот же оттенок со сдвигом −40° (04 §2.4). */
export function bloomPair(
  hex: string | null | undefined,
  theme: BloomTheme = 'dark'
): { a: string; b: string } {
  const fallback = defaultBloom(theme)
  if (!hex) return fallback
  const a = clampBloom(hex, theme)
  if (a === fallback.a) return fallback
  const hsl = hexToHsl(a)
  if (!hsl) return { a, b: fallback.b }
  return { a, b: hslToHex({ ...hsl, h: hsl.h - 40 }) }
}

/** CSS-переменная цвета статуса. */
export function statusColor(status: GameStatus | null | undefined): string {
  if (!status) return 'var(--text-3)'
  return `var(${STATUS_META[status].colorVar})`
}

export function statusOnColor(status: GameStatus): string {
  return `var(${STATUS_META[status].colorVar}-on)`
}

/**
 * Подкраска карточки цветом статуса (04 §1 правило 3, §2.3):
 * 12 % в покое, 18 % на hover, граница 26 %.
 */
export function cardTint(status: GameStatus | null | undefined, hovered = false): string {
  if (!status) return 'var(--surface-1)'
  const pct = hovered ? 18 : 12
  return `color-mix(in srgb, ${statusColor(status)} ${pct}%, var(--surface-1))`
}

export function cardBorder(status: GameStatus | null | undefined): string {
  if (!status) return 'var(--border-1)'
  return `color-mix(in srgb, ${statusColor(status)} 26%, transparent)`
}

/** Цвет плашки Metacritic: ≥75 зелёный, 50–74 жёлтый, <50 красный (04 §2.3). */
export function metacriticColor(score: number): string {
  if (score >= 75) return 'var(--mc-good)'
  if (score >= 50) return 'var(--mc-mixed)'
  return 'var(--mc-bad)'
}

/** Яркость цвета 0..1 — для выбора подложки под тёмные логотипы (04 §6). */
export function luminance(hex: string): number {
  const rgb = hexToRgb(hex)
  if (!rgb) return 0
  return (0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b) / 255
}

/**
 * Доминирующий цвет из ImageData: 8×8 даунсэмпл, почти-чёрные и почти-белые отбрасываются
 * (01 §7). Возвращает `#RRGGBB` либо null, если картинка «серая».
 */
export function dominantColor(data: Uint8ClampedArray): string | null {
  let r = 0
  let g = 0
  let b = 0
  let count = 0
  for (let i = 0; i < data.length; i += 4) {
    const pr = data[i] ?? 0
    const pg = data[i + 1] ?? 0
    const pb = data[i + 2] ?? 0
    const pa = data[i + 3] ?? 0
    if (pa < 128) continue
    const max = Math.max(pr, pg, pb)
    const min = Math.min(pr, pg, pb)
    if (max < 32 || min > 224) continue
    if (max - min < 12) continue
    r += pr
    g += pg
    b += pb
    count += 1
  }
  if (count === 0) return null
  return rgbToHex(r / count, g / count, b / count)
}
