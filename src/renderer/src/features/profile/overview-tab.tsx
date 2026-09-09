import type { ReactElement, ReactNode } from 'react'
import { useMemo } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { ListPlus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { STATUS_ORDER } from '@shared/constants'
import type { Stats } from '@shared/schema/entities'
import { ProgressRing } from '@/components/ui/progress-ring'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusDot } from '@/components/ui/status-badge'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { call } from '@/platform/api'
import { statusColor } from '@/lib/color'
import { cn } from '@/lib/utils'
import { ActivityPanel } from '@/features/sessions/activity-panel'
import { FavoritesStrip } from './favorites-strip'
import { NowPlaying } from './now-playing'
import { RecentActivity } from './recent-activity'

/**
 * Вкладка «Обзор» (06 §1): плитки-метрики, «Сейчас играю» и карта активности слева,
 * лента недавней активности справа, ниже — топ любимых, статусы и списки.
 */
export function ProfileOverviewTab(): ReactElement {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const { data: profile } = useQuery({ queryKey: ['profile'], queryFn: () => call('profile.get') })
  const { data: stats } = useQuery({ queryKey: ['stats'], queryFn: () => call('stats.get') })
  const { data: lists } = useQuery({ queryKey: ['lists'], queryFn: () => call('lists.list') })

  if (!profile || !stats) {
    return (
      <div className="flex flex-col gap-3 px-6">
        <Skeleton className="h-[72px] w-full" />
        <Skeleton className="h-[240px] w-full" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 px-6">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,320px)]">
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Metric
              label={t('profile.tiles.inLibrary')}
              value={stats.totals.inLibrary}
              onClick={() => void navigate({ to: '/library', search: { status: 'all' } })}
            />
            <Metric
              label={t('profile.tiles.completed')}
              value={stats.totals.completed}
              onClick={() => void navigate({ to: '/library', search: { status: 'completed' } })}
            />
            <Metric
              label={t('profile.tiles.hours')}
              value={Math.round(stats.totals.playtimeMinutes / 60)}
            />
            <Metric
              label={t('profile.tiles.avgRating')}
              value={stats.totals.avgRating ? stats.totals.avgRating.toFixed(1) : '—'}
            />
          </div>

          <Card>
            <NowPlaying />
          </Card>

          <Card>
            <h2 className="type-caption">{t('profile.stats.activity')}</h2>
            <ActivityPanel />
          </Card>
        </div>

        <RecentActivity />
      </div>

      <FavoritesStrip games={profile.favoriteGames} />

      <Card>
        <h2 className="type-caption">{t('profile.stats.byStatus')}</h2>
        <StatusBar stats={stats} />
      </Card>

      <section className="flex flex-col gap-3">
        <h2 className="type-caption">{t('profile.lists.title')}</h2>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3">
          {(lists ?? []).map((list) => (
            <button
              key={list.id}
              type="button"
              className="flex items-center gap-3 rounded-[var(--r-md)] p-3 text-left transition-[background,border-color] hover:bg-[var(--surface-2)]"
              style={{
                background: 'var(--surface-1)',
                border: '1px solid var(--border-1)',
                transitionDuration: 'var(--d-hover)'
              }}
              onClick={() => void navigate({ to: '/lists/$listId', params: { listId: list.id } })}
            >
              <ProgressRing
                done={list.completedCount}
                total={Math.max(1, list.gameCount)}
                size={40}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate type-h3">{list.name}</span>
                <span className="block type-small" style={{ color: 'var(--text-2)' }}>
                  {t('profile.lists.games', { count: list.gameCount })}
                </span>
              </span>
            </button>
          ))}
          <button
            type="button"
            className="flex items-center justify-center gap-2 rounded-[var(--r-md)] p-3 type-body"
            style={{
              background: 'var(--surface-1)',
              border: '1px dashed var(--border-2)',
              color: 'var(--text-2)'
            }}
            onClick={() => void navigate({ to: '/lists' })}
          >
            <ListPlus size={16} strokeWidth={1.75} />
            {t('profile.lists.new')}
          </button>
        </div>
      </section>
    </div>
  )
}

/** Плитка бенто: рамка и поверхность одинаковы у всех виджетов обзора. */
function Card({ children, className }: { children: ReactNode; className?: string }): ReactElement {
  return (
    <section
      className={cn('flex flex-col gap-3 rounded-[var(--r-md)] border border-border-1 p-4', className)}
      style={{ background: 'var(--surface-1)' }}
    >
      {children}
    </section>
  )
}

/** Компактная плитка быстрой статистики (06 §1.1). */
function Metric({
  label,
  value,
  onClick
}: {
  label: string
  value: number | string
  onClick?: () => void
}): ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        'flex flex-col gap-0.5 rounded-[var(--r-md)] px-3 py-2 text-left transition-[background]',
        onClick && 'hover:bg-[var(--surface-2)]'
      )}
      style={{
        background: 'var(--surface-1)',
        border: '1px solid var(--border-1)',
        transitionDuration: 'var(--d-hover)'
      }}
    >
      <span className="type-h3 tabular">{value}</span>
      <span className="type-caption">{label}</span>
    </button>
  )
}

/** Полоса статусов с легендой (06 §1.5 п.1). */
function StatusBar({ stats }: { stats: Stats }): ReactElement {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const total = useMemo(
    () => stats.byStatus.reduce((sum, row) => sum + row.count, 0),
    [stats.byStatus]
  )

  return (
    <>
      <div className="flex h-3 w-full overflow-hidden rounded-[var(--r-pill)]">
        {STATUS_ORDER.map((status) => {
          const count = stats.byStatus.find((row) => row.status === status)?.count ?? 0
          if (count === 0 || total === 0) return null
          return (
            <Tooltip key={status}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  style={{ width: `${(count / total) * 100}%`, background: statusColor(status) }}
                  onClick={() => void navigate({ to: '/library', search: { status } })}
                  aria-label={t(`statusPlural.${status}`)}
                />
              </TooltipTrigger>
              <TooltipContent>
                {t(`statusPlural.${status}`)}: {count}
              </TooltipContent>
            </Tooltip>
          )
        })}
      </div>
      <div className="flex flex-wrap gap-3">
        {STATUS_ORDER.map((status) => {
          const count = stats.byStatus.find((row) => row.status === status)?.count ?? 0
          return (
            <span
              key={status}
              className="flex items-center gap-1.5 type-small"
              style={{ color: 'var(--text-2)' }}
            >
              <StatusDot status={status} size="sm" />
              {t(`statusPlural.${status}`)} <span className="tabular">{count}</span>
            </span>
          )
        })}
      </div>
    </>
  )
}
