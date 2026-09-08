import type { ReactElement, ReactNode } from 'react'
import { useEffect, useState } from 'react'
import * as CollapsiblePrimitive from '@radix-ui/react-collapsible'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface CollapsibleSectionProps {
  title: string
  count?: number
  defaultOpen?: boolean
  /** Ключ персистентности состояния открыто/закрыто в `localStorage`. */
  storageKey?: string
  children: ReactNode
  className?: string
}

function readStored(key: string | undefined, fallback: boolean): boolean {
  if (!key || typeof window === 'undefined') return fallback
  try {
    const raw = window.localStorage.getItem(`aurora:collapsible:${key}`)
    return raw === null ? fallback : raw === '1'
  } catch {
    return fallback
  }
}

/** Сворачиваемая секция (панель фильтров и т. п.): заголовок `caption` + счётчик (07 §7). */
export function CollapsibleSection({
  title,
  count,
  defaultOpen = true,
  storageKey,
  children,
  className
}: CollapsibleSectionProps): ReactElement {
  const [open, setOpen] = useState(() => readStored(storageKey, defaultOpen))

  useEffect(() => {
    if (!storageKey || typeof window === 'undefined') return
    try {
      window.localStorage.setItem(`aurora:collapsible:${storageKey}`, open ? '1' : '0')
    } catch {
      // localStorage недоступен (приватный режим и т. п.) — не критично
    }
  }, [open, storageKey])

  return (
    <CollapsiblePrimitive.Root open={open} onOpenChange={setOpen} className={cn('flex flex-col', className)}>
      <CollapsiblePrimitive.Trigger className="group flex h-8 w-full items-center justify-between gap-2 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)]">
        <span className="type-caption flex items-center gap-1.5">
          <ChevronRight
            size={12}
            strokeWidth={1.75}
            className="transition-transform group-data-[state=open]:rotate-90"
            style={{ transitionDuration: 'var(--d-micro)' }}
          />
          {title}
        </span>
        {typeof count === 'number' && count > 0 && (
          <span className="type-caption tabular text-text-2">{count}</span>
        )}
      </CollapsiblePrimitive.Trigger>
      <CollapsiblePrimitive.Content
        className="overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down"
        style={{ animationDuration: 'var(--d-enter)', animationTimingFunction: 'var(--ease-standard)' }}
      >
        <div className="pb-3 pt-2">{children}</div>
      </CollapsiblePrimitive.Content>
    </CollapsiblePrimitive.Root>
  )
}
