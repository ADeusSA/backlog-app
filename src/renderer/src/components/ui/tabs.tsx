import type { ReactElement } from 'react'
import * as TabsPrimitive from '@radix-ui/react-tabs'
import { cn } from '@/lib/utils'

export const Tabs = TabsPrimitive.Root

export type TabsListProps = TabsPrimitive.TabsListProps

export function TabsList({ className, ...props }: TabsListProps): ReactElement {
  return (
    <TabsPrimitive.List
      className={cn('inline-flex items-center gap-1 border-b border-border-1', className)}
      {...props}
    />
  )
}

export type TabsTriggerProps = TabsPrimitive.TabsTriggerProps

export function TabsTrigger({ className, ...props }: TabsTriggerProps): ReactElement {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        'type-body relative -mb-px flex h-9 items-center border-b-2 border-transparent px-3 text-text-2 outline-none transition-colors',
        'hover:text-text-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)]',
        'data-[state=active]:border-accent data-[state=active]:text-text-1 data-[state=active]:font-semibold',
        'disabled:pointer-events-none disabled:opacity-45',
        className
      )}
      style={{ transitionDuration: 'var(--d-micro)', transitionTimingFunction: 'var(--ease-standard)' }}
      {...props}
    />
  )
}

export type TabsContentProps = TabsPrimitive.TabsContentProps

export function TabsContent({ className, ...props }: TabsContentProps): ReactElement {
  return (
    <TabsPrimitive.Content
      className={cn(
        'mt-4 outline-none',
        'data-[state=inactive]:hidden',
        'data-[state=active]:animate-in data-[state=active]:fade-in-0',
        'data-[state=active]:duration-[var(--d-enter)]',
        className
      )}
      {...props}
    />
  )
}
