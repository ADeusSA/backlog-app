import type { ReactElement } from 'react'
import { cn } from '@/lib/utils'

export interface KbdProps {
  keys: string[]
  className?: string
}

/** Подсказка горячей клавиши — моноширинные «клавиши» (04 §3.2, §3.11). */
export function Kbd({ keys, className }: KbdProps): ReactElement {
  return (
    <span className={cn('inline-flex items-center gap-1', className)}>
      {keys.map((key, i) => (
        <kbd
          key={`${key}-${i}`}
          className="type-mono rounded-xs border border-border-1 bg-surface-2 px-1.5 py-0.5 text-[11px] leading-none text-text-2"
        >
          {key}
        </kbd>
      ))}
    </span>
  )
}
