import { useMemo } from 'react'
import { useRouterState } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { call } from '@/platform/api'
import { router } from '../router'

interface Crumb {
  key: string
  label: string
  href?: string
  /** Что показывать в выпадающем списке «соседей» после этого сегмента (05 §4.2). */
  siblings?: 'lists' | 'series' | 'companies' | 'statuses' | 'catalog'
}

/**
 * Хлебные крошки отражают логическое положение, а не историю (ТЗ 05 §4.2).
 * Клик по шеврону открывает список «соседей» следующего уровня — как в Проводнике.
 */
export function Breadcrumbs(): React.ReactElement | null {
  const { t } = useTranslation()
  const state = useRouterState({ select: (s) => ({ pathname: s.location.pathname, search: s.location.search }) })

  const { data: lists } = useQuery({
    queryKey: ['lists'],
    queryFn: () => call('lists.list'),
    enabled: state.pathname.startsWith('/lists')
  })
  const { data: series } = useQuery({
    queryKey: ['series'],
    queryFn: () => call('series.list'),
    enabled: state.pathname.startsWith('/series')
  })
  const { data: companies } = useQuery({
    queryKey: ['companies'],
    queryFn: () => call('companies.list'),
    enabled: state.pathname.startsWith('/companies')
  })

  // Название игры берём из того же кеша, что и страница игры, — document.title
  // обновляется позже и в крошках оказывался устаревшим.
  const gameId = state.pathname.startsWith('/games/') ? state.pathname.split('/')[2] : undefined
  const { data: game } = useQuery({
    queryKey: ['game', gameId],
    queryFn: () => call('games.getDetail', { id: gameId! }),
    enabled: Boolean(gameId)
  })

  const crumbs = useMemo<Crumb[]>(() => {
    const path = state.pathname
    const search = state.search as Record<string, string | undefined>

    if (path.startsWith('/library')) {
      const status = search['status'] ?? 'all'
      return [
        { key: 'library', label: t('nav.library'), href: '/library', siblings: 'statuses' },
        ...(status !== 'all'
          ? [{ key: `status-${status}`, label: t(`statusPlural.${status}`) }]
          : [])
      ]
    }

    if (path.startsWith('/lists/')) {
      const id = path.split('/')[2]
      const list = lists?.find((l) => l.id === id)
      return [
        { key: 'lists', label: t('nav.lists'), href: '/lists', siblings: 'lists' },
        { key: 'list', label: list?.name ?? '…' }
      ]
    }
    if (path === '/lists') return [{ key: 'lists', label: t('nav.lists'), siblings: 'lists' }]

    if (path.startsWith('/series/')) {
      const id = path.split('/')[2]
      const item = series?.find((s) => s.id === id)
      return [
        { key: 'series', label: t('nav.series'), href: '/series', siblings: 'series' },
        { key: 'one', label: item?.name ?? '…' }
      ]
    }
    if (path === '/series') return [{ key: 'series', label: t('nav.series'), siblings: 'series' }]

    if (path.startsWith('/companies/')) {
      const id = path.split('/')[2]
      const item = companies?.find((c) => c.id === id)
      return [
        { key: 'companies', label: t('nav.companies'), href: '/companies', siblings: 'companies' },
        { key: 'one', label: item?.name ?? '…' }
      ]
    }
    if (path === '/companies') return [{ key: 'companies', label: t('nav.companies'), siblings: 'companies' }]

    if (path.startsWith('/games/')) {
      const from = search['from']
      const fromId = search['fromId']
      const fromTitle = search['fromTitle']
      const head: Crumb[] =
        from === 'list' && fromId
          ? [
              { key: 'lists', label: t('nav.lists'), href: '/lists', siblings: 'lists' },
              { key: 'list', label: fromTitle ?? '…', href: `/lists/${fromId}` }
            ]
          : from === 'series' && fromId
            ? [
                { key: 'series', label: t('nav.series'), href: '/series', siblings: 'series' },
                { key: 'one', label: fromTitle ?? '…', href: `/series/${fromId}` }
              ]
            : from === 'company' && fromId
              ? [
                  { key: 'companies', label: t('nav.companies'), href: '/companies', siblings: 'companies' },
                  { key: 'one', label: fromTitle ?? '…', href: `/companies/${fromId}` }
                ]
              : [{ key: 'library', label: t('nav.library'), href: '/library', siblings: 'statuses' }]
      return [...head, { key: 'game', label: game?.title ?? '…' }]
    }

    if (path.startsWith('/catalog')) {
      const parts = path.split('/').filter(Boolean)
      const crumbs: Crumb[] = [
        { key: 'catalog', label: t('nav.catalog'), href: '/catalog', siblings: 'catalog' }
      ]
      if (parts[1]) crumbs.push({ key: 'entity', label: t(`catalog.entity.${parts[1]}`), href: `/catalog/${parts[1]}` })
      if (parts[2] === 'new') crumbs.push({ key: 'new', label: t('catalog.new') })
      else if (parts[3] === 'edit') crumbs.push({ key: 'edit', label: t('catalog.edit') })
      return crumbs
    }

    if (path.startsWith('/recap')) {
      return [
        { key: 'profile', label: t('nav.profile'), href: '/profile' },
        { key: 'recap', label: t('recap.heading') }
      ]
    }
    if (path.startsWith('/settings')) return [{ key: 'settings', label: t('nav.settings') }]
    if (path.startsWith('/search')) return [{ key: 'search', label: t('common.search') }]
    if (path.startsWith('/dev/ui')) return [{ key: 'dev', label: 'UI' }]
    return [{ key: 'profile', label: t('nav.profile') }]
  }, [state.pathname, state.search, lists, series, companies, game, t])

  if (crumbs.length === 0) return null

  const siblingItems = (kind: Crumb['siblings']): Array<{ id: string; name: string; href: string }> => {
    switch (kind) {
      case 'lists':
        return (lists ?? []).map((l) => ({ id: l.id, name: l.name, href: `/lists/${l.id}` }))
      case 'series':
        return (series ?? []).map((s) => ({ id: s.id, name: s.name, href: `/series/${s.id}` }))
      case 'companies':
        return (companies ?? []).map((c) => ({ id: c.id, name: c.name, href: `/companies/${c.id}` }))
      case 'statuses':
        return ['all', 'playing', 'backlog', 'completed', 'shelved', 'dropped', 'wishlist', 'played'].map(
          (status) => ({
            id: status,
            name: status === 'all' ? t('nav.all') : t(`statusPlural.${status}`),
            href: `/library?status=${status}`
          })
        )
      case 'catalog':
        return ['games', 'companies', 'series', 'genres', 'platforms', 'tags'].map((entity) => ({
          id: entity,
          name: t(`catalog.entity.${entity}`),
          href: `/catalog/${entity}`
        }))
      default:
        return []
    }
  }

  return (
    <nav className="no-drag flex min-w-0 items-center gap-0.5" aria-label="breadcrumbs">
      {crumbs.map((crumb, index) => (
        <span key={crumb.key} className="flex min-w-0 items-center">
          {crumb.href ? (
            <button
              type="button"
              className="truncate rounded-[var(--r-xs)] px-1.5 py-0.5 type-small hover:bg-[var(--surface-2)]"
              style={{ color: index === crumbs.length - 1 ? 'var(--text-1)' : 'var(--text-2)' }}
              onClick={() => void router.navigate({ to: crumb.href! })}
            >
              {crumb.label}
            </button>
          ) : (
            <span className="truncate px-1.5 py-0.5 type-small" style={{ color: 'var(--text-1)' }}>
              {crumb.label}
            </span>
          )}
          {crumb.siblings && index < crumbs.length && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="rounded-[var(--r-xs)] p-0.5 hover:bg-[var(--surface-2)]"
                  aria-label="Соседние разделы"
                >
                  <ChevronRight size={14} strokeWidth={1.75} style={{ color: 'var(--text-3)' }} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="max-h-[60vh] overflow-y-auto">
                {siblingItems(crumb.siblings).map((item) => (
                  <DropdownMenuItem key={item.id} onSelect={() => void router.navigate({ to: item.href })}>
                    {item.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </span>
      ))}
    </nav>
  )
}
