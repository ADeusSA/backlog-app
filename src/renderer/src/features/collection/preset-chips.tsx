import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { ViewState, Filters } from '@shared/schema/filters'
import { Chip } from '@/components/ui/chip'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger
} from '@/components/ui/context-menu'
import { toast } from '@/components/ui/toast'
import { call } from '@/platform/api'

interface Props {
  scopeKey: string
  state: ViewState
  onApply: (filters: Filters) => void
}

/** Пресеты фильтров чипами под заголовком коллекции (ТЗ 07 §2). */
export function PresetChips({ scopeKey, state, onApply }: Props): React.ReactElement | null {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')

  const { data: presets } = useQuery({
    queryKey: ['presets', scopeKey],
    queryFn: () => call('presets.list', { scope: scopeKey })
  })

  const invalidate = (): void => {
    void queryClient.invalidateQueries({ queryKey: ['presets', scopeKey] })
  }

  const save = useMutation({
    mutationFn: () =>
      call('presets.save', {
        scope: scopeKey,
        name: name.trim(),
        filtersJson: JSON.stringify(state.filters),
        sortJson: JSON.stringify(state.sort),
        view: state.view
      }),
    onSuccess: () => {
      setCreating(false)
      setName('')
      invalidate()
      toast({ title: t('presets.saved'), tone: 'success' })
    },
    onError: (err: Error) => toast({ title: err.message, tone: 'danger' })
  })

  const currentJson = JSON.stringify(state.filters)

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {(presets ?? []).map((preset) => (
        <ContextMenu key={preset.id}>
          <ContextMenuTrigger asChild>
            <Chip
              selected={preset.filtersJson === currentJson}
              onClick={() => {
                try {
                  onApply(JSON.parse(preset.filtersJson) as Filters)
                } catch {
                  toast({ title: t('presets.broken'), tone: 'danger' })
                }
              }}
            >
              {preset.name}
            </Chip>
          </ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuItem
              onSelect={() => {
                void call('presets.delete', { id: preset.id })
                  .then(() => {
                    invalidate()
                    toast({ title: t('presets.deleted') })
                  })
                  .catch((err: Error) => toast({ title: err.message, tone: 'danger' }))
              }}
            >
              {t('action.delete')}
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      ))}

      <Button
        variant="ghost"
        size="sm"
        aria-label={t('presets.create')}
        onClick={() => setCreating(true)}
      >
        <Plus size={14} strokeWidth={1.75} />
      </Button>

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent size={480}>
          <DialogHeader>
            <DialogTitle>{t('presets.create')}</DialogTitle>
          </DialogHeader>
          <Input
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={t('presets.name')}
          />
          <DialogFooter>
            <Button variant="secondary" onClick={() => setCreating(false)}>
              {t('action.cancel')}
            </Button>
            <Button
              variant="primary"
              disabled={!name.trim()}
              loading={save.isPending}
              onClick={() => save.mutate()}
            >
              {t('action.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
