import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Command } from 'cmdk'
import {
  Building2,
  Dices,
  Layers,
  LayoutGrid,
  ListChecks,
  PanelLeft,
  Plus,
  RefreshCw,
  Settings2,
  SunMoon
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { CoverImage } from '@/components/ui/image'
import { StatusDot } from '@/components/ui/status-badge'
import { useSettingsStore } from '@/stores/settings-store'
import { useUiStore } from '@/stores/ui-store'
import { resolveTheme } from '@/lib/theme'
import { call } from '@/platform/api'
import { toast } from '@/components/ui/toast'

/** Командная палитра Ctrl+K (ТЗ 05 §6). Поиск идёт через FTS5 с транслитерацией на backend. */
export function CommandPalette(): React.ReactElement {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const open = useUiStore((s) => s.commandPaletteOpen)
  const setOpen = useUiStore((s) => s.setCommandPaletteOpen)
  const [input, setInput] = useState('')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState('')

  // Дебаунс 60 мс (05 §6)
  useEffect(() => {
    const timer = setTimeout(() => setQuery(input.trim()), 60)
    return () => clearTimeout(timer)
  }, [input])

  useEffect(() => {
    if (!open) setInput('')
  }, [open])

  const { data: results } = useQuery({
    queryKey: ['search', query],
    queryFn: () => call('search.query', { q: query, limit: 8 }),
    enabled: open && query.length > 0
  })

  const { data: recent } = useQuery({
    queryKey: ['search', 'recent'],
    queryFn: () => call('search.recent'),
    enabled: open && query.length === 0
  })

  const go = (to: string): void => {
    setOpen(false)
    void navigate({ to })
  }


  const commands = useMemo(
    () => [
      { id: 'new-game', icon: Plus, label: t('palette.newGame'), run: () => go('/catalog/games/new') },
      { id: 'new-company', icon: Building2, label: t('palette.newCompany'), run: () => go('/catalog/companies/new') },
      { id: 'new-series', icon: Layers, label: t('palette.newSeries'), run: () => go('/catalog/series/new') },
      { id: 'new-list', icon: ListChecks, label: t('palette.newList'), run: () => go('/lists') },
      { id: 'settings', icon: Settings2, label: t('palette.settings'), run: () => go('/settings/general') },
      {
        id: 'sync',
        icon: RefreshCw,
        label: t('palette.sync'),
        run: () => {
          setOpen(false)
          void call('sync.now').catch((err: Error) => toast({ title: err.message, tone: 'danger' }))
        }
      },
      {
        id: 'random',
        icon: Dices,
        label: t('palette.random'),
        run: () => {
          setOpen(false)
          void call('collection.random', { scope: { kind: 'library', status: 'backlog' }, filters: {} })
            .then((game) => {
              if (game) void navigate({ to: '/games/$gameId', params: { gameId: game.id } })
              else toast({ title: t('palette.randomEmpty') })
            })
            .catch((err: Error) => toast({ title: err.message, tone: 'danger' }))
        }
      },
      {
        id: 'sidebar',
        icon: PanelLeft,
        label: t('palette.sidebar'),
        run: () => {
          setOpen(false)
          useUiStore.getState().toggleSidebar()
        }
      },
      { id: 'library', icon: LayoutGrid, label: t('palette.library'), run: () => go('/library') },
      {
        id: 'theme',
        icon: SunMoon,
        label: t('palette.theme'),
        run: () => {
          setOpen(false)
          // Переключаем то, что видно сейчас: из «системной» уходим в противоположную ей.
          const store = useSettingsStore.getState()
          const next = resolveTheme(store.settings.theme) === 'dark' ? 'light' : 'dark'
          void store.patch({ theme: next })
        }
      }
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t]
  )

  const filteredCommands = useMemo(
    () =>
      query.length === 0
        ? commands
        : commands.filter((command) =>
            command.label.toLowerCase().includes(query.toLowerCase().replace(/^>\s*/, ''))
          ),
    [commands, query]
  )
  /**
   * Плоский список пунктов в порядке отображения: значение → действие.
   * По нему работают выделение и Enter — полагаться на внутренний выбор cmdk
   * не получилось (при `shouldFilter={false}` он не выделял пункт, и Enter
   * не срабатывал вовсе, ТЗ 05 §6).
   */
  const items = useMemo(() => {
    const list: Array<{ value: string; run: () => void }> = []
    if (query.length === 0) {
      for (const item of recent ?? []) {
        list.push({
          value: `recent-${item.entityType}-${item.id}`,
          run: () => go(hrefFor(item.entityType, item.id))
        })
      }
    }
    for (const game of results?.games ?? []) {
      list.push({ value: `game-${game.id}`, run: () => go(`/games/${game.id}`) })
    }
    for (const item of results?.series ?? []) {
      list.push({ value: `series-${item.id}`, run: () => go(`/series/${item.id}`) })
    }
    for (const item of results?.companies ?? []) {
      list.push({ value: `company-${item.id}`, run: () => go(`/companies/${item.id}`) })
    }
    for (const item of results?.lists ?? []) {
      list.push({ value: `list-${item.id}`, run: () => go(`/lists/${item.id}`) })
    }
    for (const command of filteredCommands) {
      list.push({ value: `cmd-${command.id}`, run: command.run })
    }
    if (query.length > 0) {
      list.push({
        value: 'show-all',
        run: () => go(`/search?q=${encodeURIComponent(query)}`)
      })
    }
    return list
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results, recent, filteredCommands, query])

  const firstValue = items[0]?.value ?? ''

  useEffect(() => {
    if (firstValue) setSelected(firstValue)
  }, [firstValue])

  /** Enter: выполняем выделенный пункт, а если выделения нет — первый в списке. */
  const runSelected = (): void => {
    const target = items.find((item) => item.value === selected) ?? items[0]
    target?.run()
  }

  /** Стрелки: сдвигаем выделение по плоскому списку (cmdk этого не делает при shouldFilter=false). */
  const moveSelection = (delta: number): void => {
    if (items.length === 0) return
    const index = items.findIndex((item) => item.value === selected)
    const next = (((index < 0 ? 0 : index) + delta) % items.length + items.length) % items.length
    setSelected(items[next]!.value)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent size={640} className="top-[12vh] translate-y-0 p-0" aria-label={t('nav.search')}>
        {/* Выделение контролируем сами: при выключенной фильтрации cmdk не выбирает
            первый пункт автоматически, и Enter оказывался «в пустоту» (05 §6). */}
        <Command
          shouldFilter={false}
          loop
          value={selected}
          onValueChange={setSelected}
          className="flex max-h-[60vh] flex-col"
        >
          <Command.Input
            value={input}
            onValueChange={setInput}
            autoFocus
            placeholder={t('nav.search')}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                runSelected()
              } else if (event.key === 'ArrowDown') {
                event.preventDefault()
                moveSelection(1)
              } else if (event.key === 'ArrowUp') {
                event.preventDefault()
                moveSelection(-1)
              }
            }}
            className="h-[52px] w-full bg-transparent px-4 type-body outline-none"
            style={{ borderBottom: '1px solid var(--border-1)', color: 'var(--text-1)' }}
          />
          <Command.List className="overflow-y-auto p-2">
            <Command.Empty className="px-3 py-6 text-center type-small" style={{ color: 'var(--text-3)' }}>
              {t('empty.filters')}
            </Command.Empty>

            {query.length === 0 && (recent?.length ?? 0) > 0 && (
              <Command.Group heading={t('palette.recent')} className="type-caption">
                {recent?.map((item) => (
                  <PaletteItem
                    key={`${item.entityType}-${item.id}`}
                    value={`recent-${item.entityType}-${item.id}`}
                    active={selected === `recent-${item.entityType}-${item.id}`}
                    onSelect={() => go(hrefFor(item.entityType, item.id))}
                  >
                    <CoverImage fileName={item.coverFile} title={item.name} ratio="3/4" size={24} />
                    <span className="truncate">{item.name}</span>
                  </PaletteItem>
                ))}
              </Command.Group>
            )}

            {results && results.games.length > 0 && (
              <Command.Group heading={t('palette.games')} className="type-caption">
                {results.games.map((game) => (
                  <PaletteItem
                    key={game.id}
                    value={`game-${game.id}`}
                    active={selected === `game-${game.id}`}
                    onSelect={() => go(`/games/${game.id}`)}
                  >
                    <CoverImage
                      fileName={game.coverFile}
                      title={game.title}
                      dominantColor={game.dominantColor}
                      ratio="3/4"
                      size={24}
                    />
                    <span className="truncate">{game.title}</span>
                    {game.releaseYear && (
                      <span className="type-small tabular" style={{ color: 'var(--text-3)' }}>
                        {game.releaseYear}
                      </span>
                    )}
                    {game.status && <StatusDot status={game.status} />}
                  </PaletteItem>
                ))}
              </Command.Group>
            )}

            {results && results.series.length > 0 && (
              <Command.Group heading={t('palette.series')} className="type-caption">
                {results.series.map((item) => (
                  <PaletteItem
                    key={item.id}
                    value={`series-${item.id}`}
                    active={selected === `series-${item.id}`}
                    onSelect={() => go(`/series/${item.id}`)}
                  >
                    <Layers size={16} strokeWidth={1.75} />
                    <span className="truncate">{item.name}</span>
                  </PaletteItem>
                ))}
              </Command.Group>
            )}

            {results && results.companies.length > 0 && (
              <Command.Group heading={t('palette.companies')} className="type-caption">
                {results.companies.map((item) => (
                  <PaletteItem
                    key={item.id}
                    value={`company-${item.id}`}
                    active={selected === `company-${item.id}`}
                    onSelect={() => go(`/companies/${item.id}`)}
                  >
                    <Building2 size={16} strokeWidth={1.75} />
                    <span className="truncate">{item.name}</span>
                  </PaletteItem>
                ))}
              </Command.Group>
            )}

            {results && results.lists.length > 0 && (
              <Command.Group heading={t('palette.lists')} className="type-caption">
                {results.lists.map((item) => (
                  <PaletteItem
                    key={item.id}
                    value={`list-${item.id}`}
                    active={selected === `list-${item.id}`}
                    onSelect={() => go(`/lists/${item.id}`)}
                  >
                    <ListChecks size={16} strokeWidth={1.75} />
                    <span className="truncate">{item.name}</span>
                  </PaletteItem>
                ))}
              </Command.Group>
            )}

            {filteredCommands.length > 0 && (
              <Command.Group heading={t('palette.commands')} className="type-caption">
                {filteredCommands.map((command) => (
                  <PaletteItem
                    key={command.id}
                    value={`cmd-${command.id}`}
                    active={selected === `cmd-${command.id}`}
                    onSelect={command.run}
                  >
                    <command.icon size={16} strokeWidth={1.75} />
                    <span className="truncate">{command.label}</span>
                  </PaletteItem>
                ))}
              </Command.Group>
            )}

            {query.length > 0 && (
              <PaletteItem
                value="show-all"
                active={selected === 'show-all'}
                onSelect={() => go(`/search?q=${encodeURIComponent(query)}`)}
              >
                <span style={{ color: 'var(--accent)' }}>{t('palette.showAll')}</span>
              </PaletteItem>
            )}
          </Command.List>
        </Command>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Пункт палитры. `value` обязателен и должен быть стабильным: cmdk хранит выделение
 * по значению, и без него Enter не срабатывает на динамических списках.
 */
function PaletteItem({
  value,
  active,
  children,
  onSelect
}: {
  value: string
  /** Подсветка нашим собственным выделением (см. items/selected выше). */
  active?: boolean
  children: React.ReactNode
  onSelect: () => void
}): React.ReactElement {
  return (
    <Command.Item
      value={value}
      onSelect={onSelect}
      data-active={active || undefined}
      className="flex cursor-default items-center gap-2 rounded-[var(--r-sm)] px-2 py-1.5 type-body data-[active]:bg-[var(--accent-soft)] data-[selected=true]:bg-[var(--accent-soft)]"
    >
      {children}
    </Command.Item>
  )
}

function hrefFor(entityType: string, id: string): string {
  switch (entityType) {
    case 'series':
      return `/series/${id}`
    case 'company':
      return `/companies/${id}`
    case 'list':
      return `/lists/${id}`
    default:
      return `/games/${id}`
  }
}
