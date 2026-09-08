import type { ButtonHTMLAttributes, ElementType, ReactElement, ReactNode } from 'react'
import { forwardRef } from 'react'
import { Slot } from '@radix-ui/react-slot'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export type ButtonVariant = 'primary' | 'accent' | 'secondary' | 'ghost' | 'danger' | 'icon'
export type ButtonSize = 'sm' | 'md' | 'lg'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  /** Рендерит пропсы на переданный дочерний элемент (Radix Slot) вместо `<button>`. */
  asChild?: boolean
  loading?: boolean
  /** Ведущая иконка (игнорируется для `variant="icon"` — там иконка передаётся через `children`). */
  icon?: ReactNode
  children?: ReactNode
}

const HEIGHT: Record<ButtonSize, string> = {
  sm: 'h-[32px]',
  md: 'h-[36px]',
  lg: 'h-[44px]'
}

const PADDING: Record<ButtonSize, string> = {
  sm: 'px-3 text-[13px]',
  md: 'px-4 type-body',
  lg: 'px-5 text-[15px]'
}

// 04 §3.1 — ровно один primary/accent на экран/диалог; остальное решает вызывающая сторона.
const VARIANT: Record<ButtonVariant, string> = {
  primary:
    'bg-primary-btn text-primary-btn-on hover:-translate-y-px hover:brightness-[1.06] active:translate-y-0 active:scale-[.98]',
  accent: 'bg-accent text-accent-on hover:bg-accent-hover active:bg-accent-press active:scale-[.98]',
  secondary:
    'bg-surface-2 border border-border-1 text-text-1 hover:border-border-2 active:scale-[.98]',
  ghost: 'bg-transparent text-text-1 hover:bg-surface-2 active:scale-[.98]',
  danger: 'bg-transparent text-danger hover:bg-danger-soft active:scale-[.98]',
  icon: 'bg-transparent text-text-2 hover:bg-surface-2 hover:text-text-1 active:scale-[.96]'
}

/** Кнопка Aurora — варианты и высоты см. CONTRACT.md / 04 §3.1. */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'secondary',
    size = 'md',
    asChild,
    loading,
    icon,
    disabled,
    className,
    children,
    type,
    ...props
  },
  ref
): ReactElement {
  const Comp: ElementType = asChild ? Slot : 'button'
  const isIconOnly = variant === 'icon'

  return (
    <Comp
      ref={ref}
      type={asChild ? undefined : (type ?? 'button')}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-pill font-semibold outline-none',
        'transition-[transform,background-color,border-color,color,filter,box-shadow]',
        'disabled:pointer-events-none disabled:opacity-45',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)]',
        isIconOnly ? cn(HEIGHT[size], 'aspect-square rounded-sm p-0') : cn(HEIGHT[size], PADDING[size]),
        VARIANT[variant],
        loading && 'cursor-wait',
        className
      )}
      style={{ transitionDuration: 'var(--d-hover)', transitionTimingFunction: 'var(--ease-standard)' }}
      {...props}
    >
      {loading ? (
        <Loader2 className="animate-spin" size={isIconOnly ? 18 : 16} strokeWidth={1.75} aria-hidden />
      ) : isIconOnly ? (
        (icon ?? children)
      ) : (
        <>
          {icon}
          {children}
        </>
      )}
    </Comp>
  )
})
