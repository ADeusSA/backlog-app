import type { HTMLAttributes, ReactElement } from 'react'
import { cn } from '@/lib/utils'

export type SkeletonProps = HTMLAttributes<HTMLDivElement>

/** Скелетон-заглушка с шиммером (04 §3.15). Форма/размер — через `className`. */
export function Skeleton({ className, ...props }: SkeletonProps): ReactElement {
  return <div className={cn('skeleton', className)} {...props} />
}
