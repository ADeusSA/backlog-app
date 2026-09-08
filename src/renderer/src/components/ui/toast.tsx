import type { ReactElement } from 'react'
import { useEffect, useRef } from 'react'
import { create } from 'zustand'
import { AnimatePresence, motion } from 'motion/react'
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react'
import { variants } from '@/lib/motion'
import { useReducedMotion } from './use-motion-mode'

export type ToastTone = 'info' | 'success' | 'danger'

export interface ToastAction {
  label: string
  onClick: () => void
}

export interface ToastOptions {
  title: string
  description?: string
  tone?: ToastTone
  action?: ToastAction
  /** Длительность автоскрытия, мс. По умолчанию 4000 (04 §3.12). */
  duration?: number
}

export interface ToastItem extends ToastOptions {
  id: string
}

interface ToastState {
  toasts: ToastItem[]
  push: (options: ToastOptions) => string
  dismiss: (id: string) => void
}

const MAX_TOASTS = 3

/** Стор тостов (zustand): стек до 3, см. CONTRACT.md и 04 §3.12. */
export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (options) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    set((state) => ({ toasts: [...state.toasts, { id, ...options }].slice(-MAX_TOASTS) }))
    return id
  },
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }))
}))

/** Показать тост. `toast({ title, description?, tone?, action?, duration? })`. */
export function toast(options: ToastOptions): string {
  return useToastStore.getState().push(options)
}

const TONE_ICON: Record<ToastTone, ReactElement> = {
  info: <Info size={18} strokeWidth={1.75} className="text-accent" />,
  success: <CheckCircle2 size={18} strokeWidth={1.75} className="text-success" />,
  danger: <AlertCircle size={18} strokeWidth={1.75} className="text-danger" />
}

function ToastCard({ item }: { item: ToastItem }): ReactElement {
  const dismiss = useToastStore((s) => s.dismiss)
  const duration = item.duration ?? 4000
  const reducedMotion = useReducedMotion()
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    timerRef.current = setTimeout(() => dismiss(item.id), duration)
    return () => clearTimeout(timerRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id, duration])

  return (
    <motion.div
      layout
      variants={variants.toast}
      initial="hidden"
      animate="visible"
      exit="exit"
      transition={reducedMotion ? { duration: 0 } : undefined}
      className="glass pointer-events-auto relative w-[320px] overflow-hidden rounded-md border border-border-1 p-3 shadow-3"
      role="status"
    >
      <div className="flex items-start gap-2.5">
        <div className="mt-0.5 shrink-0">{TONE_ICON[item.tone ?? 'info']}</div>
        <div className="min-w-0 flex-1">
          <p className="type-small font-semibold text-text-1">{item.title}</p>
          {item.description && <p className="type-small mt-0.5 text-text-2">{item.description}</p>}
          {item.action && (
            <button
              type="button"
              onClick={() => {
                item.action?.onClick()
                dismiss(item.id)
              }}
              className="type-small mt-1.5 font-semibold text-text-1 underline-offset-2 outline-none hover:underline focus-visible:underline"
            >
              {item.action.label}
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={() => dismiss(item.id)}
          className="shrink-0 rounded-sm p-0.5 text-text-3 outline-none transition-colors hover:text-text-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)]"
          style={{ transitionDuration: 'var(--d-micro)' }}
        >
          <X size={14} strokeWidth={1.75} />
        </button>
      </div>
      <div
        className="absolute bottom-0 left-0 h-0.5 bg-accent"
        style={{
          animation: reducedMotion ? undefined : `toast-progress ${duration}ms linear forwards`,
          width: reducedMotion ? 0 : undefined
        }}
      />
    </motion.div>
  )
}

/** Контейнер стека тостов — смонтировать один раз в корне приложения. */
export function Toaster(): ReactElement {
  const toasts = useToastStore((s) => s.toasts)

  return (
    <div className="pointer-events-none fixed bottom-6 right-6 z-[100] flex flex-col-reverse gap-2.5">
      <style>{'@keyframes toast-progress { from { width: 100%; } to { width: 0%; } }'}</style>
      <AnimatePresence initial={false}>
        {toasts.map((item) => (
          <ToastCard key={item.id} item={item} />
        ))}
      </AnimatePresence>
    </div>
  )
}
