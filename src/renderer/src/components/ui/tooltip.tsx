import type { ReactElement, ReactNode } from 'react'
import * as TooltipPrimitive from '@radix-ui/react-tooltip'
import { cn } from '@/lib/utils'

export interface TooltipProviderProps {
  children: ReactNode
  delayDuration?: number
}

/** Провайдер задержки показа подсказок — 400 мс по умолчанию (CONTRACT.md). */
export function TooltipProvider({ children, delayDuration = 400 }: TooltipProviderProps): ReactElement {
  return (
    <TooltipPrimitive.Provider delayDuration={delayDuration} skipDelayDuration={200}>
      {children}
    </TooltipPrimitive.Provider>
  )
}

export const Tooltip = TooltipPrimitive.Root
export const TooltipTrigger = TooltipPrimitive.Trigger

export type TooltipContentProps = TooltipPrimitive.TooltipContentProps

/** Подсказка: `--surface-solid`, `--r-xs`, 12.5 px (04 §3.11). */
export function TooltipContent({
  className,
  sideOffset = 6,
  ...props
}: TooltipContentProps): ReactElement {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        sideOffset={sideOffset}
        className={cn(
          'z-50 rounded-xs bg-surface-solid px-2 py-1 text-[12.5px] text-text-1 shadow-2',
          'data-[state=delayed-open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=delayed-open]:fade-in-0',
          'data-[state=closed]:zoom-out-95 data-[state=delayed-open]:zoom-in-95',
          'data-[state=delayed-open]:duration-[var(--d-micro)] data-[state=closed]:duration-[var(--d-micro)]',
          className
        )}
        {...props}
      />
    </TooltipPrimitive.Portal>
  )
}
