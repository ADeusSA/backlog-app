import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { HeatmapLabels } from '@/components/ui/heatmap'
import { formatDate, formatPlaytime } from '@/lib/format'

/**
 * Подписи карты активности. Компонент `Heatmap` намеренно не знает про i18n,
 * поэтому названия месяцев и дней недели собираются здесь через `Intl` (10 §2, локализация).
 */
export function useHeatmapLabels(): HeatmapLabels {
  const { t, i18n } = useTranslation()

  return useMemo(() => {
    const locale = i18n.language
    const monthFormat = new Intl.DateTimeFormat(locale, { month: 'short' })
    const weekdayFormat = new Intl.DateTimeFormat(locale, { weekday: 'short' })
    // 2026-06-01 — понедельник; берём его, среду и пятницу.
    const weekdayAt = (offset: number): string =>
      weekdayFormat.format(new Date(Date.UTC(2026, 5, 1 + offset)))

    return {
      months: Array.from({ length: 12 }, (_, index) => monthFormat.format(new Date(Date.UTC(2026, index, 1)))),
      weekdays: [weekdayAt(0), weekdayAt(2), weekdayAt(4)],
      less: t('profile.activity.less'),
      more: t('profile.activity.more'),
      grid: t('profile.activity.gridLabel'),
      cell: (day) =>
        day.sessions === 0
          ? t('profile.activity.cellEmpty', { date: formatDate(day.date) })
          : t('profile.activity.cell', {
              date: formatDate(day.date),
              time: formatPlaytime(day.minutes),
              count: day.sessions
            })
    }
  }, [i18n.language, t])
}
