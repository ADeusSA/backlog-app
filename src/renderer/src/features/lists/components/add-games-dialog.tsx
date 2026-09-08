import { useEffect, useMemo, useState, type ReactElement } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { GAME_STATUSES, type GameStatus } from '@shared/constants'
import type { Filters } from '@shared/schema/filters'
import { Button } from '@/components/ui/button'
import { Chip } from '@/components/ui/chip'
import { Combobox } from '@/components/ui/combobox'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CoverImage } from '@/components/ui/image'
import { toast } from '@/components/ui/toast'
import { call } from '@/platform/api'
import { cn } from '@/lib/utils'

export interface AddGamesDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  listId: string
  existingGameIds: string[]
  onAdded?: (count: number) => void
}

/** Диалог «Добавить игры» в список: поиск + вкладка «Из фильтра» (06 §3.3). */
export function AddGamesDialog({
  open,
  onOpenChange,
  listId,
  existingGameIds,
  onAdded
}: AddGamesDialogProps): ReactElement {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const existing = useMemo(() => new Set(existingGameIds), [existingGameIds])

  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    setQuery('')
    setDebounced('')
    setSelected(new Set())
  }, [open])

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), 200)
    return () => clearTimeout(timer)
  }, [query])

  const { data: results } = useQuery({
    queryKey: ['games', 'quickSearch', debounced],
    queryFn: () => call('games.quickSearch', { q: debounced, limit: 30 }),
    enabled: debounced.length >= 1
  })

  const selectable = (results ?? []).filter((game) => !existing.has(game.id))

  function toggle(id: string): void {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function commitSelected(ids: string[]): Promise<void> {
    if (ids.length === 0) return
    setSubmitting(true)
    try {
      const result = await call('lists.addGames', { listId, gameIds: ids })
      await queryClient.invalidateQueries({ queryKey: ['lists'] })
      toast({ title: t('lists.addGames.added', { count: result.added }), tone: 'success' })
      onAdded?.(result.added)
      onOpenChange(false)
    } catch (err) {
      toast({ title: (err as Error).message, tone: 'danger' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size={640} closeLabel={t('action.close') ?? undefined}>
        <DialogHeader>
          <DialogTitle>{t('lists.addGames.title')}</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="search">
          <TabsList>
            <TabsTrigger value="search">{t('lists.addGames.tabSearch')}</TabsTrigger>
            <TabsTrigger value="filter">{t('lists.addGames.tabFilter')}</TabsTrigger>
          </TabsList>

          <TabsContent value="search" className="flex flex-col gap-3">
            <Input
              autoFocus
              iconLeft={<Search size={16} strokeWidth={1.75} />}
              placeholder={t('lists.addGames.searchPlaceholder') ?? undefined}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== 'Enter') return
                if (selectable.length === 1 && selected.size === 0) {
                  const only = selectable[0]
                  if (only) void commitSelected([only.id])
                }
              }}
            />
            <div className="flex max-h-[320px] flex-col gap-1 overflow-y-auto">
              {(results ?? []).map((game) => {
                const already = existing.has(game.id)
                const isSelected = selected.has(game.id)
                return (
                  <button
                    key={game.id}
                    type="button"
                    disabled={already}
                    onClick={() => toggle(game.id)}
                    className={cn(
                      'flex items-center gap-3 rounded-[var(--r-sm)] px-2 py-1.5 text-left outline-none transition-colors',
                      already ? 'cursor-not-allowed opacity-45' : 'hover:bg-surface-1',
                      isSelected && 'bg-accent-soft'
                    )}
                    style={{ transitionDuration: 'var(--d-micro)' }}
                  >
                    <span
                      className={cn(
                        'flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border',
                        isSelected || already ? 'border-transparent bg-accent text-accent-on' : 'border-border-2'
                      )}
                    >
                      {(isSelected || already) && <Check size={11} strokeWidth={2.5} />}
                    </span>
                    <CoverImage fileName={game.coverFile} title={game.title} dominantColor={game.dominantColor} size={28} />
                    <span className="min-w-0 flex-1 truncate type-body">{game.title}</span>
                    {game.releaseYear && (
                      <span className="type-small tabular shrink-0" style={{ color: 'var(--text-3)' }}>
                        {game.releaseYear}
                      </span>
                    )}
                    {already && (
                      <span className="type-small shrink-0" style={{ color: 'var(--text-3)' }}>
                        {t('lists.addGames.already')}
                      </span>
                    )}
                  </button>
                )
              })}
              {debounced.length >= 1 && (results?.length ?? 0) === 0 && (
                <p className="type-small px-2 py-4 text-center" style={{ color: 'var(--text-3)' }}>
                  {t('empty.title')}
                </p>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                {t('action.cancel')}
              </Button>
              <Button
                type="button"
                variant="primary"
                loading={submitting}
                disabled={selected.size === 0}
                onClick={() => void commitSelected([...selected])}
              >
                {t('lists.addGames.addN', { count: selected.size })}
              </Button>
            </DialogFooter>
          </TabsContent>

          <TabsContent value="filter">
            <FromFilterTab
              listId={listId}
              onDone={(count) => {
                onAdded?.(count)
                onOpenChange(false)
              }}
              onCancel={() => onOpenChange(false)}
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Вкладка «Из фильтра»: упрощённое подмножество панели фильтров библиотеки (07 §7) —
 * полноценная панель принадлежит `GameCollectionView` и не дублируется здесь.
 */
function FromFilterTab({
  listId,
  onDone,
  onCancel
}: {
  listId: string
  onDone: (count: number) => void
  onCancel: () => void
}): ReactElement {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [statuses, setStatuses] = useState<GameStatus[]>([])
  const [yearMin, setYearMin] = useState('')
  const [yearMax, setYearMax] = useState('')
  const [genreIds, setGenreIds] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)

  const { data: genres } = useQuery({ queryKey: ['catalog', 'genres'], queryFn: () => call('catalog.genres.list') })

  function toggleStatus(status: GameStatus): void {
    setStatuses((prev) => (prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]))
  }

  async function apply(): Promise<void> {
    const filters: Filters = {}
    if (statuses.length > 0) filters.status = statuses
    if (yearMin || yearMax) {
      filters.year = {
        min: yearMin ? Number(yearMin) : null,
        max: yearMax ? Number(yearMax) : null
      }
    }
    if (genreIds.length > 0) filters.genres = { ids: genreIds, mode: 'any' }

    setSubmitting(true)
    try {
      const result = await call('lists.addFromFilter', { listId, scope: { kind: 'library' }, filters })
      await queryClient.invalidateQueries({ queryKey: ['lists'] })
      toast({ title: t('lists.addGames.added', { count: result.added }), tone: 'success' })
      onDone(result.added)
    } catch (err) {
      toast({ title: (err as Error).message, tone: 'danger' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <span className="type-small" style={{ color: 'var(--text-2)' }}>
          {t('common.filters')}: {t('nav.library')}
        </span>
        <div className="flex flex-wrap gap-1.5">
          {GAME_STATUSES.map((status) => (
            <Chip key={status} selected={statuses.includes(status)} onClick={() => toggleStatus(status)}>
              {t(`status.${status}`)}
            </Chip>
          ))}
        </div>
      </div>
      <div className="flex items-end gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="type-small" style={{ color: 'var(--text-2)' }}>
            {t('lists.addGames.yearFrom')}
          </span>
          <Input
            type="number"
            value={yearMin}
            onChange={(event) => setYearMin(event.target.value)}
            className="w-[100px]"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="type-small" style={{ color: 'var(--text-2)' }}>
            {t('lists.addGames.yearTo')}
          </span>
          <Input
            type="number"
            value={yearMax}
            onChange={(event) => setYearMax(event.target.value)}
            className="w-[100px]"
          />
        </label>
        <label className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className="type-small" style={{ color: 'var(--text-2)' }}>
            {t('catalog.entity.genres')}
          </span>
          <Combobox
            multiple
            items={(genres ?? []).map((g) => ({ value: g.id, label: g.name }))}
            value={genreIds}
            onChange={(value) => setGenreIds(Array.isArray(value) ? value : [value])}
          />
        </label>
      </div>
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onCancel}>
          {t('action.cancel')}
        </Button>
        <Button type="button" variant="primary" loading={submitting} onClick={() => void apply()}>
          {t('lists.addGames.applyFilter')}
        </Button>
      </DialogFooter>
    </div>
  )
}
