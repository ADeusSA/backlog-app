import type { CSSProperties, ReactElement } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter'
import { ArrowLeft, ArrowRight, Check, GripHorizontal, Plus, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { FAVORITES_LIMIT } from '@shared/constants'
import type { GameCardDto } from '@shared/schema/entities'
import { Button } from '@/components/ui/button'
import { CoverImage } from '@/components/ui/image'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger
} from '@/components/ui/context-menu'
import { toast } from '@/components/ui/toast'
import { call } from '@/platform/api'
import {
  attachReorderable,
  REORDER_KEY,
  reorderIds,
  type Edge
} from '@/features/collection/reorder-dnd'
import { cn } from '@/lib/utils'
import { FavoritesPicker } from './favorites-picker'

const COVER = 140
const COVER_HEIGHT = Math.round((COVER * 4) / 3)
/** Сколько держать кнопку, чтобы включился режим перестановки. */
const LONG_PRESS_MS = 400

interface HoverState {
  overId: string | null
  edge: Edge | null
}

/**
 * «Топ любимых» (06 §1.4): горизонтальная лента до `FAVORITES_LIMIT` обложек с пустой
 * ячейкой в хвосте. Клик — страница игры; долгое нажатие или правая кнопка — режим
 * перестановки с drag-n-drop и корзиной.
 */
export function FavoritesStrip({ games }: { games: GameCardDto[] }): ReactElement {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [editing, setEditing] = useState(false)
  const [picking, setPicking] = useState(false)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [hover, setHover] = useState<HoverState>({ overId: null, edge: null })
  /** Оптимистичный порядок: пока запрос не вернулся, лента не должна прыгать. */
  const [localIds, setLocalIds] = useState<string[] | null>(null)

  useEffect(() => setLocalIds(null), [games])

  useEffect(() => {
    if (!editing) return
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setEditing(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [editing])

  const ids = localIds ?? games.map((game) => game.id)
  const cards = ids
    .map((id) => games.find((game) => game.id === id))
    .filter((game): game is GameCardDto => game != null)

  const save = useCallback(
    (next: string[]): void => {
      setLocalIds(next)
      void call('profile.patch', { favoriteGameIds: next })
        .then(() => queryClient.invalidateQueries({ queryKey: ['profile'] }))
        .catch((err: Error) => {
          setLocalIds(null)
          toast({ title: err.message, tone: 'danger' })
        })
    },
    [queryClient]
  )

  const remove = useCallback(
    (id: string): void => {
      const next = ids.filter((value) => value !== id)
      save(next)
      if (next.length === 0) setEditing(false)
    },
    [ids, save]
  )

  const move = useCallback(
    (id: string, delta: number): void => {
      const from = ids.indexOf(id)
      const to = from + delta
      if (from < 0 || to < 0 || to >= ids.length) return
      const next = [...ids]
      const [moved] = next.splice(from, 1)
      if (moved) next.splice(to, 0, moved)
      save(next)
    },
    [ids, save]
  )

  const onDropped = useCallback(
    (sourceId: string, sourceIndex: number, targetIndex: number, edge: Edge | null): void => {
      save(reorderIds(ids, sourceIndex, targetIndex, edge, 'horizontal'))
    },
    [ids, save]
  )

  return (
    <section className="flex flex-col gap-3">
      {/* Кнопка стоит сразу за заголовком: секция во всю ширину, у правого края она бы «повисла». */}
      <div className="flex items-center gap-3">
        <h2 className="type-caption">{t('profile.favorites.title')}</h2>
        {/* «Готово» показываем всегда, пока включён режим: иначе после удаления
            предпоследней обложки кнопка исчезала, а режим оставался включённым. */}
        {editing ? (
          <Button variant="secondary" size="sm" onClick={() => setEditing(false)}>
            <Check size={14} strokeWidth={1.75} />
            {t('profile.favorites.done')}
          </Button>
        ) : (
          cards.length > 1 && (
            <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
              <GripHorizontal size={14} strokeWidth={1.75} />
              {t('profile.favorites.reorder')}
            </Button>
          )
        )}
      </div>

      <ul className="flex gap-3 overflow-x-auto px-0.5 pb-2 pt-1">
        {cards.map((game, index) => (
          <FavoriteCard
            key={game.id}
            game={game}
            index={index}
            editing={editing}
            first={index === 0}
            last={index === cards.length - 1}
            dragging={draggingId === game.id}
            hover={hover.overId === game.id ? hover.edge : null}
            onOpen={() => void navigate({ to: '/games/$gameId', params: { gameId: game.id } })}
            onEnterEdit={() => setEditing(true)}
            onRemove={() => remove(game.id)}
            onMove={(delta) => move(game.id, delta)}
            onDragStateChange={setDraggingId}
            onHoverChange={setHover}
            onDropped={onDropped}
          />
        ))}

        {cards.length < FAVORITES_LIMIT && (
          <li className="shrink-0">
            <button
              type="button"
              onClick={() => setPicking(true)}
              aria-label={t('profile.favorites.add')}
              title={t('profile.favorites.add')}
              className="flex items-center justify-center rounded-[var(--r-md)] outline-none transition-[background,border-color] hover:bg-[var(--surface-2)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)]"
              style={{
                width: COVER,
                height: COVER_HEIGHT,
                background: 'var(--surface-1)',
                border: '1px dashed var(--border-2)',
                transitionDuration: 'var(--d-hover)'
              }}
            >
              <Plus size={20} strokeWidth={1.75} style={{ color: 'var(--text-3)' }} />
            </button>
          </li>
        )}

        {editing && <TrashCell onDropId={remove} />}
      </ul>

      <FavoritesPicker
        open={picking}
        onOpenChange={setPicking}
        selectedIds={ids}
        onPick={(gameId) => save([...ids, gameId])}
      />
    </section>
  )
}

interface FavoriteCardProps {
  game: GameCardDto
  index: number
  editing: boolean
  first: boolean
  last: boolean
  dragging: boolean
  hover: Edge | null
  onOpen: () => void
  onEnterEdit: () => void
  onRemove: () => void
  onMove: (delta: number) => void
  onDragStateChange: (id: string | null) => void
  onHoverChange: (state: HoverState) => void
  onDropped: (sourceId: string, sourceIndex: number, targetIndex: number, edge: Edge | null) => void
}

function FavoriteCard({
  game,
  index,
  editing,
  first,
  last,
  dragging,
  hover,
  onOpen,
  onEnterEdit,
  onRemove,
  onMove,
  onDragStateChange,
  onHoverChange,
  onDropped
}: FavoriteCardProps): ReactElement {
  const { t } = useTranslation()
  const ref = useRef<HTMLLIElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const longPressed = useRef(false)

  useEffect(() => {
    const element = ref.current
    if (!element || !editing) return
    return attachReorderable({
      element,
      id: game.id,
      index,
      axis: 'horizontal',
      onDragStateChange,
      onHoverChange,
      onDropped
    })
  }, [editing, game.id, index, onDragStateChange, onHoverChange, onDropped])

  const cancelPress = (): void => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
  }

  useEffect(() => cancelPress, [])

  const edgeStyle: CSSProperties =
    hover === 'left'
      ? { background: 'var(--accent)', left: -6 }
      : { background: 'var(--accent)', right: -6 }

  return (
    <li ref={ref} className="relative shrink-0">
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            role="link"
            tabIndex={0}
            aria-label={game.title}
            title={game.title}
            onPointerDown={() => {
              if (editing) return
              longPressed.current = false
              timer.current = setTimeout(() => {
                longPressed.current = true
                onEnterEdit()
              }, LONG_PRESS_MS)
            }}
            onPointerUp={cancelPress}
            onPointerLeave={cancelPress}
            onClick={() => {
              cancelPress()
              // Долгое нажатие уже включило перестановку — такой клик игру не открывает.
              if (longPressed.current || editing) {
                longPressed.current = false
                return
              }
              onOpen()
            }}
            onKeyDown={(event) => {
              if (event.key !== 'Enter' && event.key !== ' ') return
              event.preventDefault()
              onOpen()
            }}
            className={cn(
              'relative block rounded-[var(--r-md)] outline-none transition-[transform,opacity]',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)]',
              editing ? 'cursor-grab' : 'cursor-pointer hover:-translate-y-0.5',
              dragging && 'opacity-40'
            )}
            style={{ transitionDuration: 'var(--d-hover)' }}
          >
            <CoverImage
              fileName={game.coverFile}
              title={game.title}
              dominantColor={game.dominantColor}
              size={COVER}
            />
            {editing && (
              <span
                className="absolute left-1/2 top-2 flex size-6 -translate-x-1/2 items-center justify-center rounded-full"
                style={{ background: 'var(--scrim)' }}
              >
                <GripHorizontal size={14} strokeWidth={1.75} style={{ color: 'var(--text-1)' }} />
              </span>
            )}
          </div>
        </ContextMenuTrigger>

        <ContextMenuContent>
          <ContextMenuItem onSelect={onOpen}>{t('profile.favorites.open')}</ContextMenuItem>
          <ContextMenuItem onSelect={onEnterEdit}>
            <GripHorizontal size={14} strokeWidth={1.75} />
            {t('profile.favorites.reorder')}
          </ContextMenuItem>
          <ContextMenuItem disabled={first} onSelect={() => onMove(-1)}>
            <ArrowLeft size={14} strokeWidth={1.75} />
            {t('profile.favorites.moveLeft')}
          </ContextMenuItem>
          <ContextMenuItem disabled={last} onSelect={() => onMove(1)}>
            <ArrowRight size={14} strokeWidth={1.75} />
            {t('profile.favorites.moveRight')}
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onSelect={onRemove} style={{ color: 'var(--danger)' }}>
            <Trash2 size={14} strokeWidth={1.75} />
            {t('profile.favorites.remove')}
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {hover && (
        <span
          className="pointer-events-none absolute inset-y-0 w-0.5 rounded-[var(--r-pill)]"
          style={edgeStyle}
        />
      )}
    </li>
  )
}

/** Корзина: появляется в режиме перестановки и принимает перетаскиваемую обложку. */
function TrashCell({ onDropId }: { onDropId: (id: string) => void }): ReactElement {
  const { t } = useTranslation()
  const ref = useRef<HTMLLIElement>(null)
  const [over, setOver] = useState(false)

  useEffect(() => {
    const element = ref.current
    if (!element) return
    return dropTargetForElements({
      element,
      canDrop: ({ source }) => typeof source.data[REORDER_KEY] === 'string',
      onDragEnter: () => setOver(true),
      onDragLeave: () => setOver(false),
      onDrop: ({ source }) => {
        setOver(false)
        const id = source.data[REORDER_KEY]
        if (typeof id === 'string') onDropId(id)
      }
    })
  }, [onDropId])

  return (
    <li ref={ref} className="shrink-0">
      <div
        className="flex flex-col items-center justify-center gap-2 rounded-[var(--r-md)] px-3 text-center transition-[background,border-color]"
        style={{
          width: COVER,
          height: COVER_HEIGHT,
          background: over ? 'var(--danger-soft)' : 'var(--surface-1)',
          border: over ? '1px dashed var(--danger)' : '1px dashed var(--border-2)',
          transitionDuration: 'var(--d-hover)'
        }}
      >
        <Trash2
          size={20}
          strokeWidth={1.75}
          style={{ color: over ? 'var(--danger)' : 'var(--text-3)' }}
        />
        <span className="type-small" style={{ color: 'var(--text-3)' }}>
          {t('profile.favorites.trash')}
        </span>
      </div>
    </li>
  )
}
