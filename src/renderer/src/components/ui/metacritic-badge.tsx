import type { ElementType, ReactElement } from 'react'
import { cn } from '@/lib/utils'
import { metacriticColor } from '@/lib/color'

export interface MetacriticBadgeProps {
  score: number
  url?: string
  className?: string
}

/** Плашка Metacritic — единственное место с зелёным цветом (04 §2.3). */
export function MetacriticBadge({ score, url, className }: MetacriticBadgeProps): ReactElement {
  const Comp: ElementType = url ? 'a' : 'span'
  return (
    <Comp
      href={url}
      target={url ? '_blank' : undefined}
      rel={url ? 'noreferrer' : undefined}
      className={cn(
        'tabular inline-flex h-6 min-w-6 items-center justify-center rounded-xs border border-border-1 bg-surface-1 px-1.5 type-small font-bold',
        url && 'transition-colors hover:border-border-2',
        className
      )}
      style={{
        color: metacriticColor(score),
        transitionDuration: url ? 'var(--d-micro)' : undefined
      }}
    >
      {score}
    </Comp>
  )
}
