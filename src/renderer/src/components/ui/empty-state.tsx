import type { ReactElement, ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Button } from './button'

export interface EmptyStateAction {
  label: string
  onClick: () => void
}

export interface EmptyStateProps {
  icon: ReactNode
  title: string
  description?: string
  action?: EmptyStateAction
  className?: string
}

/** Пустое состояние: иконка-линия, заголовок, описание, одна primary-кнопка (04 §3.15). */
export function EmptyState({ icon, title, description, action, className }: EmptyStateProps): ReactElement {
  return (
    <div className={cn('flex flex-col items-center gap-3 px-6 py-12 text-center', className)}>
      <div className="flex h-14 w-14 items-center justify-center rounded-full border border-border-1 text-text-3 [&>svg]:h-6 [&>svg]:w-6">
        {icon}
      </div>
      <div className="flex flex-col gap-1">
        <h3 className="type-h3 text-text-1">{title}</h3>
        {description && <p className="type-small max-w-[42ch] text-text-2">{description}</p>}
      </div>
      {action && (
        <Button variant="primary" size="md" onClick={action.onClick} className="mt-2">
          {action.label}
        </Button>
      )}
    </div>
  )
}
