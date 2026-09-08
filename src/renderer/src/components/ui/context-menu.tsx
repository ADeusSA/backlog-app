import type { ReactElement } from 'react'
import * as ContextMenuPrimitive from '@radix-ui/react-context-menu'
import { Check, ChevronRight, Circle } from 'lucide-react'
import { cn } from '@/lib/utils'

export const ContextMenu = ContextMenuPrimitive.Root
export const ContextMenuTrigger = ContextMenuPrimitive.Trigger
export const ContextMenuGroup = ContextMenuPrimitive.Group
export const ContextMenuRadioGroup = ContextMenuPrimitive.RadioGroup
export const ContextMenuSub = ContextMenuPrimitive.Sub

const CONTENT_CLASS = cn(
  'glass-strong z-50 min-w-[180px] rounded-lg border border-border-1 p-1 shadow-3 outline-none',
  'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
  'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
  'data-[state=open]:duration-[var(--d-enter)] data-[state=closed]:duration-[var(--d-micro)]'
)

const ITEM_CLASS = cn(
  'type-body relative flex h-8 cursor-pointer select-none items-center gap-2 rounded-sm px-2 text-text-1 outline-none',
  'data-[highlighted]:bg-surface-2 data-[disabled]:pointer-events-none data-[disabled]:opacity-45'
)

export type ContextMenuContentProps = ContextMenuPrimitive.ContextMenuContentProps

export function ContextMenuContent({ className, ...props }: ContextMenuContentProps): ReactElement {
  return (
    <ContextMenuPrimitive.Portal>
      <ContextMenuPrimitive.Content className={cn(CONTENT_CLASS, className)} {...props} />
    </ContextMenuPrimitive.Portal>
  )
}

export type ContextMenuItemProps = ContextMenuPrimitive.ContextMenuItemProps & { inset?: boolean }

export function ContextMenuItem({ className, inset, ...props }: ContextMenuItemProps): ReactElement {
  return <ContextMenuPrimitive.Item className={cn(ITEM_CLASS, inset && 'pl-7', className)} {...props} />
}

export type ContextMenuCheckboxItemProps = ContextMenuPrimitive.ContextMenuCheckboxItemProps

export function ContextMenuCheckboxItem({
  className,
  children,
  checked,
  ...props
}: ContextMenuCheckboxItemProps): ReactElement {
  return (
    <ContextMenuPrimitive.CheckboxItem checked={checked} className={cn(ITEM_CLASS, 'pl-7', className)} {...props}>
      <span className="absolute left-2 inline-flex items-center text-accent">
        <ContextMenuPrimitive.ItemIndicator>
          <Check size={14} strokeWidth={1.75} />
        </ContextMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </ContextMenuPrimitive.CheckboxItem>
  )
}

export type ContextMenuRadioItemProps = ContextMenuPrimitive.ContextMenuRadioItemProps

export function ContextMenuRadioItem({
  className,
  children,
  ...props
}: ContextMenuRadioItemProps): ReactElement {
  return (
    <ContextMenuPrimitive.RadioItem className={cn(ITEM_CLASS, 'pl-7', className)} {...props}>
      <span className="absolute left-2 inline-flex items-center text-accent">
        <ContextMenuPrimitive.ItemIndicator>
          <Circle size={8} strokeWidth={1.75} className="fill-current" />
        </ContextMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </ContextMenuPrimitive.RadioItem>
  )
}

export type ContextMenuLabelProps = ContextMenuPrimitive.ContextMenuLabelProps

export function ContextMenuLabel({ className, ...props }: ContextMenuLabelProps): ReactElement {
  return <ContextMenuPrimitive.Label className={cn('type-caption px-2 py-1.5', className)} {...props} />
}

export type ContextMenuSeparatorProps = ContextMenuPrimitive.ContextMenuSeparatorProps

export function ContextMenuSeparator({ className, ...props }: ContextMenuSeparatorProps): ReactElement {
  return <ContextMenuPrimitive.Separator className={cn('my-1 h-px bg-border-1', className)} {...props} />
}

export type ContextMenuSubTriggerProps = ContextMenuPrimitive.ContextMenuSubTriggerProps

export function ContextMenuSubTrigger({
  className,
  children,
  ...props
}: ContextMenuSubTriggerProps): ReactElement {
  return (
    <ContextMenuPrimitive.SubTrigger className={cn(ITEM_CLASS, 'data-[state=open]:bg-surface-2', className)} {...props}>
      {children}
      <ChevronRight size={14} strokeWidth={1.75} className="ml-auto text-text-3" />
    </ContextMenuPrimitive.SubTrigger>
  )
}

export type ContextMenuSubContentProps = ContextMenuPrimitive.ContextMenuSubContentProps

export function ContextMenuSubContent({ className, ...props }: ContextMenuSubContentProps): ReactElement {
  return <ContextMenuPrimitive.SubContent className={cn(CONTENT_CLASS, className)} {...props} />
}
