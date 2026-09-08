import type { ReactElement } from 'react'
import { useEffect, useRef, useState } from 'react'
import { animate, motion } from 'motion/react'
import { cn } from '@/lib/utils'
import { DURATION, EASE_EMPHASIZED, transitions } from '@/lib/motion'
import { readMotionDuration, useMotionMode } from './use-motion-mode'

export interface ProgressRingProps {
  done: number
  total: number
  size?: 24 | 40 | 56
  tone?: 'accent' | 'success'
  showValue?: boolean
  label?: string
  className?: string
}

const STROKE: Record<24 | 40 | 56, number> = { 24: 3, 40: 4, 56: 5 }

/** Считает 0 → pct за `--d-ring` (900 мс, `emphasized`), с count-up числа (07 §6, 04 §3.7). */
function useCountUp(target: number, durationSeconds: number): number {
  const [value, setValue] = useState(0)
  const fromRef = useRef(0)

  useEffect(() => {
    const from = fromRef.current
    if (durationSeconds <= 0) {
      setValue(target)
      fromRef.current = target
      return
    }
    const controls = animate(from, target, {
      duration: durationSeconds,
      ease: EASE_EMPHASIZED,
      onUpdate: (v) => setValue(Math.round(v))
    })
    fromRef.current = target
    return () => controls.stop()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target])

  return value
}

/**
 * Кольцо прогресса (SVG). Заполнение — 900 мс `emphasized` от 0, число — count-up 600 мс.
 * При 100 % — цвет `success` и разовый «пульс» (04 §3.7, 07 §6).
 */
export function ProgressRing({
  done,
  total,
  size = 40,
  tone = 'accent',
  showValue = true,
  label,
  className
}: ProgressRingProps): ReactElement {
  const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0
  const isComplete = total > 0 && pct >= 100
  const activeTone = isComplete ? 'success' : tone
  const motionMode = useMotionMode()
  const ringDuration =
    motionMode === 'off' ? 0 : readMotionDuration('--d-ring', DURATION.ring)

  const displayValue = useCountUp(pct, ringDuration)

  const [pulse, setPulse] = useState(0)
  const wasComplete = useRef(isComplete)
  useEffect(() => {
    if (isComplete && !wasComplete.current && motionMode !== 'off') setPulse((p) => p + 1)
    wasComplete.current = isComplete
  }, [isComplete, motionMode])

  const stroke = STROKE[size]
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const color = activeTone === 'success' ? 'var(--success)' : 'var(--accent)'

  return (
    <div className={cn('inline-flex items-center gap-2.5', className)}>
      <motion.svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90 shrink-0"
        animate={pulse > 0 ? { scale: [1, 1.14, 1] } : undefined}
        transition={{ duration: 0.6, ease: EASE_EMPHASIZED }}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          style={{ stroke: 'color-mix(in srgb, var(--text-1) 10%, transparent)' }}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference * (1 - pct / 100) }}
          transition={ringDuration > 0 ? transitions.ring : { duration: 0 }}
          style={{ stroke: color }}
        />
        {showValue && size >= 40 && (
          <text
            x="50%"
            y="50%"
            dy="0.35em"
            textAnchor="middle"
            transform={`rotate(90 ${size / 2} ${size / 2})`}
            className="tabular"
            style={{ fill: 'var(--text-1)', fontSize: size === 56 ? 13 : 11, fontWeight: 600 }}
          >
            {displayValue}%
          </text>
        )}
      </motion.svg>
      {label && (
        <div className="type-small leading-tight text-text-2">
          <b className="type-h3 tabular block text-text-1">
            {done} / {total}
          </b>
          {label}
        </div>
      )}
    </div>
  )
}
