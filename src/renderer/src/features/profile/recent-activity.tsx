import type { ReactElement } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { call } from '@/platform/api'
import { ActivityEntry } from './activity-entry'

const RAIL_LIMIT = 15

/**
 * «Недавняя активность» в правой колонке обзора (06 §1.7).
 * Заголовок — ссылка на вкладку со всей лентой.
 */
export function RecentActivity(): ReactElement {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const { data: activity } = useQuery({
    queryKey: ['activity', 'rail'],
    queryFn: () => call('activity.list', { limit: RAIL_LIMIT })
  })

  return (
    <section
      className="flex flex-col gap-2 rounded-[var(--r-md)] border border-border-1 p-4"
      style={{ background: 'var(--surface-1)' }}
    >
      <button
        type="button"
        className="flex items-center gap-1 self-start rounded-[var(--r-sm)] type-caption outline-none hover:text-[var(--text-1)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)]"
        onClick={() => void navigate({ to: '/profile/activity' })}
      >
        {t('profile.feed.title')}
        <ChevronRight size={14} strokeWidth={1.75} />
      </button>

      {(activity?.length ?? 0) === 0 ? (
        <p className="type-small" style={{ color: 'var(--text-3)' }}>
          {t('profile.feed.empty')}
        </p>
      ) : (
        // Лента длиннее левой колонки бенто — прокручиваем её внутри плитки,
        // иначе под «Сейчас играю» остаётся пустая полоса в половину экрана.
        <ul className="-mx-2 flex max-h-[560px] flex-col overflow-y-auto">
          {activity?.map((entry) => (
            <ActivityEntry key={entry.id} entry={entry} variant="rail" />
          ))}
        </ul>
      )}
    </section>
  )
}
