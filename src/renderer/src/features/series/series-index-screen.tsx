import { useMemo, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Layers, Plus, Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { CoverImage } from '@/components/ui/image'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { ProgressRing } from '@/components/ui/progress-ring'
import { Segmented } from '@/components/ui/segmented'
import { Skeleton } from '@/components/ui/skeleton'
import { call } from '@/platform/api'

type SeriesSort = 'name' | 'games' | 'latest' | 'progress'

/** Индекс серий (ТЗ 06 §4.1). */
export function SeriesIndexScreen(): React.ReactElement {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<SeriesSort>('name')

  const { data, isPending } = useQuery({
    queryKey: ['series', sort],
    queryFn: () => call('series.list', { sort })
  })

  const items = useMemo(
    () => (data ?? []).filter((item) => item.name.toLowerCase().includes(query.trim().toLowerCase())),
    [data, query]
  )

  return (
    <div className="flex flex-col gap-4 p-6">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="type-h1 flex-1">{t('nav.series')}</h1>
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('common.search')}
          iconLeft={<Search size={14} strokeWidth={1.75} />}
          className="w-[240px]"
        />
        <Segmented<SeriesSort>
          value={sort}
          onChange={setSort}
          ariaLabel={t('common.sort')}
          options={[
            { value: 'name', label: t('series.sort.name') },
            { value: 'games', label: t('series.sort.games') },
            { value: 'latest', label: t('series.sort.latest') },
            { value: 'progress', label: t('series.sort.progress') }
          ]}
        />
        <Button
          variant="primary"
          onClick={() => void navigate({ to: '/catalog/$entity/new', params: { entity: 'series' } })}
        >
          <Plus size={16} strokeWidth={1.75} />
          {t('series.new')}
        </Button>
      </header>

      {isPending && <Skeleton className="h-[300px] w-full" />}

      {!isPending && items.length === 0 && (
        <EmptyState
          icon={<Layers size={24} strokeWidth={1.75} />}
          title={t('series.empty')}
          action={{
            label: t('series.new'),
            onClick: () => void navigate({ to: '/catalog/$entity/new', params: { entity: 'series' } })
          }}
        />
      )}

      <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">
        {items.map((series) => (
          <button
            key={series.id}
            type="button"
            className="flex flex-col gap-2 rounded-[var(--r-md)] p-3 text-left"
            style={{ background: 'var(--surface-1)', border: '1px solid var(--border-1)' }}
            onClick={() => void navigate({ to: '/series/$seriesId', params: { seriesId: series.id } })}
          >
            <div className="flex gap-2">
              {series.coverFile ? (
                <CoverImage fileName={series.coverFile} title={series.name} size={72} />
              ) : (
                <div className="flex gap-1">
                  {(series.coverMosaic ?? []).slice(0, 4).map((file, index) => (
                    <CoverImage key={`${file}-${index}`} fileName={file} title={series.name} size={34} />
                  ))}
                  {(series.coverMosaic?.length ?? 0) === 0 && (
                    <CoverImage fileName={null} title={series.name} size={72} />
                  )}
                </div>
              )}
              <ProgressRing done={series.completedCount} total={Math.max(1, series.mainLineCount)} size={40} />
            </div>
            <span className="truncate type-h3">{series.name}</span>
            <span className="type-small tabular" style={{ color: 'var(--text-2)' }}>
              {t('common.games', { count: series.gameCount })}
              {series.yearFrom ? ` · ${series.yearFrom}–${series.yearTo ?? series.yearFrom}` : ''}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
