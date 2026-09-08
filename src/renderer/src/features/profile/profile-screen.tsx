import { useMemo, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Clock3, Dices, ListPlus, Pencil, Plus, Trophy } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { STATUS_ORDER } from '@shared/constants'
import type { GameCardDto } from '@shared/schema/entities'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { CollapsibleSection } from '@/components/ui/collapsible-section'
import { CoverImage } from '@/components/ui/image'
import { ProgressRing } from '@/components/ui/progress-ring'
import { Segmented } from '@/components/ui/segmented'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusDot } from '@/components/ui/status-badge'
import { toast } from '@/components/ui/toast'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { call } from '@/platform/api'
import { formatPlaytime, formatRelative, imageUrl } from '@/lib/format'
import { statusColor } from '@/lib/color'
import { useSettings } from '@/stores/settings-store'
import { useUiStore } from '@/stores/ui-store'
import { formatActivityText } from '@/features/game/activity-text'
import { ActivityPanel } from '@/features/sessions/activity-panel'
import { ProfileEditDialog } from './profile-edit-dialog'

/** Профиль (ТЗ 06 §1). */
export function ProfileScreen(): React.ReactElement {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const settings = useSettings()
  const setAchievementsOpen = useUiStore((s) => s.setAchievementsOpen)
  const [editing, setEditing] = useState(false)
  const [genreMode, setGenreMode] = useState<'count' | 'hours'>('count')

  const { data: profile } = useQuery({ queryKey: ['profile'], queryFn: () => call('profile.get') })
  const { data: stats } = useQuery({ queryKey: ['stats'], queryFn: () => call('stats.get') })
  const { data: nowPlaying } = useQuery({
    queryKey: ['profile', 'nowPlaying'],
    queryFn: () => call('profile.nowPlaying')
  })
  const { data: lists } = useQuery({ queryKey: ['lists'], queryFn: () => call('lists.list') })
  const { data: activity } = useQuery({
    queryKey: ['activity'],
    queryFn: () => call('activity.list', { limit: 20 })
  })
  const { data: achievements } = useQuery({
    queryKey: ['achievements'],
    queryFn: () => call('achievements.get'),
    enabled: settings.showAchievements
  })

  const year = new Date().getFullYear()
  const statusTotal = useMemo(
    () => (stats ? stats.byStatus.reduce((sum, row) => sum + row.count, 0) : 0),
    [stats]
  )

  if (!profile || !stats) {
    return (
      <div className="flex flex-col gap-4 p-6">
        <Skeleton className="h-[160px] w-full" />
        <Skeleton className="h-6 w-1/3" />
      </div>
    )
  }

  const completedTotal = stats.byStatus
    .filter((row) => row.status !== 'wishlist')
    .reduce((sum, row) => sum + row.count, 0)

  return (
    <div className="flex flex-col gap-8 pb-10">
      <header className="relative">
        <div
          className="h-[160px] w-full"
          style={{
            background: profile.bannerFile
              ? `center/cover no-repeat url(${imageUrl(profile.bannerFile)})`
              : 'linear-gradient(120deg, var(--bloom-a), var(--bloom-b))',
            opacity: profile.bannerFile ? 1 : 0.5
          }}
        />
        <div className="flex items-end gap-4 px-6" style={{ marginTop: -40 }}>
          <Avatar name={profile.displayName} src={profile.avatarFile ?? undefined} size={96} />
          <div className="min-w-0 flex-1 pb-1">
            <h1 className="type-h1 truncate">{profile.displayName}</h1>
            {profile.bio && (
              <p className="type-body line-clamp-2" style={{ color: 'var(--text-2)' }}>
                {profile.bio}
              </p>
            )}
            <p className="type-small" style={{ color: 'var(--text-3)' }}>
              {profile.memberSinceYear
                ? t('profile.memberSince', { year: profile.memberSinceYear })
                : ''}
            </p>
          </div>
          {settings.showAchievements && (
            <button
              type="button"
              className="flex items-center gap-2 rounded-[var(--r-pill)] px-3 py-1.5 type-small"
              style={{ background: 'var(--accent-soft)', color: 'var(--text-1)' }}
              onClick={() => setAchievementsOpen(true)}
            >
              <Trophy size={14} strokeWidth={1.75} style={{ color: 'var(--accent)' }} />
              {t('profile.levelBadge', { level: profile.level, title: t(profile.levelTitleKey) })}
            </button>
          )}
          <Button variant="secondary" onClick={() => setEditing(true)}>
            <Pencil size={16} strokeWidth={1.75} />
            {t('profile.editButton')}
          </Button>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3 px-6 md:grid-cols-4">
        <Tile
          label={t('profile.tiles.inLibrary')}
          value={stats.totals.inLibrary}
          onClick={() => void navigate({ to: '/library', search: { status: 'all' } })}
        />
        <Tile
          label={t('profile.tiles.completed')}
          value={stats.totals.completed}
          onClick={() => void navigate({ to: '/library', search: { status: 'completed' } })}
        />
        <Tile
          label={t('profile.tiles.hours')}
          value={Math.round(stats.totals.playtimeMinutes / 60)}
        />
        <Tile
          label={t('profile.tiles.avgRating')}
          value={stats.totals.avgRating ? stats.totals.avgRating.toFixed(1) : '—'}
        />
      </section>

      <section className="flex flex-wrap gap-8 px-6">
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
      </section>

      <section className="flex flex-col gap-3 px-6">
        <h2 className="type-caption">{t('profile.nowPlaying.title')}</h2>
        {(nowPlaying?.length ?? 0) === 0 ? (
          <div className="flex items-center gap-3">
            <p className="type-body" style={{ color: 'var(--text-2)' }}>
              {t('profile.nowPlaying.empty')}
            </p>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                void call('collection.random', {
                  scope: { kind: 'library', status: 'backlog' },
                  filters: {}
                })
                  .then((game) => {
                    if (game) void navigate({ to: '/games/$gameId', params: { gameId: game.id } })
                  })
                  .catch(() => undefined)
              }}
            >
              <Dices size={14} strokeWidth={1.75} />
              {t('profile.nowPlaying.pick')}
            </Button>
          </div>
        ) : (
          <ul className="flex gap-3 overflow-x-auto pb-2">
            {nowPlaying?.map((game) => (
              <li
                key={game.id}
                className="flex w-[280px] shrink-0 gap-3 rounded-[var(--r-md)] p-3"
                style={{ background: 'var(--surface-1)', border: '1px solid var(--border-1)' }}
              >
                <button
                  type="button"
                  onClick={() =>
                    void navigate({ to: '/games/$gameId', params: { gameId: game.id } })
                  }
                >
                  <CoverImage
                    fileName={game.coverFile}
                    title={game.title}
                    dominantColor={game.dominantColor}
                    size={72}
                  />
                </button>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="truncate type-h3">{game.title}</span>
                  <span className="type-small tabular" style={{ color: 'var(--text-2)' }}>
                    {formatPlaytime(game.playtimeMinutes ?? 0)}
                  </span>
                  {game.lastActivityAt && (
                    <span className="type-small" style={{ color: 'var(--text-3)' }}>
                      {t('profile.nowPlaying.lastActivity', {
                        time: formatRelative(game.lastActivityAt)
                      })}
                    </span>
                  )}
                  {game.resumeNote && (
                    <span className="truncate type-small" style={{ color: 'var(--text-2)' }}>
                      {game.resumeNote}
                    </span>
                  )}
                  <div className="flex gap-1.5 pt-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        void call('userGame.addPlaytime', { gameId: game.id, minutes: 60 })
                          .then(() => queryClient.invalidateQueries())
                          .catch((err: Error) => toast({ title: err.message, tone: 'danger' }))
                      }}
                    >
                      <Clock3 size={14} strokeWidth={1.75} />
                      {t('profile.nowPlaying.addTime')}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        void call('userGame.setStatus', { gameId: game.id, status: 'completed' })
                          .then(() => {
                            toast({ title: t('profile.nowPlaying.completed'), tone: 'success' })
                            void queryClient.invalidateQueries()
                          })
                          .catch((err: Error) => toast({ title: err.message, tone: 'danger' }))
                      }}
                    >
                      <Check size={14} strokeWidth={1.75} />
                      {t('profile.nowPlaying.complete')}
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3 px-6">
        <h2 className="type-caption">{t('profile.favorites.title')}</h2>
        <div className="flex gap-3">
          {[0, 1, 2, 3].map((index) => {
            const game = profile.favoriteGames[index] as GameCardDto | undefined
            return game ? (
              <button
                key={game.id}
                type="button"
                onClick={() => void navigate({ to: '/games/$gameId', params: { gameId: game.id } })}
              >
                <CoverImage
                  fileName={game.coverFile}
                  title={game.title}
                  dominantColor={game.dominantColor}
                  size={140}
                />
              </button>
            ) : (
              <button
                key={`empty-${index}`}
                type="button"
                onClick={() => setEditing(true)}
                className="flex items-center justify-center rounded-[var(--r-md)]"
                style={{
                  width: 140,
                  height: 187,
                  background: 'var(--surface-1)',
                  border: '1px dashed var(--border-2)'
                }}
                aria-label={t('profile.favorites.empty')}
              >
                <Plus size={20} strokeWidth={1.75} style={{ color: 'var(--text-3)' }} />
              </button>
            )
          })}
        </div>
      </section>

      <section className="flex flex-col gap-3 px-6">
        <h2 className="type-caption">{t('profile.stats.title')}</h2>

        <CollapsibleSection title={t('profile.stats.byStatus')} defaultOpen storageKey="p.status">
          <div className="flex h-3 w-full overflow-hidden rounded-[var(--r-pill)]">
            {STATUS_ORDER.map((status) => {
              const count = stats.byStatus.find((row) => row.status === status)?.count ?? 0
              if (count === 0 || statusTotal === 0) return null
              return (
                <Tooltip key={status}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      style={{
                        width: `${(count / statusTotal) * 100}%`,
                        background: statusColor(status)
                      }}
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
          <div className="flex flex-wrap gap-3 pt-2">
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
        </CollapsibleSection>

        <CollapsibleSection title={t('profile.stats.byYear')} storageKey="p.byYear">
          <BarList
            items={stats.completedByYear.map((row) => ({
              key: row.year,
              label: row.year,
              value: row.count,
              hint: formatPlaytime(row.playtimeMinutes, true)
            }))}
          />
        </CollapsibleSection>

        <CollapsibleSection title={t('profile.stats.ratings')} storageKey="p.ratings">
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
        </CollapsibleSection>

        <CollapsibleSection title={t('profile.stats.genres')} storageKey="p.genres">
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
        </CollapsibleSection>

        <CollapsibleSection title={t('profile.stats.platforms')} storageKey="p.platforms">
          <BarList
            items={stats.topPlatforms.map((row) => ({
              key: row.id,
              label: row.shortName,
              value: row.count,
              hint: formatPlaytime(row.playtimeMinutes, true)
            }))}
          />
        </CollapsibleSection>

        <CollapsibleSection title={t('profile.stats.studios')} storageKey="p.studios">
          <ul className="flex flex-col gap-1.5">
            {stats.topDevelopers.map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-[var(--r-sm)] px-2 py-1 text-left hover:bg-[var(--surface-1)]"
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
        </CollapsibleSection>

        <CollapsibleSection title={t('profile.stats.hours')} storageKey="p.hours">
          <div className="flex flex-wrap gap-6 pb-2">
            <Stat
              label={t('profile.stats.hours.total')}
              value={formatPlaytime(stats.totals.playtimeMinutes, true)}
            />
            <Stat
              label={t('profile.stats.hours.avgPerGame')}
              value={
                stats.totals.completed > 0
                  ? formatPlaytime(
                      Math.round(stats.totals.playtimeMinutes / stats.totals.completed),
                      true
                    )
                  : '—'
              }
            />
          </div>
          <ul className="flex flex-col gap-1.5">
            {stats.topPlaytime.map((game) => (
              <li key={game.id}>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-[var(--r-sm)] px-2 py-1 text-left hover:bg-[var(--surface-1)]"
                  onClick={() =>
                    void navigate({ to: '/games/$gameId', params: { gameId: game.id } })
                  }
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
        </CollapsibleSection>

        <CollapsibleSection title={t('profile.stats.decades')} storageKey="p.decades">
          <BarList
            items={stats.byDecade.map((row) => ({
              key: String(row.decade),
              label: `${row.decade}-е`,
              value: row.count
            }))}
          />
        </CollapsibleSection>

        {/*
          9. Активность — карта по дням за 12 месяцев и стрики (06 §1.9).
          Ключ хранения новый: под старым у всех уже записано «свёрнуто» — секция была
          заглушкой «появится в следующей версии», и её сворачивали сразу же.
        */}
        <CollapsibleSection
          title={t('profile.stats.activity')}
          defaultOpen
          storageKey="p.activityMap"
        >
          <ActivityPanel />
        </CollapsibleSection>
      </section>

      {settings.showAchievements && achievements && (
        <section className="flex flex-col gap-3 px-6">
          <div className="flex items-center gap-3">
            <h2 className="type-caption flex-1">
              {t('profile.achievements.title')} ·{' '}
              {t('profile.achievements.summary', {
                unlocked: achievements.unlockedCount,
                total: achievements.totalCount
              })}
            </h2>
            <Button variant="ghost" size="sm" onClick={() => setAchievementsOpen(true)}>
              {t('profile.achievements.all')}
            </Button>
          </div>
          <p className="type-small" style={{ color: 'var(--text-2)' }}>
            {t('profile.achievements.toNext', {
              xp: achievements.xp,
              level: achievements.level + 1,
              remaining: achievements.xpToNextLevel
            })}
          </p>
          <div
            className="h-1.5 w-full overflow-hidden rounded-[var(--r-pill)]"
            style={{ background: 'var(--track)' }}
          >
            <div
              className="h-full rounded-[var(--r-pill)]"
              style={{
                width: `${Math.round(achievements.levelProgress * 100)}%`,
                background: 'var(--accent)'
              }}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {achievements.recent.map((item) => (
              <span
                key={item.key}
                className="rounded-[var(--r-pill)] px-3 py-1 type-small"
                style={{ background: 'var(--accent-soft)' }}
              >
                {item.title}
              </span>
            ))}
            {achievements.recent.length === 0 && (
              <span className="type-small" style={{ color: 'var(--text-3)' }}>
                {t('profile.achievements.empty')}
              </span>
            )}
          </div>
        </section>
      )}

      <section className="flex flex-col gap-3 px-6">
        <h2 className="type-caption">{t('profile.lists.title')}</h2>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3">
          {(lists ?? []).map((list) => (
            <button
              key={list.id}
              type="button"
              className="flex items-center gap-3 rounded-[var(--r-md)] p-3 text-left"
              style={{ background: 'var(--surface-1)', border: '1px solid var(--border-1)' }}
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

      <section className="flex flex-col gap-2 px-6">
        <h2 className="type-caption">{t('profile.activity.title')}</h2>
        {(activity?.length ?? 0) === 0 ? (
          <p className="type-small" style={{ color: 'var(--text-3)' }}>
            {t('profile.activity.empty')}
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {activity?.map((entry) => (
              <li key={entry.id} className="flex items-center gap-2 type-small">
                <span className="w-[120px] shrink-0" style={{ color: 'var(--text-3)' }}>
                  {formatRelative(entry.happenedAt)}
                </span>
                {entry.gameTitle && (
                  <button
                    type="button"
                    className="truncate"
                    style={{ color: 'var(--text-1)' }}
                    onClick={() =>
                      entry.gameId &&
                      void navigate({ to: '/games/$gameId', params: { gameId: entry.gameId } })
                    }
                  >
                    {entry.gameTitle}
                  </button>
                )}
                <span style={{ color: 'var(--text-2)' }}>
                  {formatActivityText(t, entry.type, entry.payload)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ProfileEditDialog open={editing} onOpenChange={setEditing} profile={profile} />
    </div>
  )
}

function Tile({
  label,
  value,
  onClick
}: {
  label: string
  value: number | string
  onClick?: () => void
}): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className="flex flex-col gap-1 rounded-[var(--r-md)] p-3 text-left"
      style={{ background: 'var(--surface-1)', border: '1px solid var(--border-1)' }}
    >
      <span className="type-caption">{label}</span>
      <span className="type-h2 tabular">{value}</span>
    </button>
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
}): React.ReactElement {
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

function Stat({ label, value }: { label: string; value: string }): React.ReactElement {
  return (
    <span className="flex flex-col">
      <span className="type-caption">{label}</span>
      <span className="type-h3 tabular">{value}</span>
    </span>
  )
}

/** Горизонтальные бары статистики (06 §1.5). */
function BarList({
  items
}: {
  items: Array<{ key: string; label: string; value: number; hint?: string | undefined }>
}): React.ReactElement {
  const max = Math.max(1, ...items.map((item) => item.value))
  if (items.length === 0)
    return (
      <span className="type-small" style={{ color: 'var(--text-3)' }}>
        —
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
