import type { ReactElement, ReactNode } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { ArrowDown, ArrowUp, Heart, Settings2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { GameCardDto } from '@shared/schema/entities'
import type { CollectionScope, Sort } from '@shared/schema/filters'
import type { GroupByField, SortField } from '@shared/constants'
import { CoverImage } from '@/components/ui/image'
import { CollapsibleSection } from '@/components/ui/collapsible-section'
import { MetacriticBadge } from '@/components/ui/metacritic-badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { formatDate, formatPlaytime } from '@/lib/format'
import { statusColor } from '@/lib/color'
import { cn } from '@/lib/utils'
import { GameContextMenu } from './game-context-menu'
import { groupItems } from './group-items'
import { attachReorderable, reorderIds, type Edge } from './reorder-dnd'

interface ColumnDef {
  key: string
  labelKey: string
  width: number
  align?: 'right'
  sortField?: SortField
  ranked?: boolean
  render: (game: GameCardDto) => ReactNode
}

const ROW_GAP_PX = 0

function buildColumns(t: (key: string) => string, ranked: boolean): ColumnDef[] {
  const columns: ColumnDef[] = []
  if (ranked) {
    columns.push({
      key: 'position',
      labelKey: 'collection.col.position',
      width: 44,
      align: 'right',
      ranked: true,
      render: (g) => <span className="tabular text-text-2">{g.position ?? '—'}</span>
    })
  }
  columns.push(
    {
      key: 'cover',
      labelKey: 'collection.col.cover',
      width: 44,
      render: (g) => <CoverImage fileName={g.coverFile} title={g.title} dominantColor={g.dominantColor} ratio="3/4" size={32} />
    },
    {
      key: 'title',
      labelKey: 'catalog.col.title',
      width: 260,
      sortField: 'title',
      render: (g) => <span className="truncate font-semibold text-text-1">{g.title}</span>
    },
    {
      key: 'year',
      labelKey: 'catalog.col.year',
      width: 70,
      align: 'right',
      sortField: 'release_date',
      render: (g) => <span className="tabular text-text-2">{g.releaseYear ?? '—'}</span>
    },
    {
      key: 'developer',
      labelKey: 'role.developer',
      width: 160,
      render: (g) => <span className="truncate text-text-2">{g.developer ?? '—'}</span>
    },
    {
      key: 'genres',
      labelKey: 'collection.col.genres',
      width: 160,
      render: (g) => <span className="truncate text-text-2">{g.genres ?? '—'}</span>
    },
    {
      key: 'platform',
      labelKey: 'collection.col.platform',
      width: 120,
      render: (g) => <span className="truncate text-text-2">{g.myPlatform ?? g.platforms ?? '—'}</span>
    },
    {
      key: 'status',
      labelKey: 'collection.col.status',
      width: 110,
      render: (g) =>
        g.status ? (
          <span className="flex items-center gap-1.5" style={{ color: statusColor(g.status) }}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: statusColor(g.status) }} />
            {t(`status.${g.status}`)}
          </span>
        ) : (
          <span className="text-text-3">{t('status.none')}</span>
        )
    },
    {
      key: 'rating',
      labelKey: 'collection.col.myRating',
      width: 70,
      align: 'right',
      sortField: 'rating',
      render: (g) => <span className="tabular text-success">{g.rating ?? '—'}</span>
    },
    {
      key: 'metacritic',
      labelKey: 'collection.col.metacritic',
      width: 70,
      align: 'right',
      sortField: 'metacritic_score',
      render: (g) => (g.metacriticScore != null ? <MetacriticBadge score={g.metacriticScore} /> : <span className="text-text-3">—</span>)
    },
    {
      key: 'hours',
      labelKey: 'collection.col.hours',
      width: 90,
      align: 'right',
      sortField: 'playtime_minutes',
      render: (g) => <span className="tabular text-text-2">{formatPlaytime(g.playtimeMinutes ?? 0, true)}</span>
    },
    {
      key: 'added',
      labelKey: 'collection.col.added',
      width: 110,
      align: 'right',
      sortField: 'added_at',
      render: (g) => <span className="tabular text-text-2">{formatDate(g.addedAt)}</span>
    }
  )
  return columns
}

function readVisibleColumns(scopeKey: string, allKeys: string[]): Set<string> {
  if (typeof window === 'undefined') return new Set(allKeys)
  try {
    const raw = window.localStorage.getItem(`aurora:table-columns:${scopeKey}`)
    if (!raw) return new Set(allKeys)
    const hidden = JSON.parse(raw) as string[]
    return new Set(allKeys.filter((k) => !hidden.includes(k)))
  } catch {
    return new Set(allKeys)
  }
}

function writeHiddenColumns(scopeKey: string, hidden: string[]): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(`aurora:table-columns:${scopeKey}`, JSON.stringify(hidden))
  } catch {
    // localStorage недоступен — не критично
  }
}

export interface GameTableProps {
  items: GameCardDto[]
  scope: CollectionScope
  scopeKey: string
  ranked: boolean
  sort: Sort
  onSortChange: (sort: Sort) => void
  groupBy: GroupByField
  groupLabelFor: (groupBy: GroupByField, key: string) => string
  selection: Set<string>
  compact: boolean
  dragEnabled: boolean
  onReorder?: (orderedIds: string[]) => void
  onToggleSelect: (id: string, opts: { rangeFrom?: boolean }) => void
  onOpen: (id: string) => void
  onEdit: (id: string) => void
  onChanged: () => void
  onRequestDelete: (ids: string[]) => void
}

/** Вид «список» (07 §4): виртуализация, сортировка по заголовку, группировка, drag-n-drop. */
export function GameTable(props: GameTableProps): ReactElement {
  const {
    items,
    scope,
    scopeKey,
    ranked,
    sort,
    onSortChange,
    groupBy,
    groupLabelFor,
    selection,
    compact,
    dragEnabled,
    onReorder,
    onToggleSelect,
    onOpen,
    onEdit,
    onChanged,
    onRequestDelete
  } = props
  const { t } = useTranslation()
  const allColumns = useMemo(() => buildColumns(t, ranked), [t, ranked])
  const [visible, setVisible] = useState(() => readVisibleColumns(scopeKey, allColumns.map((c) => c.key)))
  useEffect(() => setVisible(readVisibleColumns(scopeKey, allColumns.map((c) => c.key))), [scopeKey, allColumns])

  const columns = allColumns.filter((c) => c.ranked || visible.has(c.key))
  const rowHeight = compact ? 36 : 48

  const toggleColumn = (key: string): void => {
    setVisible((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      const hidden = allColumns.filter((c) => !c.ranked && !next.has(c.key)).map((c) => c.key)
      writeHiddenColumns(scopeKey, hidden)
      return next
    })
  }

  const scrollRef = useRef<HTMLDivElement>(null)
  const [dragState, setDragState] = useState<{ draggingId: string | null; overId: string | null; edge: Edge | null }>({
    draggingId: null,
    overId: null,
    edge: null
  })
  const onDragStateChange = useCallback((draggingId: string | null) => setDragState((s) => ({ ...s, draggingId })), [])
  const onHoverChange = useCallback(
    (next: { overId: string | null; edge: Edge | null }) => setDragState((s) => ({ ...s, ...next })),
    []
  )
  const onDropped = useCallback(
    (sourceId: string, sourceIndex: number, targetIndex: number, edge: Edge | null) => {
      if (!onReorder) return
      const ids = items.map((i) => i.id)
      onReorder(reorderIds(ids, sourceIndex, targetIndex, edge, 'vertical'))
    },
    [items, onReorder]
  )

  const gridTemplate = columns.map((c) => `${c.width}px`).join(' ') + ' 1fr'

  const header = (
    <div
      className="type-caption sticky top-0 z-10 grid items-center gap-3 border-b border-border-1 px-3"
      style={{ gridTemplateColumns: gridTemplate, height: 32, background: 'var(--bg-0)' }}
    >
      {columns.map((col) => (
        <button
          key={col.key}
          type="button"
          disabled={!col.sortField}
          onClick={() => {
            if (!col.sortField) return
            onSortChange({
              field: col.sortField,
              dir: sort.field === col.sortField && sort.dir === 'desc' ? 'asc' : 'desc'
            })
          }}
          className={cn(
            'flex items-center gap-1 truncate text-left outline-none',
            col.align === 'right' && 'justify-end',
            col.sortField && 'hover:text-text-1'
          )}
        >
          {col.key !== 'cover' && col.key !== 'position' && t(col.labelKey)}
          {sort.field === col.sortField &&
            (sort.dir === 'desc' ? (
              <ArrowDown size={11} strokeWidth={1.75} />
            ) : (
              <ArrowUp size={11} strokeWidth={1.75} />
            ))}
        </button>
      ))}
      <span className="flex justify-end">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="icon" size="sm" aria-label={t('collection.table.columns')}>
              <Settings2 size={14} strokeWidth={1.75} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {allColumns
              .filter((c) => !c.ranked && c.key !== 'cover' && c.key !== 'title')
              .map((c) => (
                <DropdownMenuCheckboxItem
                  key={c.key}
                  checked={visible.has(c.key)}
                  onSelect={(e) => {
                    e.preventDefault()
                    toggleColumn(c.key)
                  }}
                >
                  {t(c.labelKey)}
                </DropdownMenuCheckboxItem>
              ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </span>
    </div>
  )

  function Row({
    game,
    index,
    style
  }: {
    game: GameCardDto
    index: number
    style?: React.CSSProperties
  }): ReactElement {
    const elRef = useRef<HTMLDivElement | null>(null)
    useEffect(() => {
      const el = elRef.current
      if (!dragEnabled || !el) return
      return attachReorderable({
        element: el,
        id: game.id,
        index,
        axis: 'vertical',
        onDragStateChange,
        onHoverChange,
        onDropped
      })
    }, [game.id, index])

    const selected = selection.has(game.id)
    return (
      <GameContextMenu game={game} scope={scope} onOpenGame={() => onOpen(game.id)} onEdit={() => onEdit(game.id)} onChanged={onChanged}>
        <div
          ref={elRef}
          role="row"
          tabIndex={0}
          style={{
            ...style,
            gridTemplateColumns: gridTemplate,
            height: rowHeight,
            background: selected ? 'var(--accent-soft)' : undefined,
            borderTop: dragState.overId === game.id ? '2px solid var(--accent)' : '1px solid var(--border-1)',
            opacity: dragState.draggingId === game.id ? 0.5 : 1
          }}
          className="group grid cursor-pointer items-center gap-3 px-3 outline-none hover:bg-surface-1 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--border-focus)]"
          onClick={(event) => {
            if (event.ctrlKey || event.metaKey) onToggleSelect(game.id, {})
            else if (event.shiftKey) onToggleSelect(game.id, { rangeFrom: true })
            else onOpen(game.id)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') onOpen(game.id)
            else if (event.key === ' ') {
              event.preventDefault()
              onToggleSelect(game.id, { rangeFrom: event.shiftKey })
            } else if (event.key === 'Delete') {
              onRequestDelete(selection.size > 0 ? [...selection] : [game.id])
            }
          }}
        >
          {columns.map((col) => (
            <span
              key={col.key}
              className={cn('type-small min-w-0 truncate', col.align === 'right' && 'text-right')}
            >
              {col.key === 'title' && (
                <span className="mr-2 inline-block align-middle opacity-0 group-hover:opacity-100">
                  <Checkbox checked={selected} onChange={() => onToggleSelect(game.id, {})} />
                </span>
              )}
              {col.render(game)}
              {col.key === 'title' && game.isFavorite && (
                <Heart size={12} strokeWidth={1.75} className="ml-1.5 inline align-middle" style={{ color: 'var(--danger)', fill: 'var(--danger)' }} />
              )}
            </span>
          ))}
        </div>
      </GameContextMenu>
    )
  }

  // Хук вызывается безусловно: при группировке виртуализация не используется,
  // но порядок хуков должен совпадать в каждом рендере (rules-of-hooks).
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => rowHeight + ROW_GAP_PX,
    overscan: 8
  })

  if (groupBy !== 'none') {
    const groups = groupItems(items, groupBy, groupLabelFor)
    return (
      <div ref={scrollRef} className="flex h-full flex-col overflow-y-auto px-6 pb-24 pt-4">
        {header}
        {groups.map((group) => (
          <CollapsibleSection
            key={group.key}
            title={group.label}
            count={group.items.length}
            storageKey={`collection-table-group-${groupBy}-${group.key}`}
          >
            {group.items.map((game, i) => (
              <Row key={game.id} game={game} index={i} />
            ))}
          </CollapsibleSection>
        ))}
      </div>
    )
  }

  return (
    <div ref={scrollRef} className="flex h-full flex-col overflow-y-auto px-6 pb-24 pt-4">
      {header}
      <div style={{ height: virtualizer.getTotalSize(), position: 'relative', width: '100%' }}>
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const game = items[virtualRow.index]
          if (!game) return null
          return (
            <Row
              key={game.id}
              game={game}
              index={virtualRow.index}
              style={{ position: 'absolute', top: 0, left: 0, right: 0, transform: `translateY(${virtualRow.start}px)` }}
            />
          )
        })}
      </div>
    </div>
  )
}
