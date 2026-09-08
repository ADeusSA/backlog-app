import { useEffect, useRef, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ArrowRight, Gamepad2, Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Kbd } from '@/components/ui/kbd'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Breadcrumbs } from './breadcrumbs'
import { SyncIndicator } from './sync-indicator'
import { useUiStore } from '@/stores/ui-store'
import { router } from '../router'

/**
 * Собственный заголовок окна, 44 px (ТЗ 05 §2).
 * Системные кнопки рисует Windows (Window Controls Overlay), поэтому правый край
 * ограничен `env(titlebar-area-width)`.
 */
export function Titlebar(): React.ReactElement {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const openPalette = useUiStore((s) => s.setCommandPaletteOpen)
  const history = useUiStore((s) => s.history)
  const historyIndex = useUiStore((s) => s.historyIndex)

  const backEntries = history.slice(Math.max(0, historyIndex - 10), historyIndex).reverse()
  const forwardEntries = history.slice(historyIndex + 1, historyIndex + 11)

  return (
    <header
      className="drag-region relative z-30 flex shrink-0 items-center gap-2 pl-3 pr-2"
      style={{ height: 'var(--h-titlebar)', width: 'env(titlebar-area-width, 100%)' }}
    >
      <button
        type="button"
        className="no-drag flex size-[26px] items-center justify-center rounded-[8px]"
        style={{ background: 'var(--accent)', color: 'var(--accent-on)' }}
        aria-label={t('nav.profile')}
        onClick={() => void navigate({ to: '/profile' })}
      >
        <Gamepad2 size={16} strokeWidth={1.75} />
      </button>

      <nav className="no-drag flex items-center gap-1" aria-label={t('nav.back')}>
        <HistoryButton
          direction="back"
          entries={backEntries}
          disabled={historyIndex <= 0}
          label={t('nav.back')}
        />
        <HistoryButton
          direction="forward"
          entries={forwardEntries}
          disabled={historyIndex >= history.length - 1}
          label={t('nav.forward')}
        />
      </nav>

      <Breadcrumbs />

      <div className="drag-region flex-1" />

      <button
        type="button"
        onClick={() => openPalette(true)}
        className="no-drag flex h-[28px] items-center gap-2 rounded-[var(--r-pill)] px-3 type-small"
        style={{
          background: 'var(--surface-1)',
          border: '1px solid var(--border-1)',
          color: 'var(--text-3)'
        }}
      >
        <Search size={14} strokeWidth={1.75} />
        <span className="hidden md:inline">{t('nav.search')}</span>
        <Kbd keys={['Ctrl', 'K']} />
      </button>

      <SyncIndicator />
    </header>
  )
}

interface HistoryButtonProps {
  direction: 'back' | 'forward'
  entries: Array<{ href: string; title: string }>
  disabled: boolean
  label: string
}

/** Задержка, после которой удержание кнопки открывает список истории (05 §2). */
const LONG_PRESS_MS = 450

/**
 * Кнопка истории: короткий клик — шаг назад/вперёд, удержание или ПКМ — список
 * последних 10 записей. Radix открывает меню по `pointerdown`, поэтому событие
 * гасится, а состояние `open` контролируется вручную.
 */
function HistoryButton({ direction, entries, disabled, label }: HistoryButtonProps): React.ReactElement {
  const Icon = direction === 'back' ? ArrowLeft : ArrowRight
  const resolveTitle = useHistoryTitle()
  const [open, setOpen] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const longPressed = useRef(false)

  const step = (): void => {
    if (direction === 'back') router.history.back()
    else router.history.forward()
  }

  const clearTimer = (): void => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
  }

  useEffect(() => clearTimer, [])

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              variant="icon"
              size="sm"
              aria-label={label}
              disabled={disabled}
              onPointerDown={(event) => {
                event.preventDefault()
                if (disabled || entries.length === 0) return
                longPressed.current = false
                timer.current = setTimeout(() => {
                  longPressed.current = true
                  setOpen(true)
                }, LONG_PRESS_MS)
              }}
              onPointerUp={clearTimer}
              onPointerLeave={clearTimer}
              onClick={(event) => {
                event.preventDefault()
                clearTimer()
                if (longPressed.current) return
                step()
              }}
              onContextMenu={(event) => {
                event.preventDefault()
                if (entries.length > 0) setOpen(true)
              }}
            >
              <Icon size={16} strokeWidth={1.75} />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="start" className="max-h-[60vh] overflow-y-auto">
        {entries.map((entry, index) => (
          <DropdownMenuItem
            key={`${entry.href}-${index}`}
            onSelect={() => {
              void router.navigate({ to: entry.href })
            }}
          >
            {resolveTitle(entry)}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/**
 * Подставляет имя сущности в заголовок записи истории. В момент перехода данных
 * ещё нет, поэтому трекер пишет родовое «Игра»/«Список», а конкретное название
 * берётся из кеша запросов при отрисовке списка.
 */
function useHistoryTitle(): (entry: { href: string; title: string }) => string {
  const client = useQueryClient()

  return (entry) => {
    const [, section, id] = (entry.href.split('?')[0] ?? '').split('/')
    if (!id) return entry.title

    if (section === 'games') {
      return (client.getQueryData(['game', id]) as { title?: string } | undefined)?.title ?? entry.title
    }
    const listKey = { lists: 'lists', series: 'series', companies: 'companies' }[section ?? '']
    if (!listKey) return entry.title
    const items = client.getQueryData([listKey]) as Array<{ id: string; name: string }> | undefined
    return items?.find((item) => item.id === id)?.name ?? entry.title
  }
}
