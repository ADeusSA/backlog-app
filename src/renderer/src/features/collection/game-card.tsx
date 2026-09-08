import type { KeyboardEvent, ReactElement, ReactNode } from 'react'
import { forwardRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'motion/react'
import { Check, CircleCheckBig, Clock3, Heart, ListPlus, Star, Trophy } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  MASTERABLE_STATUSES,
  RATING_LABEL_KEYS,
  STATUS_META,
  STATUS_ORDER,
  type CardSize,
  type GameStatus
} from '@shared/constants'
import type { GameCardDto } from '@shared/schema/entities'
import type { CollectionScope } from '@shared/schema/filters'
import type { Settings } from '@shared/schema/settings'
import { CoverImage } from '@/components/ui/image'
import { StatusBadge } from '@/components/ui/status-badge'
import { RatingStars } from '@/components/ui/rating-stars'
import { Checkbox } from '@/components/ui/checkbox'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cardBorder, cardTint } from '@/lib/color'
import { formatPlaytime } from '@/lib/format'
import { cn } from '@/lib/utils'
import { call } from '@/platform/api'
import { transitions, variants } from '@/lib/motion'
import { GameContextMenu } from './game-context-menu'

export interface GameCardProps {
  game: GameCardDto
  size: CardSize
  scope: CollectionScope
  selected: boolean
  tabbable: boolean
  secondaryField: Settings['cardSecondaryField']
  showPositionNumber?: boolean
  animateLayout: boolean
  extra?: ReactNode
  /** Перетаскивается прямо сейчас (07 §9 drag-n-drop ручного порядка). */
  dragging?: boolean
  /** Над карточкой сейчас проносят другую — подсветить как цель вставки. */
  dropTarget?: boolean
  onOpen: () => void
  onToggleSelect: (opts: { rangeFrom?: boolean }) => void
  onEdit: () => void
  onChanged: () => void
  onFocusVisible: () => void
}

type QuickPopover = 'status' | 'time' | 'list' | 'rate' | null

/** Карточка игры сетки (04 §3.5, 07 §3). */
export const GameCard = forwardRef<HTMLDivElement, GameCardProps>(function GameCard(
  {
    game,
    size,
    scope,
    selected,
    tabbable,
    secondaryField,
    showPositionNumber,
    animateLayout,
    extra,
    dragging,
    dropTarget,
    onOpen,
    onToggleSelect,
    onEdit,
    onChanged,
    onFocusVisible
  },
  ref
): ReactElement {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [hovered, setHovered] = useState(false)
  const [quickPopover, setQuickPopover] = useState<QuickPopover>(null)

  const status = game.status
  const canMaster = status != null && MASTERABLE_STATUSES.includes(status)
  const showBadge = status != null && status !== 'backlog' && status !== 'completed'
  const showCheck = status === 'completed'
  const showTrophy = canMaster && game.isMastered

  const refresh = (): void => {
    void queryClient.invalidateQueries()
    onChanged()
  }

  const setStatus = (next: GameStatus): void => {
    void call('userGame.setStatus', { gameId: game.id, status: next }).then(refresh)
    setQuickPopover(null)
  }
  const rate = (value: number | null): void => {
    void call('userGame.patch', { gameId: game.id, patch: { rating: value } }).then(refresh)
  }
  const logTime = (minutes: number): void => {
    void call('userGame.addPlaytime', { gameId: game.id, minutes }).then(refresh)
    setQuickPopover(null)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    if (event.key === 'Enter') {
      event.preventDefault()
      onOpen()
    } else if (event.key === ' ') {
      event.preventDefault()
      onToggleSelect({ rangeFrom: event.shiftKey })
    }
  }

  const secondaryText = formatSecondary(game, secondaryField, t)
  const statusLabel = status ? t(`status.${status}`) : null

  const card = (
    <motion.div
      ref={ref}
      layout={animateLayout || undefined}
      variants={animateLayout ? variants.card : undefined}
      initial={animateLayout ? 'hidden' : undefined}
      animate={animateLayout ? 'visible' : undefined}
      exit={animateLayout ? 'exit' : undefined}
      role="gridcell"
      aria-selected={selected}
      data-card-size={size}
      tabIndex={tabbable ? 0 : -1}
      onFocus={onFocusVisible}
      onKeyDown={handleKeyDown}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => {
        setHovered(false)
        setQuickPopover(null)
      }}
      onClick={(event) => {
        if (event.ctrlKey || event.metaKey) onToggleSelect({})
        else if (event.shiftKey) onToggleSelect({ rangeFrom: true })
        else onOpen()
      }}
      className="group relative flex cursor-pointer flex-col gap-1.5 rounded-md p-[5px] outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)]"
      style={{
        background: selected ? 'var(--accent-soft)' : cardTint(status, hovered),
        border: dropTarget
          ? '1px dashed var(--accent)'
          : `1px solid ${selected ? 'var(--accent-border)' : cardBorder(status)}`,
        opacity: dragging ? 0.5 : 1,
        cursor: dragging ? 'grabbing' : 'pointer',
        transitionProperty: 'background,border-color,box-shadow,opacity',
        transitionDuration: 'var(--d-hover)',
        transitionTimingFunction: 'var(--ease-standard)',
        boxShadow: dropTarget
          ? 'var(--ring-accent)'
          : hovered
            ? 'var(--shadow-2), var(--ring-accent)'
            : 'var(--shadow-1)'
      }}
      whileHover={{ y: -4, scale: 1.02 }}
      transition={transitions.hover}
    >
      <div className="relative">
        <CoverImage
          fileName={game.coverFile}
          title={game.title}
          dominantColor={game.dominantColor}
          ratio="3/4"
          className={cn(
            'transition-[filter] duration-[var(--d-hover)]',
            hovered && 'brightness-[1.06]'
          )}
        />

        {/* верхний левый угол: чекбокс выбора ИЛИ текстовый бейдж статуса */}
        <div className="absolute left-1.5 top-1.5">
          {selected || hovered ? (
            <span
              className="flex h-5 w-5 items-center justify-center rounded-xs"
              style={{ background: 'var(--scrim)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <Checkbox checked={selected} onChange={() => onToggleSelect({})} />
            </span>
          ) : (
            showBadge &&
            status && <StatusBadge status={status} label={statusLabel ?? undefined} />
          )}
        </div>

        {/* верхний правый угол: галочка «пройдено» + трофей «100%» */}
        {(showCheck || showTrophy) && (
          <div className="absolute right-1.5 top-1.5 flex items-center gap-1">
            {showTrophy && (
              <span
                className="flex h-5 w-5 items-center justify-center rounded-full"
                style={{ background: 'var(--warning)', color: 'var(--warning-on)' }}
                title={t('collection.card.mastered')}
              >
                <Trophy size={11} strokeWidth={1.75} />
              </span>
            )}
            {showCheck && (
              <span
                className="flex h-5 w-5 items-center justify-center rounded-full"
                style={{ background: 'var(--success)', color: 'var(--success-on)' }}
              >
                <CircleCheckBig size={12} strokeWidth={1.75} />
              </span>
            )}
          </div>
        )}

        {/* нижний левый угол: номер позиции (ранжированные списки/серии) */}
        {showPositionNumber && game.position != null && (
          <div
            className="absolute bottom-1 left-1.5 type-h2 tabular"
            style={{ color: 'var(--text-1)', textShadow: 'var(--cover-text-shadow)' }}
          >
            {game.position}
          </div>
        )}

        {/* нижний правый угол: избранное */}
        {game.isFavorite && (
          <div className="absolute bottom-1 right-1.5">
            <Heart size={16} strokeWidth={1.75} style={{ color: 'var(--danger)', fill: 'var(--danger)' }} />
          </div>
        )}

        {extra}

        {/* панель быстрых действий на hover (07 §3) */}
        <div
          className={cn(
            'absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 rounded-b-md p-1 opacity-0 transition-opacity group-hover:opacity-100',
            'group-focus-within:opacity-100'
          )}
          style={{
            background: 'var(--scrim-gradient)',
            transitionDuration: 'var(--d-hover)'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <QuickAction
            icon={<StatusIndicatorIcon status={status} />}
            label={t('action.changeStatus')}
            open={quickPopover === 'status'}
            onOpenChange={(open) => setQuickPopover(open ? 'status' : null)}
          >
            {/* Список статусов рисуем прямо в поповере: вложенное меню (StatusPicker)
                открывалось в своём портале, поповер считал это кликом снаружи и
                закрывался вместе с ним — выбрать статус было невозможно. */}
            <QuickStatusList current={status} labels={buildStatusLabels(t)} onPick={setStatus} />
          </QuickAction>
          <QuickAction
            icon={<Clock3 size={14} strokeWidth={1.75} />}
            label={t('action.logTime')}
            open={quickPopover === 'time'}
            onOpenChange={(open) => setQuickPopover(open ? 'time' : null)}
          >
            <div className="flex w-[140px] flex-col gap-1">
              <QuickTimeButton onClick={() => logTime(15)} label={t('collection.quickTime.plus15')} />
              <QuickTimeButton onClick={() => logTime(60)} label={t('collection.quickTime.plus1h')} />
              <QuickTimeButton onClick={() => logTime(120)} label={t('collection.quickTime.plus2h')} />
            </div>
          </QuickAction>
          <QuickAction
            icon={<ListPlus size={14} strokeWidth={1.75} />}
            label={t('action.addToList')}
            open={quickPopover === 'list'}
            onOpenChange={(open) => setQuickPopover(open ? 'list' : null)}
          >
            <QuickListContent gameId={game.id} onChanged={refresh} />
          </QuickAction>
          <QuickAction
            icon={<Star size={14} strokeWidth={1.75} />}
            label={t('action.rate')}
            open={quickPopover === 'rate'}
            onOpenChange={(open) => setQuickPopover(open ? 'rate' : null)}
          >
            <RatingStars value={game.rating} onChange={rate} ariaLabel={t('action.rate')} showLabel labels={ratingLabels(t)} />
          </QuickAction>
        </div>
      </div>

      <div className="flex flex-col px-0.5">
        <span className="type-small truncate font-semibold text-text-1" title={game.title}>
          {game.title}
        </span>
        <div className="type-caption flex items-center justify-between normal-case tracking-normal" style={{ color: 'var(--text-2)' }}>
          {game.rating ? (
            <span className="tabular" style={{ color: 'var(--success)' }}>
              {'★'.repeat(Math.floor(game.rating / 2))}
              {game.rating % 2 === 1 ? '½' : ''}
            </span>
          ) : (
            <span style={{ color: statusLabel ? `var(${status ? STATUS_META[status].colorVar : ''})` : undefined }}>
              {statusLabel ?? t('status.none')}
            </span>
          )}
          <span className="tabular truncate pl-1">{secondaryText}</span>
        </div>
      </div>
    </motion.div>
  )

  return (
    <GameContextMenu game={game} scope={scope} onOpenGame={onOpen} onEdit={onEdit} onChanged={onChanged}>
      {card}
    </GameContextMenu>
  )
})

function QuickAction({
  icon,
  label,
  open,
  onOpenChange,
  children
}: {
  icon: ReactNode
  label: string
  open: boolean
  onOpenChange: (open: boolean) => void
  children: ReactNode
}): ReactElement {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={label}
          title={label}
          className="flex h-7 w-7 items-center justify-center rounded-sm text-text-1 outline-none hover:bg-[var(--surface-2)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)]"
        >
          {icon}
        </button>
      </PopoverTrigger>
      <PopoverContent align="center" className="w-auto p-2">
        {children}
      </PopoverContent>
    </Popover>
  )
}

function QuickTimeButton({ onClick, label }: { onClick: () => void; label: string }): ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      className="type-small flex h-8 items-center rounded-sm px-2 text-left text-text-1 outline-none hover:bg-surface-2"
    >
      {label}
    </button>
  )
}

function QuickListContent({ gameId, onChanged }: { gameId: string; onChanged: () => void }): ReactElement {
  const { t } = useTranslation()
  const { data: lists } = useQuery({ queryKey: ['lists', 'forGame', gameId], queryFn: () => call('lists.forGame', { gameId }) })
  return (
    <div className="flex max-h-64 w-[220px] flex-col gap-0.5 overflow-y-auto">
      {(lists ?? []).length === 0 && <p className="type-small px-1 py-1 text-text-2">{t('collection.contextMenu.noLists')}</p>}
      {(lists ?? []).map((list) => (
        <button
          key={list.id}
          type="button"
          onClick={() => {
            const action = list.contains
              ? call('lists.removeGames', { listId: list.id, gameIds: [gameId] })
              : call('lists.addGames', { listId: list.id, gameIds: [gameId] })
            void action.then(onChanged)
          }}
          className="type-small flex h-8 items-center gap-2 rounded-sm px-2 text-left text-text-1 outline-none hover:bg-surface-2"
        >
          <span
            className={cn(
              'flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border',
              list.contains ? 'border-transparent bg-accent text-accent-on' : 'border-border-2'
            )}
          >
            {list.contains && <Check size={11} strokeWidth={2.5} />}
          </span>
          <span className="truncate">{list.name}</span>
        </button>
      ))}
    </div>
  )
}

/** Плоский список статусов для быстрого действия на карточке (07 §3). */
function QuickStatusList({
  current,
  labels,
  onPick
}: {
  current: GameStatus | null
  labels: Record<GameStatus, { title: string; description: string }>
  onPick: (status: GameStatus) => void
}): ReactElement {
  return (
    <div className="flex w-[220px] flex-col gap-0.5" role="menu">
      {STATUS_ORDER.map((status) => (
        <button
          key={status}
          type="button"
          role="menuitemradio"
          aria-checked={current === status}
          className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-left type-body hover:bg-surface-2"
          style={{ background: current === status ? 'var(--accent-soft)' : undefined }}
          onClick={() => onPick(status)}
        >
          <StatusIndicatorIcon status={status} />
          <span className="min-w-0 flex-1 truncate">{labels[status].title}</span>
          {current === status && (
            <Check size={14} strokeWidth={1.75} style={{ color: 'var(--accent)' }} />
          )}
        </button>
      ))}
    </div>
  )
}

function StatusIndicatorIcon({ status }: { status: GameStatus | null }): ReactElement {
  return (
    <span
      className="inline-block h-2.5 w-2.5 rounded-full"
      style={{ background: status ? `var(${STATUS_META[status].colorVar})` : 'var(--text-3)' }}
    />
  )
}

function formatSecondary(
  game: GameCardDto,
  field: Settings['cardSecondaryField'],
  t: (key: string, opts?: Record<string, unknown>) => string
): string {
  switch (field) {
    case 'developer':
      return game.developer ?? '—'
    case 'genre':
      return game.primaryGenre ?? '—'
    case 'rating':
      return game.rating ? `${game.rating}/10` : t('rating.none')
    case 'metacritic':
      return game.metacriticScore != null ? String(game.metacriticScore) : '—'
    case 'platform':
      return game.myPlatform ?? game.platforms ?? '—'
    case 'added_at':
      return game.addedAt ? game.addedAt.slice(0, 10) : '—'
    case 'year_playtime':
    default:
      return [game.releaseYear ?? '—', game.playtimeMinutes ? formatPlaytime(game.playtimeMinutes, true) : null]
        .filter(Boolean)
        .join(' · ')
  }
}

function ratingLabels(t: (key: string) => string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const key of Object.values(RATING_LABEL_KEYS)) out[key] = t(key)
  return out
}

function buildStatusLabels(t: (key: string) => string): Record<GameStatus, { title: string; description: string }> {
  const out = {} as Record<GameStatus, { title: string; description: string }>
  for (const key of Object.keys(STATUS_META) as GameStatus[]) {
    out[key] = { title: t(`status.${key}`), description: t(`status.${key}.desc`) }
  }
  return out
}
