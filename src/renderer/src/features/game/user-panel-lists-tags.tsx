import type { ReactElement } from 'react'
import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { ListPlus, Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { TagDto } from '@shared/schema/entities'
import { Chip } from '@/components/ui/chip'
import { Combobox } from '@/components/ui/combobox'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/toast'
import { call } from '@/platform/api'
import { single } from '@/lib/form-utils'

/** Блок 9 «Списки» (06 §6.2.9): чипы текущих списков + попап «+ В список» с поиском/созданием. */
export function ListsBlock({ gameId }: { gameId: string }): ReactElement {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const { data } = useQuery({
    queryKey: ['lists', 'forGame', gameId],
    queryFn: () => call('lists.forGame', { gameId })
  })

  const lists = data ?? []
  const contains = lists.filter((l) => l.contains)
  const filtered = lists.filter((l) => l.name.toLowerCase().includes(query.trim().toLowerCase()))
  const exactMatch = lists.some((l) => l.name.toLowerCase() === query.trim().toLowerCase())

  function invalidate(): void {
    void queryClient.invalidateQueries({ queryKey: ['lists', 'forGame', gameId] })
  }

  async function toggle(listId: string, nextContains: boolean): Promise<void> {
    queryClient.setQueryData(['lists', 'forGame', gameId], (old: typeof lists | undefined) =>
      old?.map((l) => (l.id === listId ? { ...l, contains: nextContains } : l))
    )
    try {
      if (nextContains) await call('lists.addGames', { listId, gameIds: [gameId] })
      else await call('lists.removeGames', { listId, gameIds: [gameId] })
      invalidate()
    } catch (err) {
      invalidate()
      toast({ title: (err as Error).message, tone: 'danger' })
    }
  }

  async function createAndAdd(name: string): Promise<void> {
    try {
      const created = await call('lists.save', {
        name,
        isPinned: true,
        isRanked: false,
        sortMode: 'manual'
      })
      await call('lists.addGames', { listId: created.id, gameIds: [gameId] })
      setQuery('')
      invalidate()
    } catch (err) {
      toast({ title: (err as Error).message, tone: 'danger' })
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="type-caption">{t('game.panel.lists')}</span>
      <div className="flex flex-wrap items-center gap-1.5">
        {contains.map((list) => (
          <Chip
            key={list.id}
            color={list.color ?? undefined}
            onClick={() => void navigate({ to: '/lists/$listId', params: { listId: list.id } })}
            onRemove={() => void toggle(list.id, false)}
            removeLabel={t('action.delete')}
          >
            {list.name}
          </Chip>
        ))}
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Chip icon={<ListPlus size={14} strokeWidth={1.75} />}>{t('game.panel.lists.add')}</Chip>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-[260px] p-2">
            <Input
              autoFocus
              iconLeft={<Search size={14} strokeWidth={1.75} />}
              placeholder={t('game.panel.lists.search')}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <div className="mt-2 flex max-h-56 flex-col gap-0.5 overflow-y-auto">
              {filtered.map((list) => (
                <label
                  key={list.id}
                  className="flex h-8 cursor-pointer items-center gap-2 rounded-[var(--r-sm)] px-1.5 type-body hover:bg-surface-2"
                >
                  <Checkbox checked={list.contains} onChange={(checked) => void toggle(list.id, checked)} />
                  <span className="min-w-0 flex-1 truncate">{list.name}</span>
                </label>
              ))}
              {filtered.length === 0 && lists.length > 0 && (
                <p className="type-small px-1.5 py-2 text-text-3">{t('common.none')}</p>
              )}
              {lists.length === 0 && <p className="type-small px-1.5 py-2 text-text-3">{t('game.panel.lists.empty')}</p>}
            </div>
            {query.trim() && !exactMatch && (
              <Button variant="ghost" size="sm" className="mt-1 w-full justify-start" onClick={() => void createAndAdd(query.trim())}>
                <ListPlus size={14} strokeWidth={1.75} />
                {t('game.panel.lists.create', { name: query.trim() })}
              </Button>
            )}
          </PopoverContent>
        </Popover>
      </div>
    </div>
  )
}

/** Блок 10 «Теги» (06 §6.2.10): чипы + комбобокс с созданием на лету. */
export function TagsBlock({
  gameId,
  tags,
  onChange
}: {
  gameId: string
  tags: TagDto[]
  onChange: (tags: TagDto[]) => void
}): ReactElement {
  const { t } = useTranslation()
  const { data: allTags } = useQuery({ queryKey: ['catalog', 'tags'], queryFn: () => call('catalog.tags.list') })

  const currentIds = useMemo(() => new Set(tags.map((tag) => tag.id)), [tags])
  const options = (allTags ?? [])
    .filter((tag) => !currentIds.has(tag.id))
    .map((tag) => ({ value: tag.id, label: tag.name }))

  async function persist(next: TagDto[]): Promise<void> {
    onChange(next)
    try {
      await call('userGame.setTags', { gameId, tagIds: next.map((tag) => tag.id) })
    } catch (err) {
      toast({ title: (err as Error).message, tone: 'danger' })
    }
  }

  async function addTag(tagId: string): Promise<void> {
    const found = (allTags ?? []).find((tag) => tag.id === tagId)
    if (!found) return
    await persist([...tags, found])
  }

  async function createTag(name: string): Promise<void> {
    try {
      const created = await call('catalog.tags.save', { name })
      await persist([...tags, { id: created.id, name, color: null }])
    } catch (err) {
      toast({ title: (err as Error).message, tone: 'danger' })
    }
  }

  function removeTag(tagId: string): void {
    void persist(tags.filter((tag) => tag.id !== tagId))
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="type-caption">{t('game.panel.tags')}</span>
      <div className="flex flex-wrap items-center gap-1.5">
        {tags.map((tag) => (
          <Chip key={tag.id} color={tag.color ?? undefined} onRemove={() => removeTag(tag.id)} removeLabel={t('action.delete')}>
            {tag.name}
          </Chip>
        ))}
        <Combobox
          items={options}
          value={null}
          onChange={single<string>((value) => {
            if (value) void addTag(value)
          })}
          placeholder={t('game.panel.tags.placeholder')}
          emptyText={t('game.panel.tags.empty')}
          onCreate={(name) => void createTag(name)}
          createLabel={(name) => t('game.panel.tags.create', { name })}
          className="h-8 w-[180px]"
        />
      </div>
    </div>
  )
}
