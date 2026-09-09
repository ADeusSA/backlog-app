import type { ReactElement } from 'react'
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import * as Icons from 'lucide-react'
import { Trophy, type LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { AchievementDto } from '@shared/schema/entities'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ProgressRing } from '@/components/ui/progress-ring'
import { Segmented } from '@/components/ui/segmented'
import { Skeleton } from '@/components/ui/skeleton'
import { call } from '@/platform/api'
import { formatDate } from '@/lib/format'
import { cn } from '@/lib/utils'

type Filter = 'all' | 'unlocked' | 'close'

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII']

/**
 * Вкладка «Достижения» (09 §4): уровень и XP, ближайшие к открытию и вся сетка бейджей.
 * Раньше жила в модальном окне — на отдельном экране бейджам хватает места.
 */
export function ProfileAchievementsTab(): ReactElement {
  const { t } = useTranslation()
  const [filter, setFilter] = useState<Filter>('all')

  const { data } = useQuery({
    queryKey: ['achievements'],
    queryFn: () => call('achievements.get')
  })

  const items = useMemo(() => {
    if (!data) return []
    switch (filter) {
      case 'unlocked':
        return data.all.filter((item) => item.unlockedAt)
      case 'close':
        return data.all
          .filter((item) => !item.unlockedAt && !item.comingSoon && item.progress > 0)
          .sort((a, b) => b.progress / b.threshold - a.progress / a.threshold)
      default:
        return data.all
    }
  }, [data, filter])

  /**
   * Ступени одного достижения называются одинаково («Минус бэклог» ×6), поэтому
   * к каждой добавляем римскую цифру — иначе плитки выглядят дубликатами.
   */
  const tiers = useMemo(() => {
    const byBase = new Map<string, AchievementDto[]>()
    for (const item of data?.all ?? []) {
      const list = byBase.get(item.baseKey) ?? []
      list.push(item)
      byBase.set(item.baseKey, list)
    }
    const result = new Map<string, string>()
    for (const list of byBase.values()) {
      if (list.length < 2) continue
      list
        .slice()
        .sort((a, b) => a.threshold - b.threshold)
        .forEach((item, index) => result.set(item.key, ROMAN[index] ?? String(index + 1)))
    }
    return result
  }, [data])

  if (!data) {
    return (
      <div className="flex flex-col gap-3 px-6">
        <Skeleton className="h-[88px] w-full" />
        <Skeleton className="h-[240px] w-full" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 px-6">
      <section
        className="flex items-center gap-4 rounded-[var(--r-md)] border border-border-1 p-4"
        style={{ background: 'var(--surface-1)' }}
      >
        <div className="min-w-0 flex-1">
          <p className="type-h2">
            {t('achievements.level', { level: data.level, xp: data.xp })} ·{' '}
            <span style={{ color: 'var(--text-2)' }}>{t(data.levelTitleKey)}</span>
          </p>
          <p className="type-small" style={{ color: 'var(--text-2)' }}>
            {t('achievements.toNext', { level: data.level + 1, xp: data.xpToNextLevel })}
          </p>
          <div
            className="mt-2 h-1.5 w-full overflow-hidden rounded-[var(--r-pill)]"
            style={{ background: 'var(--track)' }}
          >
            <div
              className="h-full rounded-[var(--r-pill)]"
              style={{
                width: `${Math.round(data.levelProgress * 100)}%`,
                background: 'var(--accent)',
                transition: 'width var(--d-ring) var(--ease-emphasized)'
              }}
            />
          </div>
        </div>
        <p className="type-small tabular whitespace-nowrap" style={{ color: 'var(--text-2)' }}>
          {t('achievements.summary', { unlocked: data.unlockedCount, total: data.totalCount })}
        </p>
      </section>

      {data.closest.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="type-caption">{t('profile.achievements.closest')}</h2>
          <ul className="grid gap-3 md:grid-cols-3">
            {data.closest.map((item) => (
              <li
                key={item.key}
                className="flex items-center gap-3 rounded-[var(--r-md)] border border-border-1 p-3"
                style={{ background: 'var(--surface-1)' }}
              >
                <ProgressRing done={item.progress} total={item.threshold} size={40} />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate type-body">
                    {t(item.titleKey, { ...item.params, defaultValue: item.title })}
                  </span>
                  <span className="type-small tabular" style={{ color: 'var(--text-2)' }}>
                    {t('achievements.progress', {
                      progress: item.progress,
                      threshold: item.threshold
                    })}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Segmented<Filter>
        className="self-start"
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'all', label: t('achievements.filter.all') },
          { value: 'unlocked', label: t('achievements.filter.unlocked') },
          { value: 'close', label: t('achievements.filter.close') }
        ]}
      />

      <div className="grid grid-cols-[repeat(auto-fill,minmax(104px,1fr))] gap-3">
        {items.map((item) => (
          <AchievementBadge key={item.key} item={item} tier={tiers.get(item.key)} />
        ))}
      </div>
    </div>
  )
}

function AchievementBadge({
  item,
  tier
}: {
  item: AchievementDto
  tier?: string
}): ReactElement {
  const { t } = useTranslation()
  const Icon =
    ((Icons as unknown as Record<string, LucideIcon>)[toPascal(item.icon)] as
      | LucideIcon
      | undefined) ?? Trophy
  const unlocked = Boolean(item.unlockedAt)
  const baseTitle = t(item.titleKey, { ...item.params, defaultValue: item.title })
  const title = tier ? `${baseTitle} ${tier}` : baseTitle
  const description = t(item.descriptionKey, { ...item.params, defaultValue: item.description })

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn('flex w-full min-w-0 flex-col items-center gap-1.5 rounded-[var(--r-md)] p-2 text-center')}
          style={{ background: unlocked ? 'var(--surface-1)' : 'transparent' }}
        >
          <span
            className="relative flex size-[56px] items-center justify-center rounded-full"
            style={{
              background: unlocked
                ? item.baseKey === 'platinum'
                  ? 'var(--success-soft)'
                  : 'var(--accent-soft)'
                : 'var(--surface-2)',
              opacity: item.comingSoon ? 0.5 : 1
            }}
          >
            <Icon
              size={24}
              strokeWidth={1.75}
              style={{ color: unlocked ? 'var(--accent)' : 'var(--text-3)' }}
            />
            {!unlocked && !item.comingSoon && (
              <span className="absolute -bottom-1 -right-1">
                <ProgressRing
                  done={item.progress}
                  total={item.threshold}
                  size={24}
                  showValue={false}
                />
              </span>
            )}
          </span>
          {/* break-words: длинные слова («Мультиплатформенник») вылезали за плитку. */}
          <span
            className="type-small line-clamp-2 w-full break-words"
            style={{ color: unlocked ? 'var(--text-1)' : 'var(--text-3)' }}
          >
            {title}
          </span>
          {item.comingSoon && <span className="type-caption">{t('achievements.comingSoon')}</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[260px]">
        <p className="type-h3">{title}</p>
        <p className="type-small pt-1" style={{ color: 'var(--text-2)' }}>
          {description}
        </p>
        {!item.comingSoon && (
          <p className="type-small tabular pt-2" style={{ color: 'var(--text-3)' }}>
            {t('achievements.progress', { progress: item.progress, threshold: item.threshold })}
          </p>
        )}
        {item.unlockedAt && (
          <p className="type-small pt-1" style={{ color: 'var(--success)' }}>
            {t('achievements.unlockedAt', { date: formatDate(item.unlockedAt) })}
          </p>
        )}
      </PopoverContent>
    </Popover>
  )
}

function toPascal(name: string): string {
  return name
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('')
}
