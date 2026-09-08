import type { ButtonHTMLAttributes, ReactElement, ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ChipProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'color'> {
  selected?: boolean
  count?: number
  onRemove?: () => void
  /** Доступное имя кнопки удаления (например «Убрать фильтр «RPG»») — передаётся снаружи. */
  removeLabel?: string
  icon?: ReactNode
  /** CSS-цвет (обычно `var(--st-...)`) для акцента выбранного чипа вместо `--accent`. */
  color?: string
}

/** Пилюля 28 px (04 §3.3): selected — мягкая заливка акцентом/`color`, крестик появляется на hover. */
export function Chip({
  selected,
  count,
  onRemove,
  removeLabel,
  icon,
  color,
  className,
  children,
  onClick,
  style,
  disabled,
  ...props
}: ChipProps): ReactElement {
  const accent = color ?? 'var(--accent)'
  const selectedStyle = selected
    ? {
        background: `color-mix(in srgb, ${accent} 16%, transparent)`,
        borderColor: `color-mix(in srgb, ${accent} 50%, transparent)`
      }
    : undefined

  return (
    <span
      className={cn(
        'group inline-flex h-[28px] select-none items-center whitespace-nowrap rounded-pill border pl-3 text-text-1',
        onRemove ? 'pr-1.5' : 'pr-3',
        !selected && 'border-border-1 bg-surface-2',
        disabled && 'opacity-45',
        className
      )}
      style={{ ...selectedStyle, ...style }}
    >
      <button
        type="button"
        aria-pressed={onClick ? Boolean(selected) : undefined}
        onClick={onClick}
        disabled={disabled}
        className={cn(
          'inline-flex h-full items-center gap-1.5 type-small font-medium outline-none transition-transform',
          'hover:-translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)]',
          'disabled:pointer-events-none'
        )}
        style={{ transitionDuration: 'var(--d-micro)', transitionTimingFunction: 'var(--ease-standard)' }}
        {...props}
      >
        {icon && <span className="flex shrink-0 items-center [&>svg]:h-3.5 [&>svg]:w-3.5">{icon}</span>}
        <span>{children}</span>
        {typeof count === 'number' && <span className="tabular text-text-3">{count}</span>}
      </button>
      {onRemove && (
        <button
          type="button"
          aria-label={removeLabel}
          onClick={onRemove}
          disabled={disabled}
          className="ml-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-text-2 opacity-0 outline-none transition-opacity hover:text-text-1 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--border-focus)] group-hover:opacity-100"
          style={{
            transitionDuration: 'var(--d-micro)',
            background: 'transparent'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'color-mix(in srgb, var(--text-1) 12%, transparent)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent'
          }}
        >
          <X size={12} strokeWidth={1.75} />
        </button>
      )}
    </span>
  )
}
