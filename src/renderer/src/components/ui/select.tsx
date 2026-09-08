import type { ReactElement, ReactNode } from 'react'
import * as SelectPrimitive from '@radix-ui/react-select'
import { Check, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface SelectProps<T extends string> {
  value: T | undefined
  onChange: (value: T) => void
  placeholder?: string
  disabled?: boolean
  children: ReactNode
  className?: string
}

/** Тонкая обёртка `@radix-ui/react-select` под токены Aurora (CONTRACT.md). */
export function Select<T extends string>({
  value,
  onChange,
  placeholder,
  disabled,
  children,
  className
}: SelectProps<T>): ReactElement {
  return (
    <SelectPrimitive.Root value={value} onValueChange={(v) => onChange(v as T)} disabled={disabled}>
      <SelectPrimitive.Trigger
        className={cn(
          'flex h-[36px] w-full items-center justify-between gap-2 rounded-sm border border-border-1 bg-surface-1 px-3',
          'type-body text-text-1 outline-none transition-[border-color,box-shadow] hover:border-border-2',
          'focus-visible:border-[var(--border-focus)] focus-visible:shadow-[0_0_0_3px_var(--accent-soft)]',
          'disabled:cursor-not-allowed disabled:opacity-45 data-[placeholder]:text-text-3',
          className
        )}
        style={{ transitionDuration: 'var(--d-micro)', transitionTimingFunction: 'var(--ease-standard)' }}
      >
        <SelectPrimitive.Value placeholder={placeholder} />
        <SelectPrimitive.Icon>
          <ChevronDown size={14} strokeWidth={1.75} className="text-text-3" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          sideOffset={6}
          className={cn(
            'glass-strong z-50 max-h-[min(24rem,var(--radix-select-content-available-height))] overflow-hidden rounded-lg border border-border-1 p-1 shadow-3',
            'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
            'data-[state=open]:duration-[var(--d-enter)] data-[state=closed]:duration-[var(--d-micro)]'
          )}
        >
          <SelectPrimitive.Viewport className="p-0.5">{children}</SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  )
}

export interface SelectItemProps {
  value: string
  disabled?: boolean
  children: ReactNode
  className?: string
}

export function SelectItem({ value, disabled, children, className }: SelectItemProps): ReactElement {
  return (
    <SelectPrimitive.Item
      value={value}
      disabled={disabled}
      className={cn(
        'type-body relative flex h-8 cursor-pointer select-none items-center rounded-sm px-2 pr-7 text-text-1 outline-none',
        'data-[highlighted]:bg-surface-2 data-[disabled]:pointer-events-none data-[disabled]:opacity-45',
        className
      )}
    >
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator className="absolute right-2 inline-flex items-center text-accent">
        <Check size={14} strokeWidth={1.75} />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  )
}
