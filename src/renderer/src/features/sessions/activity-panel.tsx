import type { ReactElement } from 'react'
import { useMemo, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Flame } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { addDays } from '@shared/dates'
import { Chip } from '@/components/ui/chip'
import { Heatmap } from '@/components/ui/heatmap'
import { Segmented } from '@/components/ui/segmented'
import { Skeleton } from '@/components/ui/skeleton'
import { call } from '@/platform/api'
import { formatDate, formatPlaytime } from '@/lib/format'
import { todayLocal } from './fields'
import { useHeatmapLabels } from './use-heatmap-labels'

type Metric = 'minutes' | 'sessions'
/** `rolling` — скользящие 12 месяцев (по умолчанию), иначе календарный год. */
type Period = 'rolling' | number

export interface ActivityPanelProps {
  /** Ограничение по одной игре — карта на странице игры. */
  gameId?: string
  className?: string
}

function rangeOf(period: Period, today: string): { from: string; to: string } {
  if (period === 'rolling') return { from: addDays(today, -364), to: today }
  const year = String(period)
  const isCurrent = today.slice(0, 4) === year
  return { from: `${year}-01-01`, to: isCurrent ? today : `${year}-12-31` }
}

/**
 * Карта активности с тумблером «часы / сессии» (06 §1.9). Используется и в профиле,
 * и на странице игры — во втором случае с фильтром по `gameId`.
 */
export function ActivityPanel({ gameId, className }: ActivityPanelProps): ReactElement {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const labels = useHeatmapLabels()
  const [metric, setMetric] = useState<Metric>('minutes')
  const [period, setPeriod] = useState<Period>('rolling')
  const [selected, setSelected] = useState<string | null>(null)

  const today = todayLocal()
  const range = useMemo(() => rangeOf(period, today), [period, today])

  const { data: activity, isPending } = useQuery({
    queryKey: ['sessions', 'activity', gameId ?? null, range.from, range.to],
    queryFn: () =>
      call('sessions.activity', { from: range.from, to: range.to, ...(gameId ? { gameId } : {}) })
  })

  const { data: daySessions } = useQuery({
    queryKey: ['sessions', 'day', gameId ?? null, selected],
    queryFn: () =>
      call('sessions.list', {
        from: selected!,
        to: selected!,
        limit: 50,
        offset: 0,
        ...(gameId ? { gameId } : {})
      }),
    enabled: Boolean(selected)
  })

  if (isPending || !activity) return <Skeleton className="h-[160px] w-full" />

  const empty = activity.years.length === 0

  return (
    <div className={className}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Segmented<Metric>
          value={metric}
          onChange={setMetric}
          size="sm"
          ariaLabel={t('profile.activity.metric')}
          options={[
            { value: 'minutes', label: t('profile.activity.byHours') },
            { value: 'sessions', label: t('profile.activity.bySessions') }
          ]}
        />
        <span className="flex-1" />
        <Chip selected={period === 'rolling'} onClick={() => setPeriod('rolling')}>
          {t('profile.activity.rolling')}
        </Chip>
        {activity.years.slice(0, 4).map((year) => (
          <Chip key={year} selected={period === year} onClick={() => setPeriod(year)}>
            {year}
          </Chip>
        ))}
      </div>

      <Heatmap
        from={range.from}
        to={range.to}
        days={activity.days}
        metric={metric}
        labels={labels}
        selected={selected}
        onSelect={(date) => setSelected((prev) => (prev === date ? null : date))}
      />

      {empty ? (
        <p className="pt-2 type-small" style={{ color: 'var(--text-3)' }}>
          {t('profile.activity.noSessions')}
        </p>
      ) : (
        <div
          className="flex flex-wrap items-center gap-x-5 gap-y-1 pt-2 type-small"
          style={{ color: 'var(--text-2)' }}
        >
          <span className="flex items-center gap-1.5">
            <Flame size={14} strokeWidth={1.75} style={{ color: 'var(--accent)' }} />
            {t('profile.activity.streak', { count: activity.streak.current })}
          </span>
          <span>{t('profile.activity.longest', { count: activity.streak.longest })}</span>
          <span>{t('profile.activity.days', { count: activity.totals.days })}</span>
          <span>{t('profile.activity.sessionsTotal', { count: activity.totals.sessions })}</span>
          <span className="tabular">
            {t('profile.activity.hoursTotal', {
              time: formatPlaytime(activity.totals.minutes, true)
            })}
          </span>
          {!gameId && <span>{t('profile.activity.games', { count: activity.totals.games })}</span>}
        </div>
      )}

      {selected && (
        <div className="mt-3 rounded-[var(--r-md)] p-3" style={{ background: 'var(--surface-1)' }}>
          <p className="type-caption">{formatDate(selected)}</p>
          {(daySessions?.length ?? 0) === 0 ? (
            <p className="type-small" style={{ color: 'var(--text-3)' }}>
              {t('profile.activity.dayEmpty')}
            </p>
          ) : (
            <ul className="flex flex-col gap-1 pt-1.5">
              {daySessions?.map((session) => (
                <li key={session.id} className="flex items-center gap-2 type-small">
                  <button
                    type="button"
                    className="truncate hover:underline"
                    onClick={() =>
                      void navigate({ to: '/games/$gameId', params: { gameId: session.gameId } })
                    }
                  >
                    {session.gameTitle}
                  </button>
                  <span className="tabular" style={{ color: 'var(--text-2)' }}>
                    {formatPlaytime(session.minutes)}
                  </span>
                  {session.startedAtTime && (
                    <span className="tabular" style={{ color: 'var(--text-3)' }}>
                      {session.startedAtTime}
                    </span>
                  )}
                  {session.note && (
                    <span className="truncate" style={{ color: 'var(--text-3)' }}>
                      {session.note}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
