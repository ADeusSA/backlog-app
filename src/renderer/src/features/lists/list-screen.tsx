import { useEffect, useRef, useState, type ReactElement } from 'react'
import { useNavigate, useParams } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Copy, Download, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { GameCardDto, ListDto } from '@shared/schema/entities'
import type { Sort } from '@shared/schema/filters'
import type { ListSortMode } from '@shared/constants'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { toast } from '@/components/ui/toast'
import { CoverImage } from '@/components/ui/image'
import { GameCollectionView } from '@/features/collection/game-collection-view'
import { call } from '@/platform/api'
import { formatPlaytime } from '@/lib/format'
import { LIST_ICONS, DEFAULT_LIST_ICON } from './components/list-icons'
import { ListFormDialog } from './components/list-form-dialog'
import { DeleteListDialog } from './components/delete-list-dialog'
import { AddGamesDialog } from './components/add-games-dialog'
import { ListItemExtra } from './components/list-item-extra'
import { exportListToMarkdown } from './export-markdown'

const SORT_BY_MODE: Record<ListSortMode, Sort> = {
  manual: { field: 'position', dir: 'asc' },
  title: { field: 'title', dir: 'asc' },
  release_date: { field: 'release_date', dir: 'desc' },
  added_at: { field: 'added_at', dir: 'desc' },
  rating: { field: 'rating', dir: 'desc' }
}

/** Обложка/иконка списка с цветом фона — headerSlot коллекции (06 §3.3). */
function ListCoverBadge({ list }: { list: ListDto }): ReactElement {
  const Icon = (list.icon && LIST_ICONS[list.icon]) || LIST_ICONS[DEFAULT_LIST_ICON]
  const color = list.color ?? 'var(--accent)'

  if (list.coverFile) {
    return <CoverImage fileName={list.coverFile} title={list.name} size={64} />
  }
  return (
    <div
      className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[var(--r-md)]"
      style={{ background: `color-mix(in srgb, ${color} 24%, var(--surface-1))` }}
    >
      {Icon && <Icon size={26} strokeWidth={1.5} style={{ color }} />}
    </div>
  )
}

/** Inline-редактирование названия списка по клику (07 §2). */
function InlineListTitle({ list, onSaved }: { list: ListDto; onSaved: (next: ListDto) => void }): ReactElement {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(list.name)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  async function commit(): Promise<void> {
    const trimmed = value.trim()
    setEditing(false)
    if (!trimmed || trimmed === list.name) {
      setValue(list.name)
      return
    }
    try {
      const saved = await call('lists.save', {
        id: list.id,
        name: trimmed,
        description: list.description,
        icon: list.icon,
        color: list.color,
        coverImageId: list.coverImageId,
        isRanked: list.isRanked,
        sortMode: list.sortMode,
        isPinned: list.isPinned
      })
      onSaved(saved)
    } catch (err) {
      toast({ title: (err as Error).message, tone: 'danger' })
      setValue(list.name)
    }
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onBlur={() => void commit()}
        onKeyDown={(event) => {
          if (event.key === 'Enter') void commit()
          if (event.key === 'Escape') {
            setValue(list.name)
            setEditing(false)
          }
        }}
        className="type-h1 w-full max-w-[420px] rounded-sm bg-transparent outline-none"
        style={{ borderBottom: '1px solid var(--border-focus)' }}
      />
    )
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="type-h1 rounded-sm text-left outline-none hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)]"
    >
      {list.name}
    </button>
  )
}

/** Страница списка (06 §3.3). */
export function ListScreen(): ReactElement {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { listId } = useParams({ strict: false }) as { listId: string }

  const { data: list, isLoading } = useQuery({
    queryKey: ['lists', listId],
    queryFn: () => call('lists.get', { id: listId }),
    enabled: Boolean(listId)
  })

  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)

  const { data: currentItems } = useQuery({
    queryKey: ['lists', listId, 'items'],
    queryFn: () => call('collection.query', { scope: { kind: 'list', listId }, filters: {}, sort: { field: 'position', dir: 'asc' } }),
    enabled: Boolean(listId) && addOpen
  })

  if (isLoading) return <div className="p-6" />

  if (!list) {
    return (
      <div className="p-6">
        <p className="type-body" style={{ color: 'var(--text-2)' }}>
          {t('error.not_found')}
        </p>
      </div>
    )
  }

  const years = list.yearFrom ? (list.yearTo && list.yearTo !== list.yearFrom ? `${list.yearFrom}–${list.yearTo}` : `${list.yearFrom}`) : null
  const subtitleParts = [
    t('common.games', { count: list.gameCount }),
    formatPlaytime(list.playtimeMinutes, true),
    ...(years ? [years] : [])
  ]

  async function refetch(): Promise<void> {
    await queryClient.invalidateQueries({ queryKey: ['lists', listId] })
  }

  async function exportMarkdown(): Promise<void> {
    if (!list) return
    try {
      const saved = await exportListToMarkdown(list, SORT_BY_MODE[list.sortMode], t)
      if (saved) toast({ title: t('lists.exported'), description: saved, tone: 'success' })
    } catch (err) {
      toast({ title: (err as Error).message, tone: 'danger' })
    }
  }

  async function duplicate(): Promise<void> {
    try {
      const copy = await call('lists.duplicate', { id: listId })
      await queryClient.invalidateQueries({ queryKey: ['lists'] })
      toast({ title: t('lists.duplicated'), tone: 'success' })
      await navigate({ to: '/lists/$listId', params: { listId: copy.id } })
    } catch (err) {
      toast({ title: (err as Error).message, tone: 'danger' })
    }
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <GameCollectionView
        scope={{ kind: 'list', listId }}
        title={list.name}
        titleSlot={<InlineListTitle list={list} onSaved={() => void refetch()} />}
        subtitle={subtitleParts.join(' · ')}
        headerSlot={
          <div className="flex items-start gap-3">
            <ListCoverBadge list={list} />
            {list.description && (
              <p className="type-small max-w-[42ch]" style={{ color: 'var(--text-2)' }}>
                {list.description}
              </p>
            )}
          </div>
        }
        actionsSlot={
          <>
            <Button variant="secondary" onClick={() => setAddOpen(true)}>
              <Plus size={16} strokeWidth={1.75} />
              {t('lists.addGames.title')}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="icon" aria-label={t('action.more') ?? undefined}>
                  <MoreHorizontal size={18} strokeWidth={1.75} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => setEditOpen(true)}>
                  <Pencil size={14} strokeWidth={1.75} />
                  {t('action.edit')}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => void duplicate()}>
                  <Copy size={14} strokeWidth={1.75} />
                  {t('lists.duplicate')}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => void exportMarkdown()}>
                  <Download size={14} strokeWidth={1.75} />
                  {t('lists.exportMarkdown')}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={() => setDeleteOpen(true)}
                  className="text-danger data-[highlighted]:bg-danger-soft"
                >
                  <Trash2 size={14} strokeWidth={1.75} />
                  {t('action.delete')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
        defaultSort={SORT_BY_MODE[list.sortMode]}
        reorderable
        onReorder={(orderedGameIds: string[]) => {
          void call('lists.reorder', { listId, orderedGameIds }).then(() => refetch())
        }}
        renderItemExtra={(game: GameCardDto) => <ListItemExtra listId={listId} game={game} />}
        breadcrumbContext={{ from: 'list', fromId: list.id, fromTitle: list.name }}
      />

      <ListFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        list={list}
        onSaved={() => void refetch()}
        onRequestDelete={() => setDeleteOpen(true)}
      />
      <DeleteListDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        listId={listId}
        listName={list.name}
        onDeleted={() => void navigate({ to: '/lists' })}
      />
      <AddGamesDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        listId={listId}
        existingGameIds={(currentItems?.items ?? []).map((item) => item.id)}
        onAdded={() => void refetch()}
      />
    </div>
  )
}
