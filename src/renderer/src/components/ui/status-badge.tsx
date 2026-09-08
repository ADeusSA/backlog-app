import type { ReactElement } from 'react'
import type { LucideIcon } from 'lucide-react'
import { CircleCheckBig, CirclePause, CircleX, Gamepad2, Heart, Library, Play } from 'lucide-react'
import type { GameStatus } from '@shared/constants'
import { cn } from '@/lib/utils'
import { statusColor, statusOnColor } from '@/lib/color'

/** Иконка Lucide на статус (соответствует `STATUS_META[status].icon`, 04 §6). */
export const STATUS_ICONS: Record<GameStatus, LucideIcon> = {
  wishlist: Heart,
  backlog: Library,
  playing: Play,
  completed: CircleCheckBig,
  shelved: CirclePause,
  dropped: CircleX,
  played: Gamepad2
}

export interface StatusBadgeProps {
  status: GameStatus
  size?: 'sm' | 'md'
  /** Текст статуса словом. Не задаётся по умолчанию — компонент не хардкодит текст (i18n снаружи). */
  label?: string
  className?: string
}

/**
 * Бейдж статуса — плотная заливка цветом статуса, текст on-color (04 §1 правило 3, §2.3).
 * Высота ≤ 20 px везде, кроме бейджа на обложке карточки (тот собирает GameCard самостоятельно).
 */
export function StatusBadge({ status, size = 'md', label, className }: StatusBadgeProps): ReactElement {
  const Icon = STATUS_ICONS[status]
  const height = size === 'sm' ? 16 : 20
  return (
    <span
      className={cn('inline-flex items-center gap-1 rounded-pill px-1.5 font-semibold', className)}
      style={{
        height,
        background: statusColor(status),
        color: statusOnColor(status),
        fontSize: size === 'sm' ? 10 : 11
      }}
    >
      <Icon size={size === 'sm' ? 10 : 12} strokeWidth={1.75} aria-hidden />
      {label && <span className="leading-none">{label}</span>}
    </span>
  )
}

export interface StatusDotProps {
  status: GameStatus | null | undefined
  size?: 'sm' | 'md'
  className?: string
}

/** Точка-индикатор статуса — компактная альтернатива бейджу (04 §2.3, ≤ 20 px). */
export function StatusDot({ status, size = 'md', className }: StatusDotProps): ReactElement {
  const diameter = size === 'sm' ? 6 : 8
  return (
    <span
      aria-hidden
      className={cn('inline-block shrink-0 rounded-full', className)}
      style={{ width: diameter, height: diameter, background: statusColor(status) }}
    />
  )
}
