import type { KeyboardEvent, ReactElement } from 'react'
import { useState } from 'react'
import { Star } from 'lucide-react'
import { RATING_LABEL_KEYS } from '@shared/constants'
import { cn } from '@/lib/utils'

export interface RatingStarsProps {
  /** Оценка 1–10 (1 балл = ½ звезды) либо `null`, если не оценено. */
  value: number | null
  onChange?: (value: number | null) => void
  readOnly?: boolean
  size?: 16 | 20 | 24
  showLabel?: boolean
  /** Текст подписи по ключам `RATING_LABEL_KEYS` — компонент не хардкодит i18n-текст. */
  labels?: Record<string, string>
  /** Доступное имя контрола (например «Моя оценка») — передаётся вызывающей стороной. */
  ariaLabel?: string
  className?: string
}

const STAR_COUNT = 5

/** 5 звёзд с половинками, hover-превью, клик по текущей оценке снимает её (04 §3.10). */
export function RatingStars({
  value,
  onChange,
  readOnly = false,
  size = 20,
  showLabel = false,
  labels,
  ariaLabel,
  className
}: RatingStarsProps): ReactElement {
  const [hover, setHover] = useState<number | null>(null)
  const display = hover ?? value ?? 0
  const interactive = !readOnly && Boolean(onChange)

  function commit(next: number): void {
    if (!onChange) return
    onChange(value === next ? null : next)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    if (!interactive || !onChange) return
    const current = value ?? 0
    if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
      event.preventDefault()
      onChange(Math.min(10, current + 1 || 1))
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
      event.preventDefault()
      onChange(current <= 1 ? null : current - 1)
    } else if (event.key === 'Backspace' || event.key === 'Delete') {
      event.preventDefault()
      onChange(null)
    }
  }

  const labelKey = value ? RATING_LABEL_KEYS[value] : undefined
  const labelText = labelKey ? labels?.[labelKey] : undefined

  return (
    <div className={cn('inline-flex items-center gap-2', className)}>
      <div
        role={interactive ? 'slider' : 'img'}
        aria-label={ariaLabel}
        aria-readonly={interactive ? readOnly : undefined}
        aria-valuemin={interactive ? 1 : undefined}
        aria-valuemax={interactive ? 10 : undefined}
        aria-valuenow={interactive ? (value ?? 0) : undefined}
        aria-valuetext={!interactive && value ? `${value}/10` : undefined}
        tabIndex={interactive ? 0 : -1}
        onKeyDown={handleKeyDown}
        onMouseLeave={() => setHover(null)}
        className={cn(
          'inline-flex items-center gap-0.5 rounded-xs outline-none',
          interactive &&
            'focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--border-focus)]'
        )}
      >
        {Array.from({ length: STAR_COUNT }, (_, i) => {
          const starIndex = i + 1
          const full = starIndex * 2
          const half = full - 1
          const filled = display >= full
          const isHalf = !filled && display >= half
          const fillWidth = filled ? '100%' : isHalf ? '50%' : '0%'
          return (
            <span
              key={starIndex}
              className="relative inline-flex shrink-0"
              style={{ width: size, height: size }}
            >
              <Star size={size} strokeWidth={1.75} className="absolute inset-0 text-text-3" />
              <span className="absolute inset-0 overflow-hidden" style={{ width: fillWidth }}>
                <Star size={size} strokeWidth={1.75} className="fill-success text-success" />
              </span>
              {interactive && (
                <>
                  <button
                    type="button"
                    aria-hidden
                    tabIndex={-1}
                    className="absolute inset-y-0 left-0 w-1/2"
                    onMouseEnter={() => setHover(half)}
                    onClick={() => commit(half)}
                  />
                  <button
                    type="button"
                    aria-hidden
                    tabIndex={-1}
                    className="absolute inset-y-0 right-0 w-1/2"
                    onMouseEnter={() => setHover(full)}
                    onClick={() => commit(full)}
                  />
                </>
              )}
            </span>
          )
        })}
      </div>
      {showLabel && labelText && <span className="type-small text-success">{labelText}</span>}
    </div>
  )
}
