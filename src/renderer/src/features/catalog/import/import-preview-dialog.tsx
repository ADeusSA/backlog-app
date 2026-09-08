import { useMemo, useState, type ReactElement } from 'react'
import { ArrowRight, Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { GameInput } from '@shared/schema/entities'
import type { CanonicalGame } from '@shared/schema/providers'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { applyRows, buildRows, matchEntities, type ApplyResult, type Catalogs, type FieldId, type FieldRow } from './fields'
import { useRemoteImage } from './use-remote-image'

interface Props {
  game: CanonicalGame | null
  form: GameInput
  catalogs: Catalogs
  currentImages: { cover: string | null; backdrop: string | null; logo: string | null }
  onCancel: () => void
  onApply: (result: ApplyResult, fields: FieldId[]) => void
  applying: boolean
}

/**
 * Предпросмотр импорта (08 §3 п. 2): две колонки «Сейчас в форме» / «Из источника»,
 * у каждого поля — флажок «применить». По умолчанию отмечено то, что в форме пусто:
 * импорт не должен молча переписывать введённое руками.
 */
export function ImportPreviewDialog({
  game,
  form,
  catalogs,
  currentImages,
  onCancel,
  onApply,
  applying
}: Props): ReactElement | null {
  const { t } = useTranslation()

  const matched = useMemo(() => (game ? matchEntities(game, catalogs) : null), [game, catalogs])
  const rows = useMemo(
    () => (game && matched ? buildRows(game, form, matched, catalogs, currentImages) : []),
    [game, form, matched, catalogs, currentImages]
  )

  // Ключ пересоздаёт состояние выбора при смене игры — иначе галочки переносились бы
  // с прошлого результата поиска на новый.
  const [selected, setSelected] = useState<Set<FieldId>>(new Set())
  const [initializedFor, setInitializedFor] = useState<string | null>(null)
  const key = game ? `${game.provider}:${game.externalId}` : null
  if (key && initializedFor !== key) {
    setInitializedFor(key)
    setSelected(new Set(rows.filter((row) => row.defaultChecked).map((row) => row.id)))
  }

  if (!game || !matched) return null

  const toggle = (id: FieldId): void => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const setAll = (value: boolean): void => {
    setSelected(value ? new Set(rows.map((row) => row.id)) : new Set())
  }

  const apply = (): void => {
    onApply(applyRows(game, matched, selected), [...selected])
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent size={800}>
        <DialogHeader>
          <DialogTitle>
            {t('catalog.import.previewTitle', { title: game.title ?? '—' })}
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-2 pb-1">
          <span className="type-small" style={{ color: 'var(--text-3)' }}>
            {t('catalog.import.selectedCount', { count: selected.size, total: rows.length })}
          </span>
          <div className="flex-1" />
          <Button type="button" variant="ghost" size="sm" onClick={() => setAll(true)}>
            {t('catalog.import.selectAll')}
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => setAll(false)}>
            {t('catalog.import.selectNone')}
          </Button>
        </div>

        <div className="max-h-[54vh] min-h-0 overflow-y-auto pr-1">
          <div className="grid grid-cols-[24px_150px_1fr_16px_1fr] items-start gap-x-3 gap-y-1">
            <div />
            <div />
            <span className="type-caption pb-1">{t('catalog.import.columnCurrent')}</span>
            <div />
            <span className="type-caption pb-1">{t('catalog.import.columnIncoming')}</span>

            {rows.map((row) => (
              <PreviewRow key={row.id} row={row} checked={selected.has(row.id)} onToggle={() => toggle(row.id)} />
            ))}
          </div>

          {rows.length === 0 && (
            <p className="py-6 text-center type-body" style={{ color: 'var(--text-3)' }}>
              {t('catalog.import.nothingNew')}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="secondary" onClick={onCancel}>
            {t('action.cancel')}
          </Button>
          <Button
            type="button"
            variant="primary"
            loading={applying}
            disabled={selected.size === 0}
            onClick={apply}
          >
            {t('action.apply')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function PreviewRow({
  row,
  checked,
  onToggle
}: {
  row: FieldRow
  checked: boolean
  onToggle: () => void
}): ReactElement {
  const { t } = useTranslation()
  const label = t(row.labelKey)

  return (
    <>
      <div className="pt-1.5">
        <Checkbox checked={checked} onChange={onToggle} />
      </div>
      <span className="pt-1.5 type-small" style={{ color: 'var(--text-2)' }}>
        {label}
      </span>

      <div className={cn('min-w-0 rounded-[var(--r-sm)] px-2 py-1.5', checked && 'opacity-55')}>
        <ValueCell row={row} side="current" />
      </div>
      <ArrowRight
        size={14}
        strokeWidth={1.75}
        className="mt-2"
        style={{ color: checked ? 'var(--accent)' : 'var(--text-3)' }}
      />
      <div
        className="min-w-0 rounded-[var(--r-sm)] px-2 py-1.5"
        style={{ background: checked ? 'var(--accent-soft)' : 'transparent' }}
      >
        <ValueCell row={row} side="incoming" />
        {checked && (row.createsNew?.length ?? 0) > 0 && (
          <p className="flex items-center gap-1 pt-1 type-caption" style={{ color: 'var(--warning)' }}>
            <Plus size={11} strokeWidth={2} />
            {t('catalog.import.willCreate', { names: row.createsNew?.join(', ') })}
          </p>
        )}
      </div>
    </>
  )
}

/** Ячейка значения: картинки показываем превью, длинный текст — с ограничением высоты. */
function ValueCell({ row, side }: { row: FieldRow; side: 'current' | 'incoming' }): ReactElement {
  const { t } = useTranslation()
  const value = side === 'current' ? row.current : row.incoming
  const remote = useRemoteImage(row.kind === 'image' && side === 'incoming' ? row.imageUrl : null)

  if (row.kind === 'image') {
    if (side === 'current') {
      return (
        <span className="type-small" style={{ color: 'var(--text-3)' }}>
          {value ? t('catalog.import.imageSet') : '—'}
        </span>
      )
    }
    return remote ? (
      <img
        src={remote}
        alt=""
        className="max-h-[92px] rounded-[var(--r-sm)] object-contain"
        style={{ background: 'var(--surface-2)' }}
      />
    ) : (
      <span className="type-small" style={{ color: 'var(--text-3)' }}>
        {t('common.loading')}
      </span>
    )
  }

  if (!value) {
    return (
      <span className="type-small" style={{ color: 'var(--text-3)' }}>
        —
      </span>
    )
  }

  const text = row.kind === 'enum' ? t(enumKey(row.id, value), { defaultValue: value }) : value
  return (
    <p className={cn('type-small break-words', row.kind === 'longText' && 'line-clamp-4')}>{text}</p>
  )
}

/** Категория и статус релиза показываются локализованно, как и в самой форме. */
function enumKey(field: string, value: string): string {
  if (field === 'category') return `category.${value}`
  if (field === 'releaseStatus') return `releaseStatus.${value}`
  return value
}
