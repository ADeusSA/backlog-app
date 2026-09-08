import type { ReactElement } from 'react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from '@/components/ui/toast'
import { call } from '@/platform/api'

export interface DeleteListDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  listId: string
  listName: string
  onDeleted: () => void
}

/** Подтверждение удаления списка: «Игры останутся в библиотеке» (06 §3.3). */
export function DeleteListDialog({
  open,
  onOpenChange,
  listId,
  listName,
  onDeleted
}: DeleteListDialogProps): ReactElement {
  const { t } = useTranslation()
  const [busy, setBusy] = useState(false)

  const confirm = async (): Promise<void> => {
    setBusy(true)
    try {
      await call('lists.delete', { id: listId })
      toast({ title: t('lists.deleted', { name: listName }), tone: 'success' })
      onOpenChange(false)
      onDeleted()
    } catch (err) {
      toast({ title: (err as Error).message, tone: 'danger' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size={480} closeLabel={t('action.close') ?? undefined}>
        <DialogHeader>
          <DialogTitle>{t('lists.delete.title', { name: listName })}</DialogTitle>
          <DialogDescription>{t('lists.delete.hint')}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            {t('action.cancel')}
          </Button>
          <Button type="button" variant="danger" loading={busy} onClick={() => void confirm()}>
            {t('action.delete')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
