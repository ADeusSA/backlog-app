import { useState } from 'react'
import { useNavigate, useParams } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowDownWideNarrow, Layers, Pencil, Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Chip } from '@/components/ui/chip'
import { CoverImage } from '@/components/ui/image'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { toast } from '@/components/ui/toast'
import { GameCollectionView } from '@/features/collection/game-collection-view'
import { call } from '@/platform/api'
import { formatPlaytime } from '@/lib/format'

/** Страница серии (ТЗ 06 §4.2). */
export function SeriesScreen(): React.ReactElement {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { seriesId } = useParams({ strict: false }) as { seriesId?: string }
  const [showDlc, setShowDlc] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [query, setQuery] = useState('')

  const { data: series, isPending } = useQuery({
    queryKey: ['series', seriesId],
    queryFn: () => call('series.get', { id: seriesId! }),
    enabled: Boolean(seriesId)
  })
  const { data: children } = useQuery({
    queryKey: ['series', seriesId, 'children'],
    queryFn: () => call('series.children', { id: seriesId! }),
    enabled: Boolean(seriesId)
  })
  const { data: found } = useQuery({
    queryKey: ['games', 'quickSearch', query],
    queryFn: () => call('games.quickSearch', { q: query, limit: 20 }),
    enabled: addOpen && query.trim().length >= 2
  })

  if (isPending) return <Skeleton className="m-6 h-[400px]" />
  if (!series || !seriesId) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <EmptyState icon={<Layers size={24} strokeWidth={1.75} />} title={t('error.not_found')} />
      </div>
    )
  }

  const autoNumber = (): void => {
    void call('series.autoNumber', { seriesId })
      .then(() => {
        toast({ title: t('series.autoNumbered'), tone: 'success' })
        void queryClient.invalidateQueries()
      })
      .catch((err: Error) => toast({ title: err.message, tone: 'danger' }))
  }

  const addGames = (gameIds: string[]): void => {
    void call('series.addGames', { seriesId, gameIds })
      .then((result) => {
        toast({ title: t('series.added', { count: result.added }), tone: 'success' })
        setAddOpen(false)
        setQuery('')
        void queryClient.invalidateQueries()
      })
      .catch((err: Error) => toast({ title: err.message, tone: 'danger' }))
  }

  return (
    <>
      <GameCollectionView
        scope={{ kind: 'series', seriesId, includeDlc: showDlc }}
        title={series.name}
        subtitle={`${t('common.games', { count: series.gameCount })} · ${t('series.completed', {
          count: series.completedCount
        })} · ${formatPlaytime(series.playtimeMinutes, true)}${
          series.yearFrom ? ` · ${series.yearFrom}–${series.yearTo ?? series.yearFrom}` : ''
        }`}
        headerSlot={
          <CoverImage
            fileName={series.coverFile}
            title={series.name}
            dominantColor={series.dominantColor}
            size={88}
          />
        }
        defaultSort={{ field: 'position', dir: 'asc' }}
        reorderable
        onReorder={(orderedGameIds) => {
          void call('series.reorder', { seriesId, orderedGameIds })
            .then(() => queryClient.invalidateQueries())
            .catch((err: Error) => toast({ title: err.message, tone: 'danger' }))
        }}
        hiddenFilterSections={['series']}
        breadcrumbContext={{ from: 'series', fromId: seriesId, fromTitle: series.name }}
        actionsSlot={
          <>
            <Button variant="primary" size="sm" onClick={() => setAddOpen(true)}>
              <Plus size={16} strokeWidth={1.75} />
              {t('series.addGame')}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                void navigate({ to: '/catalog/$entity/$id/edit', params: { entity: 'series', id: seriesId } })
              }
            >
              <Pencil size={16} strokeWidth={1.75} />
              {t('action.edit')}
            </Button>
            <Button variant="ghost" size="sm" onClick={autoNumber}>
              <ArrowDownWideNarrow size={16} strokeWidth={1.75} />
              {t('series.autoNumber')}
            </Button>
            <Switch checked={showDlc} onChange={setShowDlc} label={t('series.showDlc')} />
            {(children?.length ?? 0) > 0 && (
              <span className="flex flex-wrap items-center gap-1.5">
                {children?.map((child) => (
                  <Chip
                    key={child.id}
                    count={child.gameCount}
                    onClick={() => void navigate({ to: '/series/$seriesId', params: { seriesId: child.id } })}
                  >
                    {child.name}
                  </Chip>
                ))}
              </span>
            )}
          </>
        }
      />

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent size={640}>
          <DialogHeader>
            <DialogTitle>{t('series.addGame')}</DialogTitle>
          </DialogHeader>
          <Input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('common.search')}
          />
          <ul className="max-h-[45vh] overflow-y-auto">
            {found?.map((game) => (
              <li key={game.id}>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-[var(--r-sm)] px-2 py-1.5 text-left hover:bg-[var(--surface-1)]"
                  onClick={() => addGames([game.id])}
                >
                  <CoverImage fileName={game.coverFile} title={game.title} size={28} />
                  <span className="min-w-0 flex-1 truncate type-body">{game.title}</span>
                  <span className="type-small tabular" style={{ color: 'var(--text-3)' }}>
                    {game.releaseYear ?? ''}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setAddOpen(false)}>
              {t('action.close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
