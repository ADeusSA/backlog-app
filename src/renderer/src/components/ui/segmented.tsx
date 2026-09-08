import type { ReactElement, ReactNode } from 'react'
import { useId } from 'react'
import { motion } from 'motion/react'
import { transitions } from '@/lib/motion'
import { cn } from '@/lib/utils'
import { useMotionMode } from './use-motion-mode'

export interface SegmentedOption<T extends string> {
  value: T
  label?: string
  icon?: ReactNode
  title?: string
}

export interface SegmentedProps<T extends string> {
  options: SegmentedOption<T>[]
  value: T
  onChange: (value: T) => void
  tone?: 'primary' | 'accent'
  size?: 'sm' | 'md'
  ariaLabel?: string
  className?: string
}

/** Сегментированный контрол со скользящим индикатором (04 §3.4). Максимум 5 сегментов. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  tone = 'primary',
  size = 'md',
  ariaLabel,
  className
}: SegmentedProps<T>): ReactElement {
  const groupId = useId()
  const motionEnabled = useMotionMode() !== 'off'
  const activeBg = tone === 'accent' ? 'bg-accent' : 'bg-primary-btn'
  const activeText = tone === 'accent' ? 'text-accent-on' : 'text-primary-btn-on'

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn('inline-flex items-center gap-0.5 rounded-pill bg-surface-1 p-0.5', className)}
    >
      {options.map((opt) => {
        const active = opt.value === value
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            title={opt.title}
            onClick={() => onChange(opt.value)}
            className={cn(
              'relative z-0 inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-pill type-small font-medium outline-none',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)]',
              size === 'sm' ? 'h-[26px] px-2.5' : 'h-[30px] px-3',
              active ? activeText : 'text-text-2 hover:text-text-1'
            )}
          >
            {active && (
              <motion.span
                layoutId={`segmented-${groupId}`}
                className={cn('absolute inset-0 -z-10 rounded-pill', activeBg)}
                transition={motionEnabled ? transitions.enter : { duration: 0 }}
              />
            )}
            {opt.icon && <span className="flex shrink-0 [&>svg]:h-4 [&>svg]:w-4">{opt.icon}</span>}
            {opt.label && <span>{opt.label}</span>}
          </button>
        )
      })}
    </div>
  )
}
