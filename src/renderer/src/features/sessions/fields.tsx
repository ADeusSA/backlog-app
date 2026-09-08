import type { ReactElement, ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** Подписанное поле формы — общее для диалогов сессии и прохождения. */
export function Field({
  label,
  children,
  hint,
  className
}: {
  label: string
  children: ReactNode
  hint?: string
  className?: string
}): ReactElement {
  return (
    <label className={cn('flex flex-col gap-1.5', className)}>
      <span className="type-small" style={{ color: 'var(--text-2)' }}>
        {label}
      </span>
      {children}
      {hint && (
        <span className="type-small" style={{ color: 'var(--text-3)' }}>
          {hint}
        </span>
      )}
    </label>
  )
}

/** Сегодняшняя дата в местной зоне — журнал хранит дни, а не моменты (02 §3.9). */
export function todayLocal(): string {
  const date = new Date()
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** Поле даты с тем же оформлением, что в панели пользователя (06 §6.2 п.5). */
export const DATE_INPUT_CLASS =
  'type-body h-[36px] w-full min-w-0 rounded-sm border border-border-1 bg-surface-1 px-2 text-text-1 outline-none [color-scheme:dark] hover:border-border-2 focus-visible:border-[var(--border-focus)]'
