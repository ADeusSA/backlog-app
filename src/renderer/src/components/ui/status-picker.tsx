import type { ReactElement } from 'react'
import { ChevronDown, Circle } from 'lucide-react'
import { motion } from 'motion/react'
import type { GameStatus } from '@shared/constants'
import { GAME_STATUSES, STATUS_META } from '@shared/constants'
import { cn } from '@/lib/utils'
import { statusColor } from '@/lib/color'
import { transitions } from '@/lib/motion'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './dropdown-menu'
import { STATUS_ICONS, StatusDot } from './status-badge'
import { Kbd } from './kbd'

export interface StatusPickerLabel {
  title: string
  description: string
}

export interface StatusPickerProps {
  value: GameStatus | null
  onChange: (value: GameStatus) => void
  disabled?: boolean
  align?: 'start' | 'center' | 'end'
  /** Названия/описания статусов (i18n снаружи) — по одному на каждый `GameStatus`. */
  labels: Record<GameStatus, StatusPickerLabel>
  /** Текст, когда статус не выбран. */
  placeholder?: string
  className?: string
}

/**
 * Кнопка статуса на всю ширину (иконка + название + шеврон, левый бордер 3 px цветом статуса)
 * и меню из 7 строк с точкой, описанием и горячей клавишей 1–7 (04 §3.9).
 */
export function StatusPicker({
  value,
  onChange,
  disabled,
  align = 'start',
  labels,
  placeholder,
  className
}: StatusPickerProps): ReactElement {
  const Icon = value ? STATUS_ICONS[value] : null
  const color = value ? statusColor(value) : 'var(--border-2)'

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            'flex h-[36px] w-full items-center gap-2.5 rounded-sm border border-border-1 bg-surface-1 py-0 pl-3 pr-2.5 text-left outline-none transition-colors',
            'hover:border-border-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)]',
            'disabled:cursor-not-allowed disabled:opacity-45',
            className
          )}
          style={{
            borderLeftWidth: 3,
            borderLeftColor: color,
            transitionDuration: 'var(--d-enter)',
            transitionTimingFunction: 'var(--ease-standard)'
          }}
        >
          <motion.span
            key={value ?? 'none'}
            initial={{ scale: 0.7 }}
            animate={{ scale: 1 }}
            transition={transitions.hover}
            className="flex shrink-0 items-center"
            style={{ color }}
          >
            {Icon ? <Icon size={16} strokeWidth={1.75} /> : <Circle size={16} strokeWidth={1.75} />}
          </motion.span>
          <span className={cn('type-body flex-1 truncate', value ? 'text-text-1' : 'text-text-3')}>
            {value ? labels[value].title : placeholder}
          </span>
          <ChevronDown size={14} strokeWidth={1.75} className="shrink-0 text-text-3" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-[var(--radix-dropdown-menu-trigger-width)] min-w-[260px]">
        {GAME_STATUSES.map((status) => (
          <DropdownMenuItem
            key={status}
            onSelect={() => onChange(status)}
            className="h-auto flex-col items-stretch gap-0.5 py-2"
          >
            <div className="flex items-center gap-2">
              <StatusDot status={status} />
              <span className="type-body flex-1 text-text-1">{labels[status].title}</span>
              <Kbd keys={[String(STATUS_META[status].hotkey)]} />
            </div>
            <p className="type-small pl-[14px] text-text-2">{labels[status].description}</p>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
