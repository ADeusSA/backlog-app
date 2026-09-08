import type { ReactElement } from 'react'
import { useId } from 'react'
import * as CheckboxPrimitive from '@radix-ui/react-checkbox'
import { Check, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface CheckboxProps {
  checked: boolean
  onChange: (checked: boolean) => void
  indeterminate?: boolean
  label?: string
  disabled?: boolean
  id?: string
  className?: string
}

/** Квадратный чекбокс: заливка `--accent` при отмеченном/промежуточном состоянии. */
export function Checkbox({
  checked,
  onChange,
  indeterminate,
  label,
  disabled,
  id,
  className
}: CheckboxProps): ReactElement {
  const generatedId = useId()
  const checkboxId = id ?? generatedId
  const state = indeterminate ? 'indeterminate' : checked

  return (
    <div className={cn('inline-flex items-center gap-2.5', className)}>
      <CheckboxPrimitive.Root
        id={checkboxId}
        checked={state}
        onCheckedChange={(next) => onChange(next === true)}
        disabled={disabled}
        className={cn(
          'flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border outline-none transition-colors',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)]',
          'disabled:cursor-not-allowed disabled:opacity-45',
          checked || indeterminate ? 'border-transparent bg-accent text-accent-on' : 'border-border-2 bg-surface-1'
        )}
        style={{ transitionDuration: 'var(--d-micro)', transitionTimingFunction: 'var(--ease-standard)' }}
      >
        <CheckboxPrimitive.Indicator>
          {indeterminate ? <Minus size={11} strokeWidth={2.5} /> : <Check size={11} strokeWidth={2.5} />}
        </CheckboxPrimitive.Indicator>
      </CheckboxPrimitive.Root>
      {label && (
        <label htmlFor={checkboxId} className="type-body cursor-pointer select-none text-text-1">
          {label}
        </label>
      )}
    </div>
  )
}
