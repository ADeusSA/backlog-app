import type { KeyboardEvent, ReactElement, ReactNode } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { AnimatePresence } from 'motion/react'
import { CARD_SIZE_WIDTH, type CardSize, type GroupByField } from '@shared/constants'
import type { GameCardDto } from '@shared/schema/entities'
import type { CollectionScope } from '@shared/schema/filters'
import type { Settings } from '@shared/schema/settings'
import { CollapsibleSection } from '@/components/ui/collapsible-section'
import { GameCard } from './game-card'
import { groupItems } from './group-items'
import { attachReorderable, reorderIds, type Edge } from './reorder-dnd'

const GAP = 14
const CAPTION_HEIGHT = 40
/** Рамка и внутренние отступы карточки: 2×1 px границы + 2×5 px `p-[5px]` (см. `game-card.tsx`). */
const CARD_CHROME = 12
/** Зазор между обложкой и подписью — `gap-1.5` там же. */
const COVER_CAPTION_GAP = 6

interface DragState {
  draggingId: string | null
  overId: string | null
  edge: Edge | null
}

export interface GameGridProps {
  items: GameCardDto[]
  scope: CollectionScope
  size: CardSize
  groupBy: GroupByField
  selection: Set<string>
  secondaryField: Settings['cardSecondaryField']
  showPositionNumbers: boolean
  animateLayout: boolean
  /** Drag-n-drop доступен только при ручной сортировке (`sort.field === 'position'`, 07 §5). */
  dragEnabled: boolean
  onReorder?: (orderedIds: string[]) => void
  renderItemExtra?: (game: GameCardDto) => ReactNode
  groupLabelFor: (groupBy: GroupByField, key: string) => string
  onToggleSelect: (id: string, opts: { rangeFrom?: boolean }) => void
  onOpen: (id: string) => void
  onEdit: (id: string) => void
  onChanged: () => void
  onRequestDelete: (ids: string[]) => void
}

/** Сетка карточек (07 §3): виртуализация по строкам, FLIP, клавиатура, drag-n-drop. */
export function GameGrid(props: GameGridProps): ReactElement {
  const {
    items,
    scope,
    size,
    groupBy,
    selection,
    secondaryField,
    showPositionNumbers,
    animateLayout,
    dragEnabled,
    onReorder,
    renderItemExtra,
    groupLabelFor,
    onToggleSelect,
    onOpen,
    onEdit,
    onChanged,
    onRequestDelete
  } = props

  const scrollRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const observer = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width
      if (w) setWidth(w)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const cardWidth = CARD_SIZE_WIDTH[size]
  const columns = Math.max(1, Math.floor((width + GAP) / (cardWidth + GAP)))
  /**
   * Колонки резиновые (`1fr`), поэтому карточка шире заявленного размера на остаток
   * от деления ширины сетки. Высоту строки считаем от фактической ширины колонки —
   * иначе на размерах M и L обложка вырастала выше строки и карточки наезжали друг
   * на друга (высота строки задаётся виртуализатором и не подстраивается сама).
   */
  const columnWidth = width > 0 ? (width - (columns - 1) * GAP) / columns : cardWidth
  const coverHeight = ((columnWidth - CARD_CHROME) * 4) / 3
  const rowHeight = Math.ceil(coverHeight) + CARD_CHROME + COVER_CAPTION_GAP + CAPTION_HEIGHT + GAP

  const [dragState, setDragState] = useState<DragState>({ draggingId: null, overId: null, edge: null })
  const onDragStateChange = useCallback((draggingId: string | null) => setDragState((s) => ({ ...s, draggingId })), [])
  const onHoverChange = useCallback(
    (next: { overId: string | null; edge: Edge | null }) => setDragState((s) => ({ ...s, ...next })),
    []
  )
  const onDropped = useCallback(
    (sourceId: string, sourceIndex: number, targetIndex: number, edge: Edge | null) => {
      if (!onReorder) return
      const ids = items.map((i) => i.id)
      onReorder(reorderIds(ids, sourceIndex, targetIndex, edge, 'horizontal'))
    },
    [items, onReorder]
  )

  const cardRefs = useRef(new Map<number, HTMLDivElement>())
  const [focusedIndex, setFocusedIndex] = useState(0)
  useEffect(() => {
    if (focusedIndex > items.length - 1) setFocusedIndex(Math.max(0, items.length - 1))
  }, [items.length, focusedIndex])

  const rowCount = Math.ceil(items.length / columns)
  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => rowHeight,
    overscan: 2
  })

  // Ширина сетки меняется при ресайзе окна и открытии панели фильтров — виртуализатор
  // держит замеры в кеше и не пересчитает их, пока его об этом не попросят.
  useEffect(() => {
    virtualizer.measure()
  }, [rowHeight, virtualizer])

  const focusIndex = useCallback(
    (index: number) => {
      const clamped = Math.max(0, Math.min(items.length - 1, index))
      setFocusedIndex(clamped)
      virtualizer.scrollToIndex(Math.floor(clamped / columns), { align: 'auto' })
      requestAnimationFrame(() => cardRefs.current.get(clamped)?.focus())
    },
    [items.length, columns, virtualizer]
  )

  function handleGridKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    switch (event.key) {
      case 'ArrowRight':
        event.preventDefault()
        focusIndex(focusedIndex + 1)
        return
      case 'ArrowLeft':
        event.preventDefault()
        focusIndex(focusedIndex - 1)
        return
      case 'ArrowDown':
        event.preventDefault()
        focusIndex(focusedIndex + columns)
        return
      case 'ArrowUp':
        event.preventDefault()
        focusIndex(focusedIndex - columns)
        return
      case 'Delete': {
        const ids = selection.size > 0 ? [...selection] : items[focusedIndex] ? [items[focusedIndex]!.id] : []
        if (ids.length > 0) onRequestDelete(ids)
        return
      }
      default:
        return
    }
  }

  const registerRef = useCallback((index: number, el: HTMLDivElement | null) => {
    if (el) cardRefs.current.set(index, el)
    else cardRefs.current.delete(index)
  }, [])

  if (groupBy !== 'none') {
    const groups = groupItems(items, groupBy, groupLabelFor)
    return (
      <div ref={scrollRef} className="h-full overflow-y-auto px-6 pb-24 pt-4">
        {groups.map((group) => (
          <CollapsibleSection
            key={group.key}
            title={group.label}
            count={group.items.length}
            storageKey={`collection-group-${groupBy}-${group.key}`}
            className="mb-2"
          >
            <div
              className="grid"
              style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${cardWidth}px, 1fr))`, gap: GAP }}
            >
              <AnimatePresence initial={false}>
                {group.items.map((item) => (
                  <GameCard
                    key={item.id}
                    game={item}
                    size={size}
                    scope={scope}
                    selected={selection.has(item.id)}
                    tabbable
                    secondaryField={secondaryField}
                    showPositionNumber={showPositionNumbers}
                    animateLayout={animateLayout}
                    extra={renderItemExtra?.(item)}
                    onOpen={() => onOpen(item.id)}
                    onToggleSelect={(opts) => onToggleSelect(item.id, opts)}
                    onEdit={() => onEdit(item.id)}
                    onChanged={onChanged}
                    onFocusVisible={() => undefined}
                  />
                ))}
              </AnimatePresence>
            </div>
          </CollapsibleSection>
        ))}
      </div>
    )
  }

  return (
    <div
      ref={scrollRef}
      className="h-full overflow-y-auto px-6 pb-24 pt-4 outline-none"
      role="grid"
      aria-rowcount={rowCount}
      onKeyDown={handleGridKeyDown}
    >
      <div style={{ height: virtualizer.getTotalSize(), position: 'relative', width: '100%' }}>
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const start = virtualRow.index * columns
          const rowItems = items.slice(start, start + columns)
          return (
            <div
              key={virtualRow.key}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualRow.start}px)`,
                display: 'grid',
                gridTemplateColumns: `repeat(${columns}, 1fr)`,
                gap: GAP,
                paddingBottom: GAP
              }}
            >
              {rowItems.map((item, col) => {
                const index = start + col
                return (
                  <GridItemSlot
                    key={item.id}
                    item={item}
                    index={index}
                    scope={scope}
                    size={size}
                    selected={selection.has(item.id)}
                    tabbable={index === focusedIndex}
                    secondaryField={secondaryField}
                    showPositionNumbers={showPositionNumbers}
                    animateLayout={animateLayout}
                    dragEnabled={dragEnabled}
                    dragState={dragState}
                    onDragStateChange={onDragStateChange}
                    onHoverChange={onHoverChange}
                    onDropped={onDropped}
                    renderItemExtra={renderItemExtra}
                    onToggleSelect={onToggleSelect}
                    onOpen={onOpen}
                    onEdit={onEdit}
                    onChanged={onChanged}
                    onFocusVisible={() => setFocusedIndex(index)}
                    registerRef={registerRef}
                  />
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}

interface GridItemSlotProps {
  item: GameCardDto
  index: number
  scope: CollectionScope
  size: CardSize
  selected: boolean
  tabbable: boolean
  secondaryField: Settings['cardSecondaryField']
  showPositionNumbers: boolean
  animateLayout: boolean
  dragEnabled: boolean
  dragState: DragState
  onDragStateChange: (draggingId: string | null) => void
  onHoverChange: (state: { overId: string | null; edge: Edge | null }) => void
  onDropped: (sourceId: string, sourceIndex: number, targetIndex: number, edge: Edge | null) => void
  renderItemExtra?: (game: GameCardDto) => ReactNode
  onToggleSelect: (id: string, opts: { rangeFrom?: boolean }) => void
  onOpen: (id: string) => void
  onEdit: (id: string) => void
  onChanged: () => void
  onFocusVisible: () => void
  registerRef: (index: number, el: HTMLDivElement | null) => void
}

function GridItemSlot({
  item,
  index,
  scope,
  size,
  selected,
  tabbable,
  secondaryField,
  showPositionNumbers,
  animateLayout,
  dragEnabled,
  dragState,
  onDragStateChange,
  onHoverChange,
  onDropped,
  renderItemExtra,
  onToggleSelect,
  onOpen,
  onEdit,
  onChanged,
  onFocusVisible,
  registerRef
}: GridItemSlotProps): ReactElement {
  const elRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const el = elRef.current
    if (!dragEnabled || !el) return
    return attachReorderable({
      element: el,
      id: item.id,
      index,
      axis: 'horizontal',
      onDragStateChange,
      onHoverChange,
      onDropped
    })
  }, [dragEnabled, item.id, index, onDragStateChange, onHoverChange, onDropped])

  const setRef = useCallback(
    (el: HTMLDivElement | null) => {
      elRef.current = el
      registerRef(index, el)
    },
    [index, registerRef]
  )

  return (
    <GameCard
      ref={setRef}
      game={item}
      size={size}
      scope={scope}
      selected={selected}
      tabbable={tabbable}
      secondaryField={secondaryField}
      showPositionNumber={showPositionNumbers}
      animateLayout={animateLayout}
      dragging={dragState.draggingId === item.id}
      dropTarget={dragState.overId === item.id && dragState.draggingId !== item.id}
      extra={renderItemExtra?.(item)}
      onOpen={() => onOpen(item.id)}
      onToggleSelect={(opts) => onToggleSelect(item.id, opts)}
      onEdit={() => onEdit(item.id)}
      onChanged={onChanged}
      onFocusVisible={onFocusVisible}
    />
  )
}
