/**
 * Стрики журнала сессий (09 §3 «Стрик», 06 §1.9). Чистые функции без обращения к базе.
 * Арифметика дат — в `@shared/dates`: те же правила использует раскладка карты активности в UI.
 */
import { dayDiff } from '@shared/dates'

function uniqueSorted(days: string[]): string[] {
  return [...new Set(days)].sort()
}

/**
 * Текущая серия: дни подряд, заканчивающиеся сегодня или вчера.
 * Незаконченный сегодняшний день серию не рвёт — так же ведёт себя GitHub.
 */
export function currentStreak(days: string[], today: string): number {
  const sorted = uniqueSorted(days)
  const last = sorted[sorted.length - 1]
  if (!last) return 0
  const gap = dayDiff(today, last)
  if (gap < 0 || gap > 1) return 0

  let streak = 1
  for (let i = sorted.length - 1; i > 0; i -= 1) {
    if (dayDiff(sorted[i]!, sorted[i - 1]!) !== 1) break
    streak += 1
  }
  return streak
}

/** Самая длинная серия за всю историю — достижение «Стрик» его не теряет (09 §1). */
export function longestStreak(days: string[]): number {
  const sorted = uniqueSorted(days)
  let best = 0
  let run = 0
  for (let i = 0; i < sorted.length; i += 1) {
    run = i > 0 && dayDiff(sorted[i]!, sorted[i - 1]!) === 1 ? run + 1 : 1
    if (run > best) best = run
  }
  return best
}
