import type { ReactElement } from 'react'
import { useId } from 'react'
import * as SwitchPrimitive from '@radix-ui/react-switch'
import { cn } from '@/lib/utils'

export interface SwitchProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label?: string
  disabled?: boolean
  id?: string
  className?: string
}

/** Переключатель on/off: трек `--accent` при включении, ползунок `--primary-btn`. */
export function Switch({ checked, onChange, label, disabled, id, className }: SwitchProps): ReactElement {
  const generatedId = useId()
  const switchId = id ?? generatedId

  return (
    <div className={cn('inline-flex items-center gap-2.5', className)}>
      <SwitchPrimitive.Root
        id={switchId}
        checked={checked}
        onCheckedChange={onChange}
        disabled={disabled}
        className={cn(
          'relative h-5 w-9 shrink-0 rounded-pill border border-border-1 outline-none transition-colors',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)]',
          'disabled:cursor-not-allowed disabled:opacity-45',
          checked ? 'bg-accent border-transparent' : 'bg-surface-2'
        )}
        style={{ transitionDuration: 'var(--d-micro)', transitionTimingFunction: 'var(--ease-standard)' }}
      >
        <SwitchPrimitive.Thumb
          className={cn(
            'block h-3.5 w-3.5 translate-x-0.5 rounded-full bg-primary-btn shadow-1 transition-transform will-change-transform',
            'data-[state=checked]:translate-x-[18px]'
          )}
          style={{ transitionDuration: 'var(--d-micro)', transitionTimingFunction: 'var(--ease-standard)' }}
        />
      </SwitchPrimitive.Root>
      {label && (
        <label htmlFor={switchId} className="type-body cursor-pointer select-none text-text-1">
          {label}
        </label>
      )}
    </div>
  )
}
