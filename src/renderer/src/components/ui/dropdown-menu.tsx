import type { ReactElement } from 'react'
import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu'
import { Check, ChevronRight, Circle } from 'lucide-react'
import { cn } from '@/lib/utils'

export const DropdownMenu = DropdownMenuPrimitive.Root
export const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger
export const DropdownMenuGroup = DropdownMenuPrimitive.Group
export const DropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup
export const DropdownMenuSub = DropdownMenuPrimitive.Sub

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

export type DropdownMenuContentProps = DropdownMenuPrimitive.DropdownMenuContentProps

export function DropdownMenuContent({
  className,
  sideOffset = 6,
  ...props
}: DropdownMenuContentProps): ReactElement {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        sideOffset={sideOffset}
        className={cn(CONTENT_CLASS, className)}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  )
}

export type DropdownMenuItemProps = DropdownMenuPrimitive.DropdownMenuItemProps & {
  inset?: boolean
}

export function DropdownMenuItem({ className, inset, ...props }: DropdownMenuItemProps): ReactElement {
  return (
    <DropdownMenuPrimitive.Item
      className={cn(ITEM_CLASS, inset && 'pl-7', className)}
      {...props}
    />
  )
}

export type DropdownMenuCheckboxItemProps = DropdownMenuPrimitive.DropdownMenuCheckboxItemProps

export function DropdownMenuCheckboxItem({
  className,
  children,
  checked,
  ...props
}: DropdownMenuCheckboxItemProps): ReactElement {
  return (
    <DropdownMenuPrimitive.CheckboxItem
      checked={checked}
      className={cn(ITEM_CLASS, 'pl-7', className)}
      {...props}
    >
      <span className="absolute left-2 inline-flex items-center text-accent">
        <DropdownMenuPrimitive.ItemIndicator>
          <Check size={14} strokeWidth={1.75} />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </DropdownMenuPrimitive.CheckboxItem>
  )
}

export type DropdownMenuRadioItemProps = DropdownMenuPrimitive.DropdownMenuRadioItemProps

export function DropdownMenuRadioItem({
  className,
  children,
  ...props
}: DropdownMenuRadioItemProps): ReactElement {
  return (
    <DropdownMenuPrimitive.RadioItem className={cn(ITEM_CLASS, 'pl-7', className)} {...props}>
      <span className="absolute left-2 inline-flex items-center text-accent">
        <DropdownMenuPrimitive.ItemIndicator>
          <Circle size={8} strokeWidth={1.75} className="fill-current" />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </DropdownMenuPrimitive.RadioItem>
  )
}

export type DropdownMenuLabelProps = DropdownMenuPrimitive.DropdownMenuLabelProps

export function DropdownMenuLabel({ className, ...props }: DropdownMenuLabelProps): ReactElement {
  return <DropdownMenuPrimitive.Label className={cn('type-caption px-2 py-1.5', className)} {...props} />
}

export type DropdownMenuSeparatorProps = DropdownMenuPrimitive.DropdownMenuSeparatorProps

export function DropdownMenuSeparator({ className, ...props }: DropdownMenuSeparatorProps): ReactElement {
  return <DropdownMenuPrimitive.Separator className={cn('my-1 h-px bg-border-1', className)} {...props} />
}

export type DropdownMenuSubTriggerProps = DropdownMenuPrimitive.DropdownMenuSubTriggerProps

export function DropdownMenuSubTrigger({
  className,
  children,
  ...props
}: DropdownMenuSubTriggerProps): ReactElement {
  return (
    <DropdownMenuPrimitive.SubTrigger className={cn(ITEM_CLASS, 'data-[state=open]:bg-surface-2', className)} {...props}>
      {children}
      <ChevronRight size={14} strokeWidth={1.75} className="ml-auto text-text-3" />
    </DropdownMenuPrimitive.SubTrigger>
  )
}

export type DropdownMenuSubContentProps = DropdownMenuPrimitive.DropdownMenuSubContentProps

export function DropdownMenuSubContent({ className, ...props }: DropdownMenuSubContentProps): ReactElement {
  return <DropdownMenuPrimitive.SubContent className={cn(CONTENT_CLASS, className)} {...props} />
}
