import type { ReactElement } from 'react'
import * as AvatarPrimitive from '@radix-ui/react-avatar'
import { cn } from '@/lib/utils'

export interface AvatarProps {
  src?: string | null
  name: string
  size?: number
  className?: string
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const first = parts[0]?.[0] ?? ''
  const second = parts.length > 1 ? (parts[1]?.[0] ?? '') : ''
  return `${first}${second}`.toUpperCase() || '?'
}

/** Аватар пользователя/студии: картинка либо инициалы (04 §3.8). */
export function Avatar({ src, name, size = 32, className }: AvatarProps): ReactElement {
  return (
    <AvatarPrimitive.Root
      className={cn(
        'inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full border border-border-1 bg-surface-2 text-text-1',
        className
      )}
      style={{ width: size, height: size, fontSize: Math.max(10, Math.round(size * 0.36)) }}
    >
      {src && (
        <AvatarPrimitive.Image src={src} alt={name} className="h-full w-full object-cover" />
      )}
      <AvatarPrimitive.Fallback delayMs={src ? 400 : 0} className="font-semibold">
        {initials(name)}
      </AvatarPrimitive.Fallback>
    </AvatarPrimitive.Root>
  )
}
