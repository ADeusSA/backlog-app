import { useQuery } from '@tanstack/react-query'
import { ListPlus, Tags, Trash2, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { STATUS_ORDER, type GameStatus } from '@shared/constants'
import type { CollectionScope } from '@shared/schema/filters'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { StatusDot } from '@/components/ui/status-badge'
import { toast } from '@/components/ui/toast'
import { call } from '@/platform/api'

interface Props {
  ids: string[]
  scope: CollectionScope
  onDone: () => void
  onClear: () => void
}

/** Панель массовых операций над выделенными карточками (ТЗ 07 §3). */
export function BulkActionsBar({ ids, scope, onDone, onClear }: Props): React.ReactElement {
  const { t } = useTranslation()
  const { data: lists } = useQuery({ queryKey: ['lists'], queryFn: () => call('lists.list') })
  const { data: tags } = useQuery({ queryKey: ['catalog', 'tags'], queryFn: () => call('catalog.tags.list') })

  const run = (promise: Promise<unknown>, message: string): void => {
    promise
      .then(() => {
        toast({ title: message, tone: 'success' })
        onDone()
      })
      .catch((err: Error) => toast({ title: err.message, tone: 'danger' }))
  }

  return (
    <div
      className="glass mx-6 mb-4 flex items-center gap-2 rounded-[var(--r-lg)] px-4 py-2"
      style={{ border: '1px solid var(--border-1)', boxShadow: 'var(--shadow-2)' }}
      role="toolbar"
      aria-label={t('common.selected', { count: ids.length })}
    >
      <span className="type-body tabular">{t('common.selected', { count: ids.length })}</span>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="secondary" size="sm">
            {t('action.changeStatus')}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          {STATUS_ORDER.map((status) => (
            <DropdownMenuItem
              key={status}
              onSelect={() =>
                run(
                  call('userGame.bulkStatus', { gameIds: ids, status: status as GameStatus }),
                  t('collection.statusChanged', { count: ids.length })
                )
              }
            >
              <StatusDot status={status} />
              {t(`status.${status}`)}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="secondary" size="sm">
            <ListPlus size={14} strokeWidth={1.75} />
            {t('action.addToList')}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="max-h-[50vh] overflow-y-auto">
          {(lists ?? []).map((list) => (
            <DropdownMenuItem
              key={list.id}
              onSelect={() =>
                run(
                  call('lists.addGames', { listId: list.id, gameIds: ids }),
                  t('collection.addedToList', { name: list.name })
                )
              }
            >
              {list.name}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="secondary" size="sm">
            <Tags size={14} strokeWidth={1.75} />
            {t('catalog.entity.tags')}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="max-h-[50vh] overflow-y-auto">
          {(tags ?? []).map((tag) => (
            <DropdownMenuItem
              key={tag.id}
              onSelect={() =>
                run(
                  call('userGame.bulkTags', { gameIds: ids, addTagIds: [tag.id], removeTagIds: [] }),
                  t('collection.tagged', { name: tag.name })
                )
              }
            >
              {tag.name}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {scope.kind === 'list' && (
        <Button
          variant="danger"
          size="sm"
          onClick={() =>
            run(
              call('lists.removeGames', { listId: scope.listId, gameIds: ids }),
              t('collection.removedFromList', { count: ids.length })
            )
          }
        >
          <Trash2 size={14} strokeWidth={1.75} />
          {t('collection.removeFromList')}
        </Button>
      )}

      <div className="flex-1" />
      <Button variant="icon" size="sm" aria-label={t('action.cancel')} onClick={onClear}>
        <X size={16} strokeWidth={1.75} />
      </Button>
    </div>
  )
}
