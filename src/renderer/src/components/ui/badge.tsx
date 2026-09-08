import type { HTMLAttributes, ReactElement } from 'react'
import { cn } from '@/lib/utils'

export type BadgeTone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger'

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone
}

const TONE_CLASSES: Record<BadgeTone, string> = {
  neutral: 'border-border-1 bg-surface-2 text-text-2',
  accent: 'border-transparent bg-accent-soft text-accent',
  success: 'border-transparent bg-success-soft text-success',
  warning: 'border-transparent text-warning',
  danger: 'border-transparent bg-danger-soft text-danger'
}

/** Универсальный бейдж-пилюля (не для статусов игры — см. `status-badge.tsx`). */
export function Badge({ tone = 'neutral', className, style, ...props }: BadgeProps): ReactElement {
  return (
    <span
      className={cn(
        'inline-flex h-5 items-center rounded-xs border px-1.5 type-caption normal-case tracking-normal',
        TONE_CLASSES[tone],
        className
      )}
      style={
        tone === 'warning'
          ? { background: 'color-mix(in srgb, var(--warning) 16%, transparent)', ...style }
          : style
      }
      {...props}
    />
  )
}
