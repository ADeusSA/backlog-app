import type { HTMLAttributes, ReactElement, ReactNode } from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

export const Dialog = DialogPrimitive.Root
export const DialogTrigger = DialogPrimitive.Trigger
export const DialogClose = DialogPrimitive.Close

export type DialogSize = 480 | 640 | 800

const SIZE_CLASS: Record<DialogSize, string> = {
  480: 'w-[480px]',
  640: 'w-[640px]',
  800: 'w-[800px]'
}

export interface DialogContentProps {
  children: ReactNode
  size?: DialogSize
  className?: string
  /** Доступное имя кнопки закрытия — передаётся вызывающей стороной (i18n снаружи). */
  closeLabel?: string
  onOpenAutoFocus?: (event: Event) => void
}

/** Диалог: overlay `--overlay` + blur 8 px, панель — стекло, ширина 480/640/800 (04 §3.11). */
export function DialogContent({
  children,
  size = 480,
  className,
  closeLabel,
  onOpenAutoFocus
}: DialogContentProps): ReactElement {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay
        className={cn(
          'fixed inset-0 z-50',
          'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
          'data-[state=open]:duration-[var(--d-enter)] data-[state=closed]:duration-[var(--d-micro)]'
        )}
        style={{ background: 'var(--overlay)', backdropFilter: 'blur(8px)' }}
      />
      <DialogPrimitive.Content
        onOpenAutoFocus={onOpenAutoFocus}
        className={cn(
          'glass-strong fixed left-1/2 top-1/2 z-50 max-h-[85vh] max-w-[92vw] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg border border-border-1 p-6 shadow-3 outline-none',
          'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
          'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
          'data-[state=open]:duration-[var(--d-enter)] data-[state=closed]:duration-[var(--d-micro)]',
          SIZE_CLASS[size],
          className
        )}
      >
        {children}
        <DialogPrimitive.Close
          aria-label={closeLabel}
          className={cn(
            'absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-sm text-text-2 outline-none transition-colors',
            'hover:bg-surface-2 hover:text-text-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)]'
          )}
          style={{ transitionDuration: 'var(--d-micro)' }}
        >
          <X size={16} strokeWidth={1.75} />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
}

export function DialogHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>): ReactElement {
  return <div className={cn('mb-4 flex flex-col gap-1 pr-8', className)} {...props} />
}

export function DialogFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>): ReactElement {
  return (
    <div className={cn('mt-6 flex items-center justify-end gap-2', className)} {...props} />
  )
}

export function DialogTitle({
  className,
  ...props
}: DialogPrimitive.DialogTitleProps): ReactElement {
  return <DialogPrimitive.Title className={cn('type-h2 text-text-1', className)} {...props} />
}

export function DialogDescription({
  className,
  ...props
}: DialogPrimitive.DialogDescriptionProps): ReactElement {
  return <DialogPrimitive.Description className={cn('type-small text-text-2', className)} {...props} />
}
