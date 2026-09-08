import { useEffect, useRef, useState } from 'react'
import { useNavigate, useRouterState } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter'
import {
  Building2,
  ChevronsLeft,
  ChevronsRight,
  Layers,
  ListChecks,
  Plus,
  Settings2,
  Tags,
  type LucideIcon
} from 'lucide-react'
import * as Icons from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { GameStatus } from '@shared/constants'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Avatar } from '@/components/ui/avatar'
import { ProgressRing } from '@/components/ui/progress-ring'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/toast'
import { call } from '@/platform/api'
import { cn } from '@/lib/utils'
import { statusColor } from '@/lib/color'
import { useUiStore } from '@/stores/ui-store'

const LIBRARY_ITEMS: Array<{ status: GameStatus | 'all'; icon: LucideIcon }> = [
  { status: 'all', icon: Icons.Library },
  { status: 'playing', icon: Icons.Play },
  { status: 'backlog', icon: Icons.LibraryBig },
  { status: 'completed', icon: Icons.CircleCheckBig },
  { status: 'shelved', icon: Icons.CirclePause },
  { status: 'dropped', icon: Icons.CircleX },
  { status: 'wishlist', icon: Icons.Heart }
]

/** Сайдбар-рельса 72 px, развёрнутый 240 px (ТЗ 05 §3, 04 §3.8). */
export function Sidebar(): React.ReactElement {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const collapsed = useUiStore((s) => s.sidebarCollapsed)
  const toggleSidebar = useUiStore((s) => s.toggleSidebar)
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const search = useRouterState({ select: (s) => s.location.search }) as Record<string, string>

  const { data: stats } = useQuery({ queryKey: ['stats'], queryFn: () => call('stats.get') })
  const { data: lists } = useQuery({
    queryKey: ['lists', 'pinned'],
    queryFn: () => call('lists.list', { pinnedOnly: true })
  })
  const { data: profile } = useQuery({ queryKey: ['profile'], queryFn: () => call('profile.get') })

  const countFor = (status: GameStatus | 'all'): number | undefined => {
    if (!stats) return undefined
    // «Все» открывает вид без фильтра по статусу, поэтому и счётчик — по всем записям,
    // иначе он расходился с числом карточек (в частности, на «Поиграл» и «Хочу»).
    if (status === 'all') return stats.totals.all
    return stats.byStatus.find((s) => s.status === status)?.count
  }

  const width = collapsed ? 'var(--w-rail)' : 'var(--w-sidebar)'

  return (
    <aside
      className="glass relative z-20 flex shrink-0 flex-col py-3"
      style={{ width, transition: `width var(--d-enter) var(--ease-standard)` }}
    >
      <button
        type="button"
        className={cn(
          'mx-3 mb-2 flex items-center gap-3 rounded-[var(--r-md)] p-1.5 text-left',
          'hover:bg-[var(--surface-2)]'
        )}
        onClick={() => void navigate({ to: '/profile' })}
      >
        <Avatar
          name={profile?.displayName ?? '—'}
          src={profile?.avatarFile ?? undefined}
          size={collapsed ? 32 : 36}
        />
        {!collapsed && (
          <span className="min-w-0 flex-1">
            <span className="block truncate type-h3">{profile?.displayName ?? '—'}</span>
            <span className="block type-small" style={{ color: 'var(--text-2)' }}>
              {t('nav.level', { level: profile?.level ?? 1 })}
            </span>
          </span>
        )}
        {!collapsed && stats && (
          <ProgressRing
            done={stats.totals.completed}
            total={Math.max(1, stats.totals.inLibrary)}
            size={24}
          />
        )}
      </button>

      {/* Прокручивается только середина: «Добавить контент», «Настройки» и кнопка
          сворачивания должны оставаться внизу панели (05 §3). */}
      <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
        <SidebarSection title={t('nav.library')} collapsed={collapsed}>
          {LIBRARY_ITEMS.map((item) => {
            const active =
              pathname.startsWith('/library') && (search['status'] ?? 'all') === item.status
            return (
              <SidebarItem
                key={item.status}
                icon={item.icon}
                label={item.status === 'all' ? t('nav.all') : t(`statusPlural.${item.status}`)}
                count={countFor(item.status)}
                active={active}
                collapsed={collapsed}
                accentDot={item.status !== 'all' ? statusColor(item.status) : undefined}
                onClick={() =>
                  void navigate({ to: '/library', search: { status: item.status } as never })
                }
                dropStatus={item.status === 'all' ? undefined : item.status}
              />
            )
          })}
        </SidebarSection>

        <SidebarSection title={t('nav.lists')} collapsed={collapsed}>
          {(lists ?? []).map((list) => {
            const Icon =
              (list.icon &&
                (Icons as unknown as Record<string, LucideIcon>)[toPascal(list.icon)]) ||
              ListChecks
            return (
              <SidebarItem
                key={list.id}
                icon={Icon}
                label={list.name}
                count={list.gameCount}
                active={pathname === `/lists/${list.id}`}
                collapsed={collapsed}
                accentDot={list.color ?? undefined}
                onClick={() => void navigate({ to: '/lists/$listId', params: { listId: list.id } })}
                dropListId={list.id}
              />
            )
          })}
          <SidebarItem
            icon={Plus}
            label={t('nav.newList')}
            collapsed={collapsed}
            onClick={() => void navigate({ to: '/lists', search: { create: true } as never })}
          />
        </SidebarSection>

        <SidebarSection title={t('nav.catalog')} collapsed={collapsed}>
          <SidebarItem
            icon={Layers}
            label={t('nav.series')}
            active={pathname.startsWith('/series')}
            collapsed={collapsed}
            onClick={() => void navigate({ to: '/series' })}
          />
          <SidebarItem
            icon={Building2}
            label={t('nav.companies')}
            active={pathname.startsWith('/companies')}
            collapsed={collapsed}
            onClick={() => void navigate({ to: '/companies' })}
          />
          <SidebarItem
            icon={Tags}
            label={t('nav.taxonomy')}
            active={pathname.startsWith('/catalog/genres') || pathname.startsWith('/catalog/tags')}
            collapsed={collapsed}
            onClick={() => void navigate({ to: '/catalog/$entity', params: { entity: 'genres' } })}
          />
        </SidebarSection>
      </div>

      <div className="flex flex-col gap-1 px-3 pt-2">
        <Button
          variant="accent"
          size={collapsed ? 'sm' : 'md'}
          aria-label={t('nav.addContent')}
          onClick={() => void navigate({ to: '/catalog' })}
        >
          <Plus size={16} strokeWidth={1.75} />
          {!collapsed && <span>{t('nav.addContent')}</span>}
        </Button>
        <SidebarItem
          icon={Settings2}
          label={t('nav.settings')}
          collapsed={collapsed}
          active={pathname.startsWith('/settings')}
          onClick={() =>
            void navigate({ to: '/settings/$section', params: { section: 'general' } })
          }
        />
        <SidebarItem
          icon={collapsed ? ChevronsRight : ChevronsLeft}
          label={collapsed ? t('nav.expand') : t('nav.collapse')}
          collapsed={collapsed}
          onClick={toggleSidebar}
        />
      </div>
    </aside>
  )
}

function SidebarSection({
  title,
  collapsed,
  children
}: {
  title: string
  collapsed: boolean
  children: React.ReactNode
}): React.ReactElement {
  return (
    <section className="flex flex-col gap-0.5 px-3 pb-2">
      {!collapsed && <h2 className="type-caption px-2 pb-1">{title}</h2>}
      {children}
    </section>
  )
}

interface SidebarItemProps {
  icon: LucideIcon
  label: string
  count?: number
  active?: boolean
  collapsed: boolean
  accentDot?: string
  onClick: () => void
  /** Цель для перетаскивания игры: сменить статус (05 §3). */
  dropStatus?: GameStatus
  /** Цель для перетаскивания игры: добавить в список. */
  dropListId?: string
}

function SidebarItem({
  icon: Icon,
  label,
  count,
  active,
  collapsed,
  accentDot,
  onClick,
  dropStatus,
  dropListId
}: SidebarItemProps): React.ReactElement {
  const ref = useRef<HTMLButtonElement>(null)
  const [over, setOver] = useState(false)
  const queryClient = useQueryClient()

  useEffect(() => {
    const element = ref.current
    if (!element || (!dropStatus && !dropListId)) return
    return dropTargetForElements({
      element,
      canDrop: ({ source }) => typeof source.data['gameId'] === 'string',
      onDragEnter: () => setOver(true),
      onDragLeave: () => setOver(false),
      onDrop: ({ source }) => {
        setOver(false)
        const gameId = source.data['gameId']
        if (typeof gameId !== 'string') return
        const done = async (): Promise<void> => {
          if (dropStatus) await call('userGame.setStatus', { gameId, status: dropStatus })
          else if (dropListId)
            await call('lists.addGames', { listId: dropListId, gameIds: [gameId] })
          await queryClient.invalidateQueries()
          toast({ title: label, description: 'Готово', tone: 'success' })
        }
        void done().catch((err: Error) => toast({ title: err.message, tone: 'danger' }))
      }
    })
  }, [dropStatus, dropListId, label, queryClient])

  const button = (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex h-[44px] items-center gap-3 rounded-[var(--r-md)] px-2.5 text-left type-body',
        collapsed && 'w-[44px] justify-center px-0'
      )}
      style={{
        background: over
          ? 'var(--accent-soft)'
          : active
            ? collapsed
              ? 'var(--accent)'
              : 'var(--accent-soft)'
            : 'transparent',
        color: active ? (collapsed ? 'var(--accent-on)' : 'var(--text-1)') : 'var(--text-2)',
        boxShadow: over ? 'var(--ring-accent)' : undefined,
        transition: `background var(--d-micro) var(--ease-standard)`
      }}
    >
      <span className="relative flex items-center">
        <Icon
          size={20}
          strokeWidth={1.75}
          style={{ color: active && !collapsed ? 'var(--accent)' : undefined }}
        />
        {collapsed && accentDot && (
          <span
            className="absolute -right-1 -top-1 size-1.5 rounded-full"
            style={{ background: accentDot }}
          />
        )}
      </span>
      {!collapsed && <span className="min-w-0 flex-1 truncate">{label}</span>}
      {!collapsed && count != null && (
        <span className="type-small tabular" style={{ color: 'var(--text-3)' }}>
          {count}
        </span>
      )}
    </button>
  )

  if (!collapsed) return button
  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent side="right">
        {label}
        {count != null ? ` · ${count}` : ''}
      </TooltipContent>
    </Tooltip>
  )
}

/** 'circle-check-big' → 'CircleCheckBig' — имена иконок lucide хранятся в kebab-case. */
function toPascal(name: string): string {
  return name
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('')
}
