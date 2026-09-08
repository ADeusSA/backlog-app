import { useState, type ReactElement } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { MessageSquareText } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { GameCardDto } from '@shared/schema/entities'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Textarea } from '@/components/ui/input'
import { toast } from '@/components/ui/toast'
import { call } from '@/platform/api'
import { cn } from '@/lib/utils'

export interface ListItemExtraProps {
  listId: string
  game: GameCardDto
}

/**
 * Добавка к карточке игры в списке (`renderItemExtra` из контракта коллекции):
 * иконка заметки к позиции (попап до 300 симв., `lists.setItemNote`) и, для игр вне
 * библиотеки, приглушённый бейдж + кнопка «В бэклог» (06 §3.3).
 */
export function ListItemExtra({ listId, game }: ListItemExtraProps): ReactElement {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState(game.positionNote ?? '')
  const [saving, setSaving] = useState(false)
  const [addingToLibrary, setAddingToLibrary] = useState(false)

  async function saveNote(): Promise<void> {
    setSaving(true)
    try {
      await call('lists.setItemNote', { listId, gameId: game.id, note: value.trim() ? value.trim() : null })
      await queryClient.invalidateQueries({ queryKey: ['lists'] })
      setOpen(false)
    } catch (err) {
      toast({ title: (err as Error).message, tone: 'danger' })
    } finally {
      setSaving(false)
    }
  }

  async function addToBacklog(): Promise<void> {
    setAddingToLibrary(true)
    try {
      await call('userGame.addToLibrary', { gameIds: [game.id], status: 'backlog' })
      await queryClient.invalidateQueries({ queryKey: ['lists'] })
      toast({ title: t('action.addToBacklog'), tone: 'success' })
    } catch (err) {
      toast({ title: (err as Error).message, tone: 'danger' })
    } finally {
      setAddingToLibrary(false)
    }
  }

  const notInLibrary = game.status === null

  return (
    <div className="flex items-center gap-1.5">
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          if (next) setValue(game.positionNote ?? '')
        }}
      >
        <PopoverTrigger asChild>
          <button
            type="button"
            title={t('lists.item.note')}
            className={cn(
              'flex h-6 w-6 items-center justify-center rounded-full outline-none transition-colors',
              game.positionNote ? 'text-accent' : 'text-text-3 hover:text-text-1'
            )}
            style={{ transitionDuration: 'var(--d-micro)' }}
          >
            <MessageSquareText size={14} strokeWidth={1.75} />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[260px]">
          <Textarea
            autoFocus
            rows={3}
            maxLength={300}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder={t('lists.item.notePlaceholder') ?? undefined}
          />
          <div className="mt-2 flex items-center justify-between">
            <span className="type-small" style={{ color: 'var(--text-3)' }}>
              {value.length}/300
            </span>
            <Button type="button" size="sm" variant="primary" loading={saving} onClick={() => void saveNote()}>
              {t('action.save')}
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      {notInLibrary && (
        <>
          <Badge tone="neutral">{t('status.none')}</Badge>
          <Button type="button" size="sm" variant="secondary" loading={addingToLibrary} onClick={() => void addToBacklog()}>
            {t('action.addToBacklog')}
          </Button>
        </>
      )}
    </div>
  )
}
