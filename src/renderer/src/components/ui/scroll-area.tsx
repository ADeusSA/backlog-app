import type { ReactElement, ReactNode } from 'react'
import * as ScrollAreaPrimitive from '@radix-ui/react-scroll-area'
import { cn } from '@/lib/utils'

export interface ScrollAreaProps {
  children: ReactNode
  className?: string
  viewportClassName?: string
  orientation?: 'vertical' | 'horizontal' | 'both'
}

/** Overlay-скроллбар 8 px, появляется при hover/скролле контейнера (04 §3.14). */
export function ScrollArea({
  children,
  className,
  viewportClassName,
  orientation = 'vertical'
}: ScrollAreaProps): ReactElement {
  return (
    <ScrollAreaPrimitive.Root className={cn('relative overflow-hidden', className)}>
      <ScrollAreaPrimitive.Viewport className={cn('h-full w-full', viewportClassName)}>
        {children}
      </ScrollAreaPrimitive.Viewport>
      {(orientation === 'vertical' || orientation === 'both') && (
        <ScrollAreaPrimitive.Scrollbar
          orientation="vertical"
          className="flex w-2 touch-none select-none p-0.5 transition-colors"
        >
          <ScrollAreaPrimitive.Thumb
            className="relative flex-1 rounded-pill opacity-80 transition-opacity hover:opacity-100"
            style={{ background: 'color-mix(in srgb, var(--text-1) 18%, transparent)' }}
          />
        </ScrollAreaPrimitive.Scrollbar>
      )}
      {(orientation === 'horizontal' || orientation === 'both') && (
        <ScrollAreaPrimitive.Scrollbar
          orientation="horizontal"
          className="flex h-2 touch-none select-none p-0.5 transition-colors"
        >
          <ScrollAreaPrimitive.Thumb
            className="relative flex-1 rounded-pill opacity-80 transition-opacity hover:opacity-100"
            style={{ background: 'color-mix(in srgb, var(--text-1) 18%, transparent)' }}
          />
        </ScrollAreaPrimitive.Scrollbar>
      )}
      <ScrollAreaPrimitive.Corner />
    </ScrollAreaPrimitive.Root>
  )
}
