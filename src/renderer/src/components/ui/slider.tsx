import type { ReactElement } from 'react'
import * as SliderPrimitive from '@radix-ui/react-slider'
import { cn } from '@/lib/utils'

const TRACK_CLASS = 'relative h-1 grow rounded-pill'
const TRACK_STYLE = { background: 'color-mix(in srgb, var(--text-1) 10%, transparent)' }
const THUMB_CLASS = cn(
  'block h-4 w-4 rounded-full bg-primary-btn shadow-1 outline-none transition-transform',
  'hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)]',
  'disabled:pointer-events-none disabled:opacity-45'
)
const THUMB_STYLE = { transitionDuration: 'var(--d-micro)', transitionTimingFunction: 'var(--ease-standard)' }

export interface SliderProps {
  min: number
  max: number
  value: number
  onChange: (value: number) => void
  step?: number
  formatValue?: (value: number) => string
  disabled?: boolean
  className?: string
}

/**
 * Одиночный слайдер (04 §3.13): трек 4 px, заполнение `--accent`, ползунок `--primary-btn`.
 * Обёртка `w-full`: без неё внутри flex-строки («Масштаб» в кроппере) она сжималась
 * до ширины ползунка и трека не было видно.
 */
export function Slider({
  min,
  max,
  value,
  onChange,
  step = 1,
  formatValue,
  disabled,
  className
}: SliderProps): ReactElement {
  return (
    <div className={cn('flex w-full min-w-0 flex-col gap-1.5', className)}>
      {formatValue && (
        <div className="type-small tabular text-right text-text-2">{formatValue(value)}</div>
      )}
      <SliderPrimitive.Root
        min={min}
        max={max}
        step={step}
        value={[value]}
        disabled={disabled}
        onValueChange={([next]) => {
          if (next !== undefined) onChange(next)
        }}
        className="relative flex h-4 w-full touch-none select-none items-center"
      >
        <SliderPrimitive.Track className={TRACK_CLASS} style={TRACK_STYLE}>
          <SliderPrimitive.Range className="absolute h-full rounded-pill bg-accent" />
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb className={THUMB_CLASS} style={THUMB_STYLE} />
      </SliderPrimitive.Root>
    </div>
  )
}

export interface RangeSliderProps {
  min: number
  max: number
  value: [number, number]
  onChange: (value: [number, number]) => void
  step?: number
  formatValue?: (value: number) => string
  disabled?: boolean
  className?: string
}

/** Двойной слайдер: два ползунка, значения в полях над треком (04 §3.13). */
export function RangeSlider({
  min,
  max,
  value,
  onChange,
  step = 1,
  formatValue,
  disabled,
  className
}: RangeSliderProps): ReactElement {
  return (
    <div className={cn('flex w-full min-w-0 flex-col gap-1.5', className)}>
      {formatValue && (
        <div className="type-small tabular flex justify-between text-text-2">
          <span>{formatValue(value[0])}</span>
          <span>{formatValue(value[1])}</span>
        </div>
      )}
      <SliderPrimitive.Root
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        minStepsBetweenThumbs={1}
        onValueChange={(next) => {
          const lo = next[0]
          const hi = next[1]
          if (lo !== undefined && hi !== undefined) onChange([lo, hi])
        }}
        className="relative flex h-4 w-full touch-none select-none items-center"
      >
        <SliderPrimitive.Track className={TRACK_CLASS} style={TRACK_STYLE}>
          <SliderPrimitive.Range className="absolute h-full rounded-pill bg-accent" />
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb className={THUMB_CLASS} style={THUMB_STYLE} aria-label={formatValue?.(value[0])} />
        <SliderPrimitive.Thumb className={THUMB_CLASS} style={THUMB_STYLE} aria-label={formatValue?.(value[1])} />
      </SliderPrimitive.Root>
    </div>
  )
}
