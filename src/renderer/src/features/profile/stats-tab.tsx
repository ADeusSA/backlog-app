import type { ReactElement, ReactNode } from 'react'
import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { CalendarRange } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { CoverImage } from '@/components/ui/image'
import { ProgressRing } from '@/components/ui/progress-ring'
import { Segmented } from '@/components/ui/segmented'
import { Skeleton } from '@/components/ui/skeleton'
import { call } from '@/platform/api'
import { formatPlaytime } from '@/lib/format'
import { useUiStore } from '@/stores/ui-store'

/**
 * Вкладка «Статистика» (06 §1.5): кольца прогресса и все разрезы, которые не помещаются
 * в обзор. Секции больше не сворачиваются — на отдельном экране они лежат плиткой в две колонки.
 */
export function ProfileStatsTab(): ReactElement {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const setEditing = useUiStore((state) => state.setProfileEditOpen)
  const [genreMode, setGenreMode] = useState<'count' | 'hours'>('count')

  const { data: profile } = useQuery({ queryKey: ['profile'], queryFn: () => call('profile.get') })
  const { data: stats } = useQuery({ queryKey: ['stats'], queryFn: () => call('stats.get') })

  if (!profile || !stats) {
    return (
      <div className="flex flex-col gap-3 px-6">
        <Skeleton className="h-[96px] w-full" />
        <Skeleton className="h-[240px] w-full" />
      </div>
    )
  }

  const year = new Date().getFullYear()
  const completedTotal = stats.byStatus
    .filter((row) => row.status !== 'wishlist')
    .reduce((sum, row) => sum + row.count, 0)

  return (
    <div className="flex flex-col gap-4 px-6">
      <section
        className="flex flex-wrap items-center gap-8 rounded-[var(--r-md)] border border-border-1 p-4"
        style={{ background: 'var(--surface-1)' }}
      >
        <RingBlock
          done={stats.totals.completed}
          total={Math.max(1, completedTotal)}
          label={t('profile.rings.progress')}
        />
        <RingBlock
          done={stats.totals.mastered}
          total={Math.max(1, stats.totals.completed)}
          label={t('profile.rings.mastered')}
          tone="success"
        />
        {profile.yearGoal ? (
          <RingBlock
            done={stats.completedThisYear}
            total={profile.yearGoal}
            label={t('profile.rings.yearGoal', { year })}
          />
        ) : (
          <div className="flex flex-col justify-center">
            <p className="type-h2 tabular">
              {t('profile.rings.thisYear', { count: stats.completedThisYear })}
            </p>
            <button
              type="button"
              className="type-small text-left"
              style={{ color: 'var(--accent)' }}
              onClick={() => setEditing(true)}
            >
              {t('profile.rings.setGoal')}
            </button>
          </div>
        )}
        <Button
          className="ml-auto"
          variant="secondary"
          size="sm"
          onClick={() => void navigate({ to: '/recap/$year', params: { year: String(year) } })}
        >
          <CalendarRange size={14} strokeWidth={1.75} />
          {t('profile.recapLink', { year })}
        </Button>
      </section>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile
          label={t('profile.stats.hours.total')}
          value={formatPlaytime(stats.totals.playtimeMinutes, true)}
        />
        <Tile
          label={t('profile.stats.hours.avgPerGame')}
          value={
            stats.totals.completed > 0
              ? formatPlaytime(Math.round(stats.totals.playtimeMinutes / stats.totals.completed), true)
              : '—'
          }
        />
        <Tile label={t('profile.stats.ratedCount')} value={stats.totals.ratedCount} />
        <Tile
          label={t('profile.tiles.avgRating')}
          value={stats.totals.avgRating ? stats.totals.avgRating.toFixed(1) : '—'}
        />
      </div>

      {/* items-start — иначе соседняя карточка растягивает пустую по высоте. */}
      <div className="grid items-start gap-3 lg:grid-cols-2">
        <Card title={t('profile.stats.byYear')}>
          <BarList
            items={stats.completedByYear.map((row) => ({
              key: row.year,
              label: row.year,
              value: row.count,
              hint: formatPlaytime(row.playtimeMinutes, true)
            }))}
          />
        </Card>

        <Card title={t('profile.stats.ratings')}>
          <p className="type-small pb-2" style={{ color: 'var(--text-2)' }}>
            {t('profile.stats.ratings.summary', {
              avg: stats.totals.avgRating?.toFixed(1) ?? '—',
              count: stats.totals.ratedCount
            })}
          </p>
          <BarList
            items={stats.ratingHistogram.map((row) => ({
              key: String(row.rating),
              label: `${row.rating / 2}★`,
              value: row.count
            }))}
          />
        </Card>

        <Card title={t('profile.stats.genres')}>
          <Segmented
            className="mb-2"
            value={genreMode}
            onChange={(value) => setGenreMode(value as 'count' | 'hours')}
            options={[
              { value: 'count', label: t('profile.stats.genres.byCount') },
              { value: 'hours', label: t('profile.stats.genres.byHours') }
            ]}
          />
          <BarList
            items={stats.topGenres.map((row) => ({
              key: row.id,
              label: row.name,
              value: genreMode === 'count' ? row.count : Math.round(row.playtimeMinutes / 60),
              hint: row.avgRating ? `${row.avgRating.toFixed(1)}` : undefined
            }))}
          />
        </Card>

        <Card title={t('profile.stats.platforms')}>
          <BarList
            items={stats.topPlatforms.map((row) => ({
              key: row.id,
              label: row.shortName,
              value: row.count,
              hint: formatPlaytime(row.playtimeMinutes, true)
            }))}
          />
        </Card>

        <Card title={t('profile.stats.studios')}>
          <ul className="flex flex-col gap-1.5">
            {stats.topDevelopers.map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-[var(--r-sm)] px-2 py-1 text-left hover:bg-[var(--surface-2)]"
                  onClick={() =>
                    void navigate({ to: '/companies/$companyId', params: { companyId: row.id } })
                  }
                >
                  <span className="min-w-0 flex-1 truncate type-body">{row.name}</span>
                  <span className="type-small tabular" style={{ color: 'var(--text-2)' }}>
                    {t('profile.stats.studios.games', { count: row.count })}
                  </span>
                  {row.avgRating && (
                    <span className="type-small tabular" style={{ color: 'var(--success)' }}>
                      {row.avgRating.toFixed(1)}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </Card>

        <Card title={t('profile.stats.hours.top')}>
          <ul className="flex flex-col gap-1.5">
            {stats.topPlaytime.map((game) => (
              <li key={game.id}>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-[var(--r-sm)] px-2 py-1 text-left hover:bg-[var(--surface-2)]"
                  onClick={() => void navigate({ to: '/games/$gameId', params: { gameId: game.id } })}
                >
                  <CoverImage
                    fileName={game.coverFile}
                    title={game.title}
                    dominantColor={game.dominantColor}
                    size={28}
                  />
                  <span className="min-w-0 flex-1 truncate type-body">{game.title}</span>
                  <span className="type-small tabular" style={{ color: 'var(--text-2)' }}>
                    {formatPlaytime(game.playtimeMinutes ?? 0, true)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Card>

        <Card title={t('profile.stats.decades')} className="lg:col-span-2">
          <BarList
            items={stats.byDecade.map((row) => ({
              key: String(row.decade),
              label: t('profile.stats.decade', { decade: row.decade }),
              value: row.count
            }))}
          />
        </Card>
      </div>
    </div>
  )
}

function Card({
  title,
  className,
  children
}: {
  title: string
  className?: string
  children: ReactNode
}): ReactElement {
  return (
    <section
      className={`flex flex-col gap-2 rounded-[var(--r-md)] border border-border-1 p-4 ${className ?? ''}`}
      style={{ background: 'var(--surface-1)' }}
    >
      <h2 className="type-caption">{title}</h2>
      {children}
    </section>
  )
}

function Tile({ label, value }: { label: string; value: number | string }): ReactElement {
  return (
    <div
      className="flex flex-col gap-0.5 rounded-[var(--r-md)] px-3 py-2"
      style={{ background: 'var(--surface-1)', border: '1px solid var(--border-1)' }}
    >
      <span className="type-h3 tabular">{value}</span>
      <span className="type-caption">{label}</span>
    </div>
  )
}

function RingBlock({
  done,
  total,
  label,
  tone
}: {
  done: number
  total: number
  label: string
  tone?: 'accent' | 'success'
}): ReactElement {
  return (
    <div className="flex items-center gap-3">
      <ProgressRing done={done} total={total} size={56} {...(tone ? { tone } : {})} />
      <span className="type-small" style={{ color: 'var(--text-2)' }}>
        <span className="block tabular type-body" style={{ color: 'var(--text-1)' }}>
          {done} / {total}
        </span>
        {label}
      </span>
    </div>
  )
}

/** Горизонтальные бары статистики (06 §1.5). */
function BarList({
  items
}: {
  items: Array<{ key: string; label: string; value: number; hint?: string | undefined }>
}): ReactElement {
  const { t } = useTranslation()
  const max = Math.max(1, ...items.map((item) => item.value))
  if (items.length === 0)
    return (
      <span className="type-small" style={{ color: 'var(--text-3)' }}>
        {t('profile.stats.empty')}
      </span>
    )
  return (
    <ul className="flex flex-col gap-1.5">
      {items.map((item) => (
        <li key={item.key} className="flex items-center gap-3">
          <span
            className="w-[110px] shrink-0 truncate type-small"
            style={{ color: 'var(--text-2)' }}
          >
            {item.label}
          </span>
          <span
            className="h-2 min-w-0 flex-1 overflow-hidden rounded-[var(--r-pill)]"
            style={{ background: 'var(--track)' }}
          >
            <span
              className="block h-full rounded-[var(--r-pill)]"
              style={{ width: `${(item.value / max) * 100}%`, background: 'var(--accent)' }}
            />
          </span>
          <span
            className="w-[64px] shrink-0 text-right type-small tabular"
            style={{ color: 'var(--text-2)' }}
          >
            {item.value}
            {item.hint ? ` · ${item.hint}` : ''}
          </span>
        </li>
      ))}
    </ul>
  )
}
