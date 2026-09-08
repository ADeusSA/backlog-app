import type { CSSProperties, ReactElement } from 'react'
import { cn } from '@/lib/utils'
import { useMotionMode } from './use-motion-mode'

export interface BloomBackdropProps {
  /** Цвет левого верхнего свечения (04 §2.4). По умолчанию `--bloom-a`. */
  colorA?: string
  /** Цвет правого нижнего свечения. По умолчанию `--bloom-b`. */
  colorB?: string
  className?: string
}

const SHARED: CSSProperties = {
  position: 'absolute',
  borderRadius: '50%',
  filter: 'blur(var(--bloom-blur))',
  opacity: 'var(--bloom-opacity)' as unknown as number,
  pointerEvents: 'none',
  willChange: 'transform'
}

/**
 * Два фоновых свечения сцены — не более двух на экран (04 §1 правило 4, §2.4).
 * Дрейф отключается при `prefers-reduced-motion` и в режиме «уменьшенные»/«выключены».
 */
export function BloomBackdrop({ colorA, colorB, className }: BloomBackdropProps): ReactElement {
  const driftEnabled = useMotionMode() === 'full'

  return (
    <div className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)} aria-hidden>
      <div
        style={{
          ...SHARED,
          left: -120,
          top: -160,
          width: 520,
          height: 520,
          background: `radial-gradient(circle, ${colorA ?? 'var(--bloom-a)'}, transparent 68%)`,
          animation: driftEnabled ? 'bloom-drift-a var(--d-drift) ease-in-out infinite alternate' : undefined
        }}
      />
      <div
        style={{
          ...SHARED,
          right: -80,
          bottom: -200,
          width: 560,
          height: 560,
          background: `radial-gradient(circle, ${colorB ?? 'var(--bloom-b)'}, transparent 68%)`,
          animation: driftEnabled
            ? 'bloom-drift-b var(--d-drift) ease-in-out infinite alternate'
            : undefined,
          animationDelay: driftEnabled ? '-7s' : undefined
        }}
      />
    </div>
  )
}
