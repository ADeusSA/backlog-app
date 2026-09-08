import type { ReactElement } from 'react'
import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Input, Textarea } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { SavedTick } from './use-autosave'

interface FieldProps {
  value: string
  onChange: (value: string) => void
  saved: boolean
}

/** Блок 11 «Где остановился» (06 §6.2.11): однострочное поле до 200 символов. */
export function ResumeNoteField({ value, onChange, saved }: FieldProps): ReactElement {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="type-caption">{t('game.panel.resumeNote')}</span>
        <SavedTick show={saved} label={t('game.panel.saved')} />
      </div>
      <Input
        value={value}
        maxLength={200}
        placeholder={t('game.panel.resumeNote.placeholder')}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  )
}

/** Блок 12 «Заметки» (06 §6.2.12): свёрнут до 3 строк, разворачивается. Приватные. */
export function NotesField({ value, onChange, saved }: FieldProps): ReactElement {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="type-caption">{t('game.panel.notes')}</span>
        <SavedTick show={saved} label={t('game.panel.saved')} />
      </div>
      <Textarea
        value={value}
        maxLength={20000}
        rows={expanded ? 10 : 3}
        placeholder={t('game.panel.notes.placeholder')}
        onChange={(event) => onChange(event.target.value)}
      />
      <Button variant="ghost" size="sm" className="self-start" onClick={() => setExpanded((v) => !v)}>
        {expanded ? <ChevronUp size={14} strokeWidth={1.75} /> : <ChevronDown size={14} strokeWidth={1.75} />}
        {expanded ? t('action.collapse') : t('action.readMore')}
      </Button>
    </div>
  )
}

interface ReviewFieldProps {
  value: string
  hasSpoilers: boolean
  onChangeValue: (value: string) => void
  onChangeSpoilers: (value: boolean) => void
  saved: boolean
}

/** Блок 13 «Отзыв» (06 §6.2.13): markdown-текст + чекбокс «содержит спойлеры». */
export function ReviewField({ value, hasSpoilers, onChangeValue, onChangeSpoilers, saved }: ReviewFieldProps): ReactElement {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="type-caption">{t('game.panel.review')}</span>
        <SavedTick show={saved} label={t('game.panel.saved')} />
      </div>
      <Textarea
        value={value}
        maxLength={20000}
        rows={4}
        placeholder={t('game.panel.review.placeholder')}
        onChange={(event) => onChangeValue(event.target.value)}
      />
      <Checkbox
        checked={hasSpoilers}
        onChange={onChangeSpoilers}
        label={t('game.panel.review.spoilers')}
      />
    </div>
  )
}
