import type { ReleaseDatePrecision } from '@shared/constants'

/** Форматирование чисел, дат и времени (ТЗ 05 §7). Локаль берётся из i18n. */

let locale: string = 'ru'

export function setFormatLocale(next: string): void {
  locale = next
}

const nf = (): Intl.NumberFormat => new Intl.NumberFormat(locale)

export function formatNumber(value: number): string {
  return nf().format(value)
}

/**
 * Часы: «61 ч 20 мин», в компакте «61 ч», ≥ 1000 — «1 240 ч» (05 §7).
 */
export function formatPlaytime(minutes: number, compact = false): string {
  if (!minutes || minutes <= 0) return compact ? '—' : '0 ч'
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours >= 1000 || compact) return `${formatNumber(hours)} ч`
  if (hours === 0) return `${rest} мин`
  if (rest === 0) return `${hours} ч`
  return `${hours} ч ${rest} мин`
}

/** Дата выхода с учётом точности (06 §6.1): «24 фев 2022», «фев 2022», «2026», «TBA». */
export function formatReleaseDate(
  date: string | null | undefined,
  precision: ReleaseDatePrecision = 'day'
): string {
  if (precision === 'tba' || !date) return 'TBA'
  const [y, m, d] = date.split('-')
  if (!y) return 'TBA'
  if (precision === 'year' || !m) return y
  const monthDate = new Date(Number(y), Number(m) - 1, d ? Number(d) : 1)
  if (precision === 'quarter') {
    const q = Math.floor((Number(m) - 1) / 3) + 1
    return `${q} кв. ${y}`
  }
  if (precision === 'month' || !d) {
    return new Intl.DateTimeFormat(locale, { month: 'short', year: 'numeric' }).format(monthDate)
  }
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(
    monthDate
  )
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(
    date
  )
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date)
}

/** Относительное время: «5 минут назад», «вчера», «3 месяца назад». */
export function formatRelative(value: string | null | undefined): string {
  if (!value) return '—'
  const then = new Date(value).getTime()
  if (Number.isNaN(then)) return '—'
  const diffSec = Math.round((then - Date.now()) / 1000)
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  const table: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ['year', 31536000],
    ['month', 2592000],
    ['week', 604800],
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60]
  ]
  for (const [unit, sec] of table) {
    if (Math.abs(diffSec) >= sec) return rtf.format(Math.round(diffSec / sec), unit)
  }
  return rtf.format(diffSec, 'second')
}

/** Оценка 1–10 → количество звёзд (5 звёзд с половинками, 02 §3.8). */
export function ratingToStars(rating: number | null | undefined): number {
  if (!rating) return 0
  return rating / 2
}

export function starsToRating(stars: number): number {
  return Math.max(1, Math.min(10, Math.round(stars * 2)))
}

export function formatPercent(value: number): string {
  return `${Math.round(value * 100)} %`
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} КБ`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} МБ`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} ГБ`
}

/**
 * URL картинки через собственный протокол (01 §7).
 *
 * Хост всегда `img`, а имя файла целиком уходит в путь. Раньше подпапка была хостом
 * (`backlog-img://01/<id>.webp`), и Chromium разбирал числовой хост как IPv4: `01`
 * превращался в `0.0.0.1`, файл не находился и обложки не отображались никогда —
 * все UUID v7 начинаются с «01».
 */
export function imageUrl(fileName: string | null | undefined): string | null {
  if (!fileName) return null
  return `backlog-img://img/${fileName}`
}
