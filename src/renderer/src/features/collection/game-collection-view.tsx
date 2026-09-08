import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import {
  ArrowDownAZ,
  ArrowUpAZ,
  Dices,
  Inbox,
  LayoutGrid,
  List as ListIcon,
  Search,
  SlidersHorizontal,
  X
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  CARD_SIZES,
  DEFAULT_SORT_DIR,
  GROUP_BY_FIELDS,
  SORT_FIELDS,
  type CardSize,
  type GroupByField,
  type SortField
} from '@shared/constants'
import { countActiveFilters, type Filters } from '@shared/schema/filters'
import { Button } from '@/components/ui/button'
import { Chip } from '@/components/ui/chip'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { ProgressRing } from '@/components/ui/progress-ring'
import { Segmented } from '@/components/ui/segmented'
import { Skeleton } from '@/components/ui/skeleton'
import { CoverImage } from '@/components/ui/image'
import { toast } from '@/components/ui/toast'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { call } from '@/platform/api'
import { formatPlaytime } from '@/lib/format'
import { comboFromEvent, resolveCombos } from '@/lib/hotkeys'
import { shouldAnimateLayout } from '@/lib/motion'
import { useSettings } from '@/stores/settings-store'
import { useUiStore } from '@/stores/ui-store'
import { GameGrid } from './game-grid'
import { GameTable } from './game-table'
import { FiltersPanel } from './filters-panel'
import { useCollectionFacets, useCollectionProgress, useCollectionQuery } from './use-collection-data'
import { useCollectionViewState } from './use-collection-view-state'
import { BulkActionsBar } from './bulk-actions-bar'
import { PresetChips } from './preset-chips'
import type { GameCollectionViewProps } from './types'

/**
 * Единый компонент коллекции игр (ТЗ 07). Используется библиотекой, списком, серией,
 * страницей компании, поиском и каталогом; отличия задаются пропсами (см. CONTRACT.md).
 */
export function GameCollectionView(props: GameCollectionViewProps): React.ReactElement {
  const {
    scope,
    title,
    subtitle,
    titleSlot,
    headerSlot,
    actionsSlot,
    defaultSort,
    defaultGroupBy,
    hiddenFilterSections = [],
    reorderable = false,
    onReorder,
    renderItemExtra,
    breadcrumbContext,
    emptySlot,
    showPositionNumbers
  } = props

  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const settings = useSettings()

  const showProgress = props.progress ?? (scope.kind !== 'search' && scope.kind !== 'catalog')
  const showFilters = props.filters ?? scope.kind !== 'search'
  const showRandom = props.random ?? (scope.kind === 'library' || scope.kind === 'list')

  const view = useCollectionViewState(scope, {
    ...(defaultSort ? { defaultSort } : {}),
    ...(defaultGroupBy ? { defaultGroupBy } : {})
  })
  const { state } = view
  const combos = useMemo(() => resolveCombos(settings.hotkeys), [settings.hotkeys])

  const selection = useUiStore((s) => s.selection)
  const toggleSelected = useUiStore((s) => s.toggleSelected)
  const setSelection = useUiStore((s) => s.setSelection)
  const clearSelection = useUiStore((s) => s.clearSelection)
  const quickFilterOpen = useUiStore((s) => s.quickFilterOpen)
  const setQuickFilterOpen = useUiStore((s) => s.setQuickFilterOpen)

  const [quickFilter, setQuickFilter] = useState('')
  const [narrow, setNarrow] = useState(false)
  const [randomGame, setRandomGame] = useState<{ id: string; title: string; coverFile: string | null } | null>(null)

  // Ниже 1100 px панель фильтров становится шторкой поверх контента (07 §1).
  useEffect(() => {
    const media = window.matchMedia('(max-width: 1100px)')
    const update = (): void => setNarrow(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  useEffect(() => () => clearSelection(), [scope, clearSelection])

  const { data, isPending, isError, refetch } = useCollectionQuery(scope, state.filters, state.sort, state.groupBy)
  const { data: progress } = useCollectionProgress(scope, showProgress)
  const { data: facets } = useCollectionFacets(scope, state.filters, showFilters && view.filterPanelOpen)

  const items = useMemo(() => {
    const rows = data?.items ?? []
    const query = quickFilter.trim().toLowerCase()
    if (!query) return rows
    return rows.filter((game) => game.title.toLowerCase().includes(query))
  }, [data, quickFilter])

  const groupLabelFor = useCallback(
    (groupBy: GroupByField, key: string): string => {
      switch (groupBy) {
        case 'status':
          return key ? t(`statusPlural.${key}`) : t('status.none')
        case 'priority':
          return t(`priority.${key || '0'}`)
        case 'year':
        case 'finished_year':
          return key || t('common.unknown')
        default:
          return key || t('common.unknown')
      }
    },
    [t]
  )

  const onChanged = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['collection'] })
  }, [queryClient])

  const openGame = useCallback(
    (gameId: string) => {
      void call('search.pushRecent', { entityType: 'game', id: gameId }).catch(() => undefined)
      void navigate({
        to: '/games/$gameId',
        params: { gameId },
        search: (breadcrumbContext ?? {}) as never
      })
    },
    [navigate, breadcrumbContext]
  )

  const editGame = useCallback(
    (gameId: string) => {
      void navigate({ to: '/catalog/$entity/$id/edit', params: { entity: 'games', id: gameId } })
    },
    [navigate]
  )

  const handleToggleSelect = useCallback(
    (id: string, opts: { rangeFrom?: boolean }) => {
      if (opts.rangeFrom) {
        const anchor = useUiStore.getState().lastSelectedId
        const ids = items.map((game) => game.id)
        const from = anchor ? ids.indexOf(anchor) : -1
        const to = ids.indexOf(id)
        if (from >= 0 && to >= 0) {
          const [start, end] = from < to ? [from, to] : [to, from]
          toggleSelected(id, ids.slice(start, end + 1))
          return
        }
      }
      toggleSelected(id)
    },
    [items, toggleSelected]
  )

  const requestDelete = useCallback(
    (ids: string[]) => {
      void call('userGame.removeFromLibrary', { gameIds: ids })
        .then(() => {
          toast({
            title: t('collection.removed', { count: ids.length }),
            action: {
              label: t('action.undo'),
              onClick: () => {
                void call('userGame.addToLibrary', { gameIds: ids, status: 'backlog' }).then(onChanged)
              }
            }
          })
          clearSelection()
          onChanged()
        })
        .catch((err: Error) => toast({ title: err.message, tone: 'danger' }))
    },
    [t, onChanged, clearSelection]
  )

  // Ctrl+A / Esc внутри коллекции (07 §3) и сочетания группы «collection» (05 §5)
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      const target = event.target
      const typing =
        target instanceof HTMLElement &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      // Escape выходит и из поля быстрого поиска, поэтому проверяется до отсева ввода.
      if (event.key === 'Escape') {
        clearSelection()
        setQuickFilterOpen(false)
        return
      }
      const combo = comboFromEvent(event)
      if (combo === combos['findInCollection']) {
        event.preventDefault()
        setQuickFilterOpen(true)
        return
      }
      if (showFilters && combo === combos['toggleFilters']) {
        event.preventDefault()
        view.setFilterPanelOpen(!view.filterPanelOpen)
        return
      }
      if (typing) return
      if (event.key.toLowerCase() === 'a' && event.ctrlKey) {
        event.preventDefault()
        setSelection(items.map((game) => game.id))
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [items, clearSelection, setSelection, setQuickFilterOpen, combos, showFilters, view])

  const rollRandom = (): void => {
    void call('collection.random', {
      scope,
      filters: state.filters,
      ...(randomGame ? { excludeIds: [randomGame.id] } : {})
    })
      .then((game) => {
        if (!game) {
          toast({ title: t('collection.randomEmpty') })
          return
        }
        setRandomGame({ id: game.id, title: game.title, coverFile: game.coverFile })
      })
      .catch((err: Error) => toast({ title: err.message, tone: 'danger' }))
  }

  const activeFilterCount = countActiveFilters(state.filters)
  const animateLayout = shouldAnimateLayout(items.length, settings.animations !== 'off')
  const dragEnabled = reorderable && state.sort.field === 'position'
  const positionNumbers =
    showPositionNumbers ?? (scope.kind === 'list' || scope.kind === 'series')

  const subtitleText =
    subtitle ??
    (data
      ? `${t('common.games', { count: data.total })} · ${formatPlaytime(data.playtimeMinutes, true)}`
      : '')

  return (
    <div className="flex h-full min-h-0">
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex flex-col gap-3 px-6 pt-5">
          <div className="flex items-start gap-4">
            {headerSlot}
            <div className="min-w-0 flex-1">
              {titleSlot ?? <h1 className="type-h1 truncate">{title}</h1>}
              <p className="type-small tabular" style={{ color: 'var(--text-2)' }}>
                {subtitleText}
              </p>
            </div>

            {showProgress && progress && progress.total > 0 && (
              <div className="flex items-center gap-2">
                <ProgressRing done={progress.done} total={progress.total} size={56} />
                <span className="type-small tabular" style={{ color: 'var(--text-2)' }}>
                  {progress.done} / {progress.total}
                  <br />
                  {t('common.completed')}
                </span>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {actionsSlot}
            {showRandom && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="secondary" size="sm" onClick={rollRandom}>
                    <Dices size={16} strokeWidth={1.75} />
                    {t('action.random')}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t('collection.randomHint')}</TooltipContent>
              </Tooltip>
            )}

            <div className="flex-1" />

            {quickFilterOpen ? (
              <Input
                autoFocus
                value={quickFilter}
                onChange={(event) => setQuickFilter(event.target.value)}
                onBlur={() => !quickFilter && setQuickFilterOpen(false)}
                placeholder={t('collection.quickFilter')}
                iconLeft={<Search size={14} strokeWidth={1.75} />}
                className="w-[220px]"
              />
            ) : (
              <Button
                variant="icon"
                size="sm"
                aria-label={t('collection.quickFilter')}
                onClick={() => setQuickFilterOpen(true)}
              >
                <Search size={16} strokeWidth={1.75} />
              </Button>
            )}

            <SortMenu
              sort={state.sort}
              onSortChange={view.setSort}
              groupBy={state.groupBy}
              onGroupByChange={view.setGroupBy}
              reorderable={reorderable}
            />

            {state.view === 'grid' && (
              <Segmented<CardSize>
                value={state.size}
                onChange={view.setSize}
                size="sm"
                ariaLabel={t('collection.cardSize')}
                options={CARD_SIZES.map((size) => ({ value: size, label: size.toUpperCase() }))}
              />
            )}

            <Segmented
              value={state.view}
              onChange={(value) => view.setView(value as 'grid' | 'list')}
              ariaLabel={t('collection.view')}
              options={[
                { value: 'grid', icon: <LayoutGrid size={14} strokeWidth={1.75} />, title: t('common.grid') },
                { value: 'list', icon: <ListIcon size={14} strokeWidth={1.75} />, title: t('common.list') }
              ]}
            />

            {showFilters && (
              <Button
                variant={view.filterPanelOpen ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => view.setFilterPanelOpen(!view.filterPanelOpen)}
              >
                <SlidersHorizontal size={16} strokeWidth={1.75} />
                {activeFilterCount > 0 ? activeFilterCount : t('common.filters')}
              </Button>
            )}
          </div>

          {showFilters && <PresetChips scopeKey={view.scopeKey} state={state} onApply={view.setFilters} />}

          {activeFilterCount > 0 && (
            <ActiveFilterChips filters={state.filters} onChange={view.setFilters} onReset={view.resetFilters} />
          )}
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6 pt-3">
          {isPending && <GridSkeleton />}

          {isError && (
            <div
              className="flex items-center gap-3 rounded-[var(--r-md)] px-4 py-3"
              style={{ background: 'var(--danger-soft)', border: '1px solid var(--border-1)' }}
            >
              <span className="type-body">{t('collection.loadError')}</span>
              <Button variant="secondary" size="sm" onClick={() => void refetch()}>
                {t('action.retry')}
              </Button>
            </div>
          )}

          {!isPending && !isError && items.length === 0 && (
            <>
              {emptySlot ?? (
                <EmptyState
                  icon={<Inbox size={24} strokeWidth={1.75} />}
                  title={activeFilterCount > 0 ? t('empty.filters') : t('empty.library')}
                  {...(activeFilterCount > 0
                    ? { action: { label: t('empty.resetFilters'), onClick: view.resetFilters } }
                    : { description: t('empty.libraryHint') })}
                />
              )}
            </>
          )}

          {!isPending && items.length > 0 && state.view === 'grid' && (
            <GameGrid
              items={items}
              scope={scope}
              size={state.size}
              groupBy={state.groupBy}
              selection={selection}
              secondaryField={settings.cardSecondaryField}
              showPositionNumbers={positionNumbers}
              animateLayout={animateLayout}
              dragEnabled={dragEnabled}
              {...(onReorder ? { onReorder } : {})}
              {...(renderItemExtra ? { renderItemExtra } : {})}
              groupLabelFor={groupLabelFor}
              onToggleSelect={handleToggleSelect}
              onOpen={openGame}
              onEdit={editGame}
              onChanged={onChanged}
              onRequestDelete={requestDelete}
            />
          )}

          {!isPending && items.length > 0 && state.view === 'list' && (
            <GameTable
              items={items}
              scope={scope}
              scopeKey={view.scopeKey}
              ranked={positionNumbers}
              sort={state.sort}
              onSortChange={view.setSort}
              groupBy={state.groupBy}
              groupLabelFor={groupLabelFor}
              selection={selection}
              compact={settings.density === 'compact'}
              dragEnabled={dragEnabled}
              {...(onReorder ? { onReorder } : {})}
              onToggleSelect={handleToggleSelect}
              onOpen={openGame}
              onEdit={editGame}
              onChanged={onChanged}
              onRequestDelete={requestDelete}
            />
          )}
        </div>

        {selection.size > 0 && (
          <BulkActionsBar
            ids={[...selection]}
            scope={scope}
            onDone={() => {
              clearSelection()
              onChanged()
            }}
            onClear={clearSelection}
          />
        )}
      </div>

      {showFilters && view.filterPanelOpen && !narrow && (
        <FiltersPanel
          filters={state.filters}
          onChange={(filters) => view.setFilters(filters, { push: false })}
          facets={facets}
          hidden={hiddenFilterSections}
          total={data?.total ?? 0}
          onReset={view.resetFilters}
          onApplyClose={() => view.setFilterPanelOpen(false)}
        />
      )}

      {showFilters && view.filterPanelOpen && narrow && (
        <div className="fixed inset-0 z-40 flex justify-end" style={{ background: 'var(--overlay)' }}>
          <FiltersPanel
            filters={state.filters}
            onChange={(filters) => view.setFilters(filters, { push: false })}
            facets={facets}
            hidden={hiddenFilterSections}
            total={data?.total ?? 0}
            onReset={view.resetFilters}
            onApplyClose={() => view.setFilterPanelOpen(false)}
          />
        </div>
      )}

      <Dialog open={Boolean(randomGame)} onOpenChange={(open) => !open && setRandomGame(null)}>
        <DialogContent size={480}>
          <DialogHeader>
            <DialogTitle>{t('action.random')}</DialogTitle>
          </DialogHeader>
          {randomGame && (
            <div className="flex items-center gap-4">
              <CoverImage fileName={randomGame.coverFile} title={randomGame.title} size={96} />
              <p className="type-h2">{randomGame.title}</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="secondary" onClick={rollRandom}>
              {t('collection.rollAgain')}
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                if (randomGame) openGame(randomGame.id)
                setRandomGame(null)
              }}
            >
              {t('action.open')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function GridSkeleton(): React.ReactElement {
  return (
    <div className="grid gap-[var(--gap-grid)]" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}>
      {Array.from({ length: 12 }, (_, index) => (
        <div key={index} className="flex flex-col gap-2">
          <Skeleton className="aspect-[3/4] w-full" />
          <Skeleton className="h-3 w-4/5" />
          <Skeleton className="h-3 w-2/5" />
        </div>
      ))}
    </div>
  )
}

interface SortMenuProps {
  sort: { field: SortField; dir: 'asc' | 'desc'; seed?: number }
  onSortChange: (sort: { field: SortField; dir: 'asc' | 'desc'; seed?: number }) => void
  groupBy: GroupByField
  onGroupByChange: (groupBy: GroupByField) => void
  reorderable: boolean
}

/** Сортировка и группировка (07 §5, §4). */
function SortMenu({ sort, onSortChange, groupBy, onGroupByChange, reorderable }: SortMenuProps): React.ReactElement {
  const { t } = useTranslation()
  const fields = SORT_FIELDS.filter((field) => field !== 'position' || reorderable)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm">
          {sort.dir === 'asc' ? (
            <ArrowUpAZ size={16} strokeWidth={1.75} />
          ) : (
            <ArrowDownAZ size={16} strokeWidth={1.75} />
          )}
          {t(`sort.${sort.field}`)}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-[70vh] overflow-y-auto">
        <DropdownMenuLabel>{t('common.sort')}</DropdownMenuLabel>
        {fields.map((field) => (
          <DropdownMenuCheckboxItem
            key={field}
            checked={sort.field === field}
            onCheckedChange={() =>
              onSortChange(
                field === sort.field
                  ? { ...sort, dir: sort.dir === 'asc' ? 'desc' : 'asc' }
                  : {
                      field,
                      dir: DEFAULT_SORT_DIR[field],
                      ...(field === 'random' ? { seed: Math.floor(Math.random() * 100000) } : {})
                    }
              )
            }
          >
            {t(`sort.${field}`)}
          </DropdownMenuCheckboxItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuLabel>{t('collection.groupBy')}</DropdownMenuLabel>
        {GROUP_BY_FIELDS.map((field) => (
          <DropdownMenuCheckboxItem
            key={field}
            checked={groupBy === field}
            onCheckedChange={() => onGroupByChange(field)}
          >
            {t(`group.${field}`)}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** Активные фильтры дублируются чипами над сеткой с крестиками (07 §7). */
function ActiveFilterChips({
  filters,
  onChange,
  onReset
}: {
  filters: Filters
  onChange: (filters: Filters) => void
  onReset: () => void
}): React.ReactElement {
  const { t } = useTranslation()
  const chips: Array<{ key: string; label: string; clear: () => void }> = []

  if (filters.q) {
    chips.push({ key: 'q', label: `«${filters.q}»`, clear: () => onChange({ ...filters, q: undefined }) })
  }
  for (const status of filters.status ?? []) {
    chips.push({
      key: `status-${status}`,
      label: t(`statusPlural.${status}`),
      clear: () =>
        onChange({
          ...filters,
          status: (filters.status ?? []).filter((value) => value !== status) as typeof filters.status
        })
    })
  }
  if (filters.year && (filters.year.min != null || filters.year.max != null)) {
    chips.push({
      key: 'year',
      label: `${filters.year.min ?? '…'}–${filters.year.max ?? '…'}`,
      clear: () => onChange({ ...filters, year: undefined })
    })
  }
  if (filters.metacritic && (filters.metacritic.min != null || filters.metacritic.max != null)) {
    chips.push({
      key: 'mc',
      label: `Metacritic ${filters.metacritic.min ?? 0}–${filters.metacritic.max ?? 100}`,
      clear: () => onChange({ ...filters, metacritic: undefined })
    })
  }
  if (filters.genres?.ids.length) {
    chips.push({
      key: 'genres',
      label: t('filters.genresN', { count: filters.genres.ids.length }),
      clear: () => onChange({ ...filters, genres: undefined })
    })
  }
  if (filters.ownership?.length) {
    chips.push({
      key: 'ownership',
      label: filters.ownership.map((value) => t(`ownership.${value}`)).join(', '),
      clear: () => onChange({ ...filters, ownership: undefined })
    })
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {chips.map((chip) => (
        <Chip key={chip.key} selected onRemove={chip.clear} removeLabel={t('action.reset')}>
          {chip.label}
        </Chip>
      ))}
      <Button variant="ghost" size="sm" onClick={onReset}>
        <X size={14} strokeWidth={1.75} />
        {t('action.reset')}
      </Button>
    </div>
  )
}
