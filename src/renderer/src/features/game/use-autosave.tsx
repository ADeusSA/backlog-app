import type { ReactElement } from 'react'
import { useCallback, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Check } from 'lucide-react'
import type { GameDetail, UserGameDto, UserGamePatch } from '@shared/schema/entities'
import { call } from '@/platform/api'
import { toast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'

const DEBOUNCE_MS = 400
const SAVED_FLASH_MS = 1600

export interface GameAutosave {
  /** Оптимистично обновляет кеш и через `delayMs` пишет патч (05 §7). */
  patch: (key: string, value: UserGamePatch, delayMs?: number) => void
  /** Ключи полей, для которых сейчас показывается индикатор «Сохранено ✓». */
  saved: Record<string, boolean>
}

/**
 * Автосохранение пользовательских полей страницы игры: дебаунс 400 мс на ключ поля,
 * оптимистичное обновление кеша `['game', gameId]`, короткая вспышка «Сохранено» (05 §7).
 * Полная инвалидация тоже приходит через событие `dbChanged` из main (см. platform/events),
 * но локальное обновление кеша не даёт панели «моргнуть» до прихода этого события.
 */
export function useGameAutosave(gameId: string): GameAutosave {
  const queryClient = useQueryClient()
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const flashTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const [saved, setSaved] = useState<Record<string, boolean>>({})

  const patch = useCallback(
    (key: string, value: UserGamePatch, delayMs: number = DEBOUNCE_MS) => {
      queryClient.setQueryData<GameDetail | null | undefined>(['game', gameId], (old) => {
        if (!old?.userGame) return old
        return { ...old, userGame: { ...old.userGame, ...value } as UserGameDto }
      })

      const existing = timers.current[key]
      if (existing) clearTimeout(existing)
      timers.current[key] = setTimeout(() => {
        call('userGame.patch', { gameId, patch: value })
          .then((updated) => {
            queryClient.setQueryData<GameDetail | null | undefined>(['game', gameId], (old) =>
              old ? { ...old, userGame: updated } : old
            )
            void queryClient.invalidateQueries({ queryKey: ['game', gameId] })
            setSaved((s) => ({ ...s, [key]: true }))
            const existingFlash = flashTimers.current[key]
            if (existingFlash) clearTimeout(existingFlash)
            flashTimers.current[key] = setTimeout(() => {
              setSaved((s) => ({ ...s, [key]: false }))
            }, SAVED_FLASH_MS)
          })
          .catch((err: Error) => {
            toast({ title: err.message, tone: 'danger' })
          })
      }, delayMs)
    },
    [gameId, queryClient]
  )

  return { patch, saved }
}

/** Индикатор «Сохранено ✓» рядом с полем (05 §7) — плавное появление/исчезание. */
export function SavedTick({
  show,
  label,
  className
}: {
  show: boolean
  label: string
  className?: string
}): ReactElement {
  return (
    <span
      className={cn('inline-flex items-center gap-1 type-small text-success transition-opacity', className)}
      style={{ opacity: show ? 1 : 0, transitionDuration: 'var(--d-enter)' }}
      aria-hidden={!show}
    >
      <Check size={12} strokeWidth={1.75} />
      {label}
    </span>
  )
}
