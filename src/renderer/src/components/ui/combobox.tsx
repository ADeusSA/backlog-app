import type { ReactElement, ReactNode } from 'react'
import { useMemo, useState } from 'react'
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from 'cmdk'
import { Check, ChevronsUpDown, Plus, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Popover, PopoverContent, PopoverTrigger } from './popover'

export interface ComboboxItem<T extends string> {
  value: T
  label: string
  disabled?: boolean
}

export interface ComboboxProps<T extends string> {
  items: ComboboxItem<T>[]
  value: T | T[] | null
  onChange: (value: T | T[]) => void
  multiple?: boolean
  placeholder?: string
  emptyText?: string
  renderItem?: (item: ComboboxItem<T>) => ReactNode
  /** Пункт «Создать …» — вызывается с текстом поиска, когда точного совпадения нет. */
  onCreate?: (query: string) => void
  createLabel?: (query: string) => string
  disabled?: boolean
  className?: string
}

function toArray<T>(value: T | T[] | null): T[] {
  if (value === null) return []
  return Array.isArray(value) ? value : [value]
}

/** Комбобокс с поиском на `cmdk`, мультивыбором и опциональным «Создать …» (07 §7). */
export function Combobox<T extends string>({
  items,
  value,
  onChange,
  multiple = false,
  placeholder,
  emptyText,
  renderItem,
  onCreate,
  createLabel,
  disabled,
  className
}: ComboboxProps<T>): ReactElement {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const selected = useMemo(() => new Set(toArray(value)), [value])
  const selectedItems = items.filter((item) => selected.has(item.value))
  const exactMatch = items.some((item) => item.label.toLowerCase() === query.trim().toLowerCase())

  function select(item: ComboboxItem<T>): void {
    if (multiple) {
      const next = new Set(selected)
      if (next.has(item.value)) next.delete(item.value)
      else next.add(item.value)
      onChange(Array.from(next))
    } else {
      onChange(item.value)
      setOpen(false)
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            'flex h-[36px] w-full items-center gap-2 rounded-sm border border-border-1 bg-surface-1 px-3 text-left outline-none transition-colors',
            'hover:border-border-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)]',
            'disabled:cursor-not-allowed disabled:opacity-45',
            className
          )}
          style={{ transitionDuration: 'var(--d-micro)', transitionTimingFunction: 'var(--ease-standard)' }}
        >
          <span
            className={cn('type-body flex-1 truncate', selectedItems.length ? 'text-text-1' : 'text-text-3')}
          >
            {selectedItems.length > 0 ? selectedItems.map((i) => i.label).join(', ') : placeholder}
          </span>
          <ChevronsUpDown size={14} strokeWidth={1.75} className="shrink-0 text-text-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[var(--radix-popover-trigger-width)] min-w-[240px] p-0"
      >
        <Command shouldFilter className="flex flex-col">
          <div className="flex items-center gap-2 border-b border-border-1 px-2.5">
            <Search size={14} strokeWidth={1.75} className="shrink-0 text-text-3" />
            <CommandInput
              value={query}
              onValueChange={setQuery}
              placeholder={placeholder}
              className="type-body h-9 w-full bg-transparent text-text-1 outline-none placeholder:text-text-3"
            />
          </div>
          <CommandList className="max-h-64 overflow-y-auto p-1">
            <CommandEmpty className="type-small px-2 py-3 text-center text-text-2">
              {emptyText}
            </CommandEmpty>
            {items.map((item) => {
              const isSelected = selected.has(item.value)
              return (
                <CommandItem
                  key={item.value}
                  value={item.label}
                  disabled={item.disabled}
                  onSelect={() => select(item)}
                  className={cn(
                    'type-body relative flex h-8 cursor-pointer select-none items-center gap-2 rounded-sm px-2 text-text-1 outline-none',
                    'data-[selected=true]:bg-surface-2 data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-45'
                  )}
                >
                  {renderItem ? renderItem(item) : <span className="flex-1 truncate">{item.label}</span>}
                  {isSelected && <Check size={14} strokeWidth={1.75} className="shrink-0 text-accent" />}
                </CommandItem>
              )
            })}
            {onCreate && query.trim() && !exactMatch && (
              <CommandItem
                value={`__create__${query}`}
                onSelect={() => {
                  onCreate(query.trim())
                  setQuery('')
                }}
                className="type-body flex h-8 cursor-pointer select-none items-center gap-2 rounded-sm px-2 text-accent outline-none data-[selected=true]:bg-surface-2"
              >
                <Plus size={14} strokeWidth={1.75} />
                {createLabel ? createLabel(query.trim()) : query.trim()}
              </CommandItem>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
