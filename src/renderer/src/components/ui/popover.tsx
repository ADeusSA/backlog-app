import type { ReactElement } from 'react'
import * as PopoverPrimitive from '@radix-ui/react-popover'
import { cn } from '@/lib/utils'

export const Popover = PopoverPrimitive.Root
export const PopoverTrigger = PopoverPrimitive.Trigger
export const PopoverAnchor = PopoverPrimitive.Anchor

export type PopoverContentProps = PopoverPrimitive.PopoverContentProps

/** Поповер: стекло, `--r-lg`, `--shadow-3` (04 §3.11). */
export function PopoverContent({
  className,
  align = 'center',
  sideOffset = 8,
  ...props
}: PopoverContentProps): ReactElement {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        align={align}
        sideOffset={sideOffset}
        className={cn(
          'glass-strong z-50 rounded-lg border border-border-1 p-3 shadow-3 outline-none',
          'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
          'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
          'data-[side=bottom]:slide-in-from-top-1 data-[side=top]:slide-in-from-bottom-1',
          'data-[state=open]:duration-[var(--d-enter)] data-[state=closed]:duration-[var(--d-micro)]',
          className
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  )
}
