import type { InputHTMLAttributes, ReactElement, ReactNode, TextareaHTMLAttributes } from 'react'
import { forwardRef, useId } from 'react'
import { cn } from '@/lib/utils'
import { Kbd } from './kbd'

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  invalid?: boolean
  iconLeft?: ReactNode
  hint?: string
  kbd?: string[]
}

/** Поле ввода Aurora (04 §3.2): surface-1 + border-1, фокус — border-focus + мягкое кольцо. */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { invalid, iconLeft, hint, kbd, className, id, disabled, ...props },
  ref
): ReactElement {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const hintId = hint ? `${inputId}-hint` : undefined

  return (
    <div className="flex flex-col gap-1.5">
      <div
        className={cn(
          'flex h-[36px] items-center gap-2 rounded-sm border bg-surface-1 px-3 transition-[border-color,box-shadow]',
          invalid
            ? 'border-danger'
            : 'border-border-1 hover:border-border-2 focus-within:border-[var(--border-focus)] focus-within:shadow-[0_0_0_3px_var(--accent-soft)]',
          disabled && 'opacity-50',
          className
        )}
        style={{ transitionDuration: 'var(--d-micro)', transitionTimingFunction: 'var(--ease-standard)' }}
      >
        {iconLeft && (
          <span className="flex shrink-0 items-center text-text-3 [&>svg]:h-4 [&>svg]:w-4">{iconLeft}</span>
        )}
        <input
          ref={ref}
          id={inputId}
          disabled={disabled}
          aria-invalid={invalid || undefined}
          aria-describedby={hintId}
          className="type-body h-full min-w-0 flex-1 bg-transparent text-text-1 outline-none placeholder:text-text-3 disabled:cursor-not-allowed"
          {...props}
        />
        {kbd && kbd.length > 0 && <Kbd keys={kbd} className="shrink-0" />}
      </div>
      {hint && (
        <p id={hintId} className={cn('type-small px-0.5', invalid ? 'text-danger' : 'text-text-2')}>
          {hint}
        </p>
      )}
    </div>
  )
})

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean
  hint?: string
}

/** Многострочное поле — тот же визуальный язык, что и `Input` (04 §3.2). */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { invalid, hint, className, id, ...props },
  ref
): ReactElement {
  const generatedId = useId()
  const areaId = id ?? generatedId
  const hintId = hint ? `${areaId}-hint` : undefined

  return (
    <div className="flex flex-col gap-1.5">
      <textarea
        ref={ref}
        id={areaId}
        aria-invalid={invalid || undefined}
        aria-describedby={hintId}
        className={cn(
          'type-body min-h-[80px] w-full resize-y rounded-sm border bg-surface-1 px-3 py-2 text-text-1 outline-none transition-[border-color,box-shadow]',
          'placeholder:text-text-3 disabled:cursor-not-allowed disabled:opacity-50',
          invalid
            ? 'border-danger'
            : 'border-border-1 hover:border-border-2 focus:border-[var(--border-focus)] focus:shadow-[0_0_0_3px_var(--accent-soft)]',
          className
        )}
        style={{ transitionDuration: 'var(--d-micro)', transitionTimingFunction: 'var(--ease-standard)' }}
        {...props}
      />
      {hint && (
        <p id={hintId} className={cn('type-small px-0.5', invalid ? 'text-danger' : 'text-text-2')}>
          {hint}
        </p>
      )}
    </div>
  )
})
