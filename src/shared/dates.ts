/**
 * Арифметика календарных дат 'YYYY-MM-DD'. Общая для main и renderer: по одним и тем же
 * правилам считаются стрики в backend и раскладка карты активности в UI (06 §1.9).
 *
 * Сравнение идёт через `Date.UTC`, чтобы переход на летнее время не давал «полдня разницы»
 * и день не съезжал на соседний.
 */

const DAY_MS = 24 * 60 * 60 * 1000

function toUtcMs(date: string): number {
  const [year, month, day] = date.split('-').map(Number)
  return Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1)
}

/** Разница в днях: `dayDiff('2026-03-02', '2026-03-01') === 1`. */
export function dayDiff(later: string, earlier: string): number {
  return Math.round((toUtcMs(later) - toUtcMs(earlier)) / DAY_MS)
}

export function addDays(date: string, delta: number): string {
  return new Date(toUtcMs(date) + delta * DAY_MS).toISOString().slice(0, 10)
}

/** Понедельник недели, в которую попадает дата, — колонка карты активности. */
export function startOfWeek(date: string): string {
  const weekday = new Date(toUtcMs(date)).getUTCDay() // 0 = воскресенье
  return addDays(date, weekday === 0 ? -6 : -(weekday - 1))
}

/** Номер дня недели: 0 — понедельник, 6 — воскресенье (строка карты активности). */
export function weekdayIndex(date: string): number {
  const weekday = new Date(toUtcMs(date)).getUTCDay()
  return weekday === 0 ? 6 : weekday - 1
}

/** Месяц даты (1–12) — для подписей над картой. */
export function monthOf(date: string): number {
  return Number(date.slice(5, 7))
}
