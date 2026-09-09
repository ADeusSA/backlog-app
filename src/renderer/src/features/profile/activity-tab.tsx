import type { ReactElement } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ACTIVITY_CATEGORY_KEYS, type ActivityCategory } from '@shared/constants'
import { addDays } from '@shared/dates'
import type { ActivityDto } from '@shared/schema/entities'
import { Chip } from '@/components/ui/chip'
import { Skeleton } from '@/components/ui/skeleton'
import { call } from '@/platform/api'
import { formatDate } from '@/lib/format'
import { todayLocal } from '@/features/sessions/fields'
import { ActivityEntry } from './activity-entry'

/** Сколько записей тянем за раз (06 §1.7). */
const PAGE_SIZE = 100

type Filter = ActivityCategory | 'all'

function dayKey(iso: string): string {
  const date = new Date(iso)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

/** Экран «Активность»: вся лента от новой записи к старой с бесконечной подгрузкой (06 §1.7). */
export function ProfileActivityTab(): ReactElement {
  const { t } = useTranslation()
  const [filter, setFilter] = useState<Filter>('all')
  const sentinel = useRef<HTMLDivElement>(null)

  const { data, isPending, hasNextPage, isFetchingNextPage, fetchNextPage } = useInfiniteQuery({
    queryKey: ['activity', 'full', filter],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      call('activity.list', {
        limit: PAGE_SIZE,
        ...(filter === 'all' ? {} : { category: filter }),
        ...(pageParam ? { cursor: pageParam } : {})
      }),
    getNextPageParam: (lastPage: ActivityDto[]) => {
      if (lastPage.length < PAGE_SIZE) return undefined
      const last = lastPage[lastPage.length - 1]
      return last ? `${last.happenedAt}|${last.id}` : undefined
    }
  })

  const entries = useMemo(() => (data?.pages ?? []).flat(), [data])

  const days = useMemo(() => {
    const groups: Array<{ key: string; items: ActivityDto[] }> = []
    for (const entry of entries) {
      const key = dayKey(entry.happenedAt)
      const current = groups[groups.length - 1]
      if (current && current.key === key) current.items.push(entry)
      else groups.push({ key, items: [entry] })
    }
    return groups
  }, [entries])

  // Бесконечный скролл: подгружаем, как только маркер в конце ленты попал во вьюпорт.
  useEffect(() => {
    const element = sentinel.current
    if (!element || !hasNextPage) return
    const observer = new IntersectionObserver((records) => {
      if (records.some((record) => record.isIntersecting) && !isFetchingNextPage) {
        void fetchNextPage()
      }
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  const today = todayLocal()
  const dayLabel = (key: string): string => {
    if (key === today) return t('profile.feed.today')
    if (key === addDays(today, -1)) return t('profile.feed.yesterday')
    return formatDate(key)
  }

  return (
    // Лента читается построчно, поэтому ограничиваем ширину: иначе время события
    // уезжает к правому краю широкого окна и отрывается от текста.
    <div className="flex w-full max-w-[960px] flex-col gap-4 px-6">
      <div className="flex flex-wrap gap-2">
        <Chip selected={filter === 'all'} onClick={() => setFilter('all')}>
          {t('profile.feed.filter.all')}
        </Chip>
        {ACTIVITY_CATEGORY_KEYS.map((category) => (
          <Chip
            key={category}
            selected={filter === category}
            onClick={() => setFilter(category)}
          >
            {t(`profile.feed.filter.${category}`)}
          </Chip>
        ))}
      </div>

      {isPending ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : entries.length === 0 ? (
        <p className="type-small" style={{ color: 'var(--text-3)' }}>
          {t('profile.feed.empty')}
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {days.map((day) => (
            <section key={day.key} className="flex flex-col gap-1">
              <h2
                className="sticky top-0 z-10 py-1 type-caption"
                style={{ background: 'var(--bg-0)' }}
              >
                {dayLabel(day.key)}
              </h2>
              <ul className="-mx-2 flex flex-col">
                {day.items.map((entry) => (
                  <ActivityEntry key={entry.id} entry={entry} variant="full" />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <div ref={sentinel} className="h-8">
        {isFetchingNextPage && (
          <p className="type-small" style={{ color: 'var(--text-3)' }}>
            {t('common.loading')}
          </p>
        )}
      </div>
    </div>
  )
}
