import type { ReactElement, ReactNode } from 'react'
import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Clock3, Edit3, Heart, ListPlus, Star, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { GAME_STATUSES, STATUS_META, type GameStatus } from '@shared/constants'
import type { GameCardDto } from '@shared/schema/entities'
import type { CollectionScope } from '@shared/schema/filters'
import { StatusDot } from '@/components/ui/status-badge'
import { Kbd } from '@/components/ui/kbd'
import {
  ContextMenu,
  ContextMenuCheckboxItem,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger
} from '@/components/ui/context-menu'
import { call } from '@/platform/api'
import { toast } from '@/components/ui/toast'

export interface GameContextMenuProps {
  game: GameCardDto
  scope: CollectionScope
  children: ReactNode
  onOpenGame: () => void
  onEdit: () => void
  onChanged: () => void
}

/**
 * Контекстное меню карточки/строки (07 §3): Открыть · Сменить статус ▸ · Оценить ▸ ·
 * Добавить в список ▸ · Записать время · Избранное · Редактировать · Убрать из списка/библиотеки.
 */
export function GameContextMenu({
  game,
  scope,
  children,
  onOpenGame,
  onEdit,
  onChanged
}: GameContextMenuProps): ReactElement {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)

  const { data: lists } = useQuery({
    queryKey: ['lists', 'forGame', game.id],
    queryFn: () => call('lists.forGame', { gameId: game.id }),
    enabled: open
  })

  const refresh = (): void => {
    void queryClient.invalidateQueries()
    onChanged()
  }

  const setStatus = (status: GameStatus): void => {
    void call('userGame.setStatus', { gameId: game.id, status }).then(refresh)
  }

  const rate = (value: number): void => {
    void call('userGame.patch', { gameId: game.id, patch: { rating: game.rating === value ? null : value } }).then(
      refresh
    )
  }

  const toggleFavorite = (): void => {
    void call('userGame.patch', { gameId: game.id, patch: { isFavorite: !game.isFavorite } }).then(refresh)
  }

  const logTime = (minutes: number): void => {
    void call('userGame.addPlaytime', { gameId: game.id, minutes }).then(refresh)
  }

  const toggleList = (listId: string, contains: boolean): void => {
    const action = contains
      ? call('lists.removeGames', { listId, gameIds: [game.id] })
      : call('lists.addGames', { listId, gameIds: [game.id] })
    void action.then(refresh)
  }

  const removeFromList = (): void => {
    if (scope.kind !== 'list') return
    const listId = scope.listId
    void call('lists.removeGames', { listId, gameIds: [game.id] }).then(() => {
      refresh()
      toast({
        title: t('collection.toast.removedFromList', { title: game.title }),
        tone: 'info',
        action: { label: t('action.undo'), onClick: () => void call('lists.addGames', { listId, gameIds: [game.id] }).then(refresh) }
      })
    })
  }

  const removeFromLibrary = (): void => {
    void call('userGame.removeFromLibrary', { gameIds: [game.id] }).then(() => {
      refresh()
      toast({
        title: t('collection.toast.removedFromLibrary', { title: game.title }),
        tone: 'info',
        action: {
          label: t('action.undo'),
          onClick: () => void call('userGame.addToLibrary', { gameIds: [game.id], status: game.status ?? 'backlog' }).then(refresh)
        }
      })
    })
  }

  return (
    <ContextMenu onOpenChange={setOpen}>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-[220px]">
        <ContextMenuItem onSelect={onOpenGame}>{t('action.open')}</ContextMenuItem>

        <ContextMenuSub>
          <ContextMenuSubTrigger>{t('action.changeStatus')}</ContextMenuSubTrigger>
          <ContextMenuSubContent className="w-[220px]">
            {GAME_STATUSES.map((status) => (
              <ContextMenuItem key={status} onSelect={() => setStatus(status)}>
                <StatusDot status={status} />
                <span className="flex-1">{t(`status.${status}`)}</span>
                <Kbd keys={[String(STATUS_META[status].hotkey)]} />
              </ContextMenuItem>
            ))}
          </ContextMenuSubContent>
        </ContextMenuSub>

        <ContextMenuSub>
          <ContextMenuSubTrigger>
            <Star size={14} strokeWidth={1.75} />
            <span className="ml-2">{t('action.rate')}</span>
          </ContextMenuSubTrigger>
          <ContextMenuSubContent className="w-[160px]">
            <div className="grid grid-cols-5 gap-1 p-1.5">
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => rate(n)}
                  className="type-small tabular flex h-7 items-center justify-center rounded-sm outline-none hover:bg-surface-2"
                  style={{ color: game.rating === n ? 'var(--success)' : 'var(--text-2)' }}
                >
                  {n}
                </button>
              ))}
            </div>
          </ContextMenuSubContent>
        </ContextMenuSub>

        <ContextMenuSub>
          <ContextMenuSubTrigger>
            <ListPlus size={14} strokeWidth={1.75} />
            <span className="ml-2">{t('action.addToList')}</span>
          </ContextMenuSubTrigger>
          <ContextMenuSubContent className="max-h-64 w-[220px] overflow-y-auto">
            {(lists ?? []).length === 0 && (
              <div className="type-small px-2 py-2 text-text-2">{t('collection.contextMenu.noLists')}</div>
            )}
            {(lists ?? []).map((list) => (
              <ContextMenuCheckboxItem
                key={list.id}
                checked={list.contains}
                onSelect={(e) => {
                  e.preventDefault()
                  toggleList(list.id, list.contains)
                }}
              >
                {list.name}
              </ContextMenuCheckboxItem>
            ))}
          </ContextMenuSubContent>
        </ContextMenuSub>

        <ContextMenuSub>
          <ContextMenuSubTrigger>
            <Clock3 size={14} strokeWidth={1.75} />
            <span className="ml-2">{t('action.logTime')}</span>
          </ContextMenuSubTrigger>
          <ContextMenuSubContent className="w-[160px]">
            <ContextMenuItem onSelect={() => logTime(15)}>{t('collection.quickTime.plus15')}</ContextMenuItem>
            <ContextMenuItem onSelect={() => logTime(60)}>{t('collection.quickTime.plus1h')}</ContextMenuItem>
            <ContextMenuItem onSelect={() => logTime(120)}>{t('collection.quickTime.plus2h')}</ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuSub>

        <ContextMenuItem onSelect={toggleFavorite}>
          <Heart
            size={14}
            strokeWidth={1.75}
            style={game.isFavorite ? { fill: 'var(--danger)', color: 'var(--danger)' } : undefined}
          />
          <span className="ml-2">{t('action.favorite')}</span>
        </ContextMenuItem>

        <ContextMenuSeparator />

        <ContextMenuItem onSelect={onEdit}>
          <Edit3 size={14} strokeWidth={1.75} />
          <span className="ml-2">{t('action.edit')}</span>
        </ContextMenuItem>

        {scope.kind === 'list' && (
          <ContextMenuItem onSelect={removeFromList} className="text-danger">
            <Trash2 size={14} strokeWidth={1.75} />
            <span className="ml-2">{t('collection.contextMenu.removeFromList')}</span>
          </ContextMenuItem>
        )}
        <ContextMenuItem onSelect={removeFromLibrary} className="text-danger">
          <Trash2 size={14} strokeWidth={1.75} />
          <span className="ml-2">{t('action.removeFromLibrary')}</span>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
