import { useEffect, useMemo, useState, type ReactElement } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { ListChecks, Plus, Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { ListDto } from '@shared/schema/entities'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ProgressRing } from '@/components/ui/progress-ring'
import { EmptyState } from '@/components/ui/empty-state'
import { Select, SelectItem } from '@/components/ui/select'
import { CoverImage } from '@/components/ui/image'
import { call } from '@/platform/api'
import { LIST_ICONS, DEFAULT_LIST_ICON } from './components/list-icons'
import { ListFormDialog } from './components/list-form-dialog'

type SortMode = 'order' | 'name' | 'updated' | 'count'

function sortLists(lists: ListDto[], mode: SortMode): ListDto[] {
  const copy = [...lists]
  switch (mode) {
    case 'name':
      return copy.sort((a, b) => a.name.localeCompare(b.name))
    case 'updated':
      return copy.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    case 'count':
      return copy.sort((a, b) => b.gameCount - a.gameCount)
    case 'order':
    default:
      return copy.sort((a, b) => a.sortOrder - b.sortOrder)
  }
}

/** Мозаика из первых 4 обложек списка либо иконка на цветном фоне (06 §1.6, §3.1). */
function ListCoverMosaic({ list }: { list: ListDto }): ReactElement {
  const Icon = (list.icon && LIST_ICONS[list.icon]) || LIST_ICONS[DEFAULT_LIST_ICON]
  const color = list.color ?? 'var(--accent)'

  if (list.coverFile) {
    return <CoverImage fileName={list.coverFile} title={list.name} ratio="3/4" className="w-full" />
  }

  if (list.coverMosaic.length >= 2) {
    return (
      <div className="grid aspect-[3/4] w-full grid-cols-2 gap-0.5 overflow-hidden rounded-md">
        {Array.from({ length: 4 }, (_, i) => list.coverMosaic[i]).map((file, i) => (
          <div key={i} className="overflow-hidden bg-surface-2">
            {file && <CoverImage fileName={file} title="" className="h-full w-full" />}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div
      className="flex aspect-[3/4] w-full items-center justify-center rounded-md"
      style={{ background: `color-mix(in srgb, ${color} 22%, var(--surface-1))` }}
    >
      {Icon && <Icon size={32} strokeWidth={1.5} style={{ color }} />}
    </div>
  )
}

function ListCard({ list, onOpen }: { list: ListDto; onOpen: () => void }): ReactElement {
  const { t } = useTranslation()
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex flex-col gap-2 rounded-[var(--r-md)] p-2 text-left outline-none transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)]"
      style={{ transitionDuration: 'var(--d-hover)' }}
    >
      <ListCoverMosaic list={list} />
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <p className="type-h3 truncate text-text-1">{list.name}</p>
          <p className="type-small" style={{ color: 'var(--text-2)' }}>
            {t('common.games', { count: list.gameCount })}
          </p>
        </div>
        <ProgressRing
          done={list.completedCount}
          total={list.gameCount}
          size={24}
          showValue={false}
        />
      </div>
    </button>
  )
}

function NewListCard({ onClick }: { onClick: () => void }): ReactElement {
  const { t } = useTranslation()
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex aspect-[3/4] w-full flex-col items-center justify-center gap-2 rounded-[var(--r-md)] outline-none transition-colors hover:bg-surface-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)]"
      style={{ border: '1px dashed var(--border-2)', transitionDuration: 'var(--d-micro)' }}
    >
      <Plus size={22} strokeWidth={1.75} style={{ color: 'var(--text-3)' }} />
      <span className="type-small" style={{ color: 'var(--text-2)' }}>
        {t('nav.newList')}
      </span>
    </button>
  )
}

/** Все списки (06 §3.1). */
export function ListsScreen(): ReactElement {
  const { t } = useTranslation()
  const navigate = useNavigate()
  // «Новый список» в сайдбаре ведёт на `/lists?create=true` — открываем диалог сразу.
  const search = useSearch({ strict: false }) as { create?: boolean }
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<SortMode>('order')
  const [createOpen, setCreateOpen] = useState(Boolean(search.create))

  useEffect(() => {
    if (search.create) setCreateOpen(true)
  }, [search.create])

  const { data: lists, isLoading } = useQuery({
    queryKey: ['lists'],
    queryFn: () => call('lists.list')
  })

  const filtered = useMemo(() => {
    const source = lists ?? []
    const q = query.trim().toLowerCase()
    const byQuery = q ? source.filter((list) => list.name.toLowerCase().includes(q)) : source
    return sortLists(byQuery, sort)
  }, [lists, query, sort])

  return (
    <div className="flex flex-col gap-6 p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="type-h1">{t('nav.lists')}</h1>
          <p className="type-body" style={{ color: 'var(--text-2)' }}>
            {t('common.lists', { count: lists?.length ?? 0 })}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Input
            iconLeft={<Search size={16} strokeWidth={1.75} />}
            placeholder={t('common.search') ?? undefined}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="w-[220px]"
          />
          {/* Ширину задаём явно: триггер `Select` — `w-full`, и в строке он растягивался
              на всю шапку, выталкивая кнопку за край экрана. */}
          <Select<SortMode> value={sort} onChange={setSort} className="w-[190px]">
            <SelectItem value="order">{t('lists.sort.order')}</SelectItem>
            <SelectItem value="name">{t('lists.sort.name')}</SelectItem>
            <SelectItem value="updated">{t('lists.sort.updated')}</SelectItem>
            <SelectItem value="count">{t('lists.sort.count')}</SelectItem>
          </Select>
          <Button variant="primary" onClick={() => setCreateOpen(true)}>
            <Plus size={16} strokeWidth={1.75} />
            {t('nav.newList')}
          </Button>
        </div>
      </header>

      {!isLoading && filtered.length === 0 && (lists?.length ?? 0) === 0 && (
        <EmptyState
          icon={<ListChecks size={24} strokeWidth={1.75} />}
          title={t('empty.title')}
          description={t('lists.empty.description') ?? undefined}
          action={{ label: t('nav.newList'), onClick: () => setCreateOpen(true) }}
        />
      )}

      <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-4">
        {filtered.map((list) => (
          <ListCard
            key={list.id}
            list={list}
            onOpen={() => void navigate({ to: '/lists/$listId', params: { listId: list.id } })}
          />
        ))}
        <NewListCard onClick={() => setCreateOpen(true)} />
      </div>

      <ListFormDialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open)
          // Убираем `create` из адреса, иначе повторный клик в сайдбаре ничего не изменит.
          if (!open && search.create)
            void navigate({ to: '/lists', search: {} as never, replace: true })
        }}
        onSaved={(saved) => void navigate({ to: '/lists/$listId', params: { listId: saved.id } })}
      />
    </div>
  )
}
