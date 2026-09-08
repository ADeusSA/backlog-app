import { useMemo } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Cloud, Database, Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { DEFAULT_SORT_DIR, type GameStatus, type GroupByField } from '@shared/constants'
import type { Sort } from '@shared/schema/filters'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { toast } from '@/components/ui/toast'
import { GameCollectionView } from '@/features/collection/game-collection-view'
import { call } from '@/platform/api'
import { useSyncStore } from '@/stores/sync-store'

/** Библиотека и её разрезы по статусам (ТЗ 06 §2, 07 §9). */
export function LibraryScreen(): React.ReactElement {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const search = useSearch({ strict: false }) as { status?: GameStatus | 'all' }
  const status = search.status ?? 'all'
  const syncState = useSyncStore((s) => s.state)

  const { data: stats } = useQuery({ queryKey: ['stats'], queryFn: () => call('stats.get') })
  // Пусто — когда нет ни одной записи вообще; «Хочу» тоже показывается в библиотеке.
  const libraryEmpty = stats?.totals.all === 0

  // Для «Бэклога» — сортировка и группировка по приоритету, для «Пройдено» —
  // группировка по году завершения (06 §2).
  const { sort, groupBy } = useMemo<{ sort: Sort; groupBy: GroupByField }>(() => {
    if (status === 'backlog') {
      return { sort: { field: 'priority', dir: 'desc' }, groupBy: 'priority' }
    }
    if (status === 'completed') {
      return { sort: { field: 'finished_at', dir: 'desc' }, groupBy: 'finished_year' }
    }
    return { sort: { field: 'added_at', dir: DEFAULT_SORT_DIR.added_at }, groupBy: 'none' }
  }, [status])

  const title = status === 'all' ? t('nav.library') : t(`statusPlural.${status}`)

  if (libraryEmpty) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <EmptyState
          icon={<Database size={24} strokeWidth={1.75} />}
          title={t('empty.library')}
          description={t('empty.libraryHint')}
          action={{
            label: t('library.addGame'),
            onClick: () => void navigate({ to: '/catalog/$entity/new', params: { entity: 'games' } })
          }}
        />
        <div className="flex flex-col gap-2 pl-6">
          <Button
            variant="secondary"
            onClick={() => {
              void call('demo.seed')
                .then((result) => toast({ title: t('library.demoAdded', { count: result.games }), tone: 'success' }))
                .catch((err: Error) => toast({ title: err.message, tone: 'danger' }))
            }}
          >
            <Plus size={16} strokeWidth={1.75} />
            {t('library.addDemo')}
          </Button>
          {syncState.status === 'disabled' && (
            <Button
              variant="ghost"
              onClick={() => void navigate({ to: '/settings/$section', params: { section: 'data' } })}
            >
              <Cloud size={16} strokeWidth={1.75} />
              {t('library.connectCloud')}
            </Button>
          )}
        </div>
      </div>
    )
  }

  return (
    <GameCollectionView
      key={status}
      scope={{ kind: 'library', status: status === 'all' ? null : status }}
      title={title}
      defaultSort={sort}
      defaultGroupBy={groupBy}
      progress={status === 'all'}
      breadcrumbContext={{ from: 'library' }}
      actionsSlot={
        <Button
          variant="primary"
          size="sm"
          onClick={() => void navigate({ to: '/catalog/$entity/new', params: { entity: 'games' } })}
        >
          <Plus size={16} strokeWidth={1.75} />
          {t('library.addGame')}
        </Button>
      }
    />
  )
}
