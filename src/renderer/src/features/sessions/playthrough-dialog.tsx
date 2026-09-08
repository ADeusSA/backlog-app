import type { ReactElement } from 'react'
import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { PLAYTHROUGH_STATUSES, type PlaythroughStatus } from '@shared/constants'
import type { PlaythroughDto } from '@shared/schema/sessions'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Combobox } from '@/components/ui/combobox'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Input, Textarea } from '@/components/ui/input'
import { RatingStars } from '@/components/ui/rating-stars'
import { Segmented } from '@/components/ui/segmented'
import { toast } from '@/components/ui/toast'
import { call } from '@/platform/api'
import { single } from '@/lib/form-utils'
import { DATE_INPUT_CLASS, Field } from './fields'

export interface PlaythroughDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  gameId: string
  playthrough?: PlaythroughDto | null
  onSaved?: () => void
}

interface FormState {
  title: string
  status: PlaythroughStatus
  platformId: string | null
  rating: number | null
  isReplay: boolean
  isMastered: boolean
  hours: string
  minutes: string
  startedAt: string
  finishedAt: string
  notes: string
}

function initialState(playthrough: PlaythroughDto | null | undefined): FormState {
  if (!playthrough) {
    return {
      title: '',
      status: 'in_progress',
      platformId: null,
      rating: null,
      isReplay: false,
      isMastered: false,
      hours: '0',
      minutes: '0',
      startedAt: '',
      finishedAt: '',
      notes: ''
    }
  }
  return {
    title: playthrough.title ?? '',
    status: playthrough.status,
    platformId: playthrough.platformId,
    rating: playthrough.rating,
    isReplay: playthrough.isReplay,
    isMastered: playthrough.isMastered,
    hours: String(Math.floor(playthrough.playtimeMinutes / 60)),
    minutes: String(playthrough.playtimeMinutes % 60),
    startedAt: playthrough.startedAt ?? '',
    finishedAt: playthrough.finishedAt ?? '',
    notes: playthrough.notes ?? ''
  }
}

/** Создание и правка прохождения (02 §3.9): первое прохождение, NG+, реплей. */
export function PlaythroughDialog({
  open,
  onOpenChange,
  gameId,
  playthrough,
  onSaved
}: PlaythroughDialogProps): ReactElement {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [form, setForm] = useState<FormState>(() => initialState(playthrough))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { data: platforms } = useQuery({
    queryKey: ['catalog', 'platforms'],
    queryFn: () => call('catalog.platforms.list')
  })

  useEffect(() => {
    if (open) {
      setForm(initialState(playthrough))
      setError(null)
    }
  }, [open, playthrough])

  // Часы прохождения с сессиями считаются по журналу — поле только для чтения.
  const fromSessions = (playthrough?.sessionCount ?? 0) > 0

  async function save(): Promise<void> {
    if (form.startedAt && form.finishedAt && form.finishedAt < form.startedAt) {
      setError(t('game.panel.date.error'))
      return
    }
    setBusy(true)
    try {
      await call('playthroughs.save', {
        ...(playthrough ? { id: playthrough.id } : {}),
        gameId,
        title: form.title.trim() || null,
        platformId: form.platformId,
        status: form.status,
        isReplay: form.isReplay,
        isMastered: form.isMastered,
        rating: form.rating,
        playtimeMinutes:
          Math.max(0, Number(form.hours) || 0) * 60 + Math.max(0, Number(form.minutes) || 0),
        startedAt: form.startedAt || null,
        finishedAt: form.finishedAt || null,
        notes: form.notes.trim() || null
      })
      await queryClient.invalidateQueries()
      toast({ title: t('playthroughs.saved'), tone: 'success' })
      onSaved?.()
      onOpenChange(false)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function remove(): Promise<void> {
    if (!playthrough) return
    setBusy(true)
    try {
      await call('playthroughs.delete', { id: playthrough.id })
      await queryClient.invalidateQueries()
      toast({ title: t('playthroughs.deleted'), tone: 'info' })
      onSaved?.()
      onOpenChange(false)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size={480} closeLabel={t('action.close')}>
        <DialogHeader>
          <DialogTitle>
            {playthrough
              ? t('playthroughs.form.editTitle', { number: playthrough.number })
              : t('playthroughs.form.newTitle')}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <Field label={t('playthroughs.form.title')} hint={t('playthroughs.form.titleHint')}>
            <Input
              value={form.title}
              maxLength={120}
              placeholder={t('playthroughs.form.titlePlaceholder')}
              onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
            />
          </Field>

          <Field label={t('playthroughs.form.status')}>
            <Segmented<PlaythroughStatus>
              value={form.status}
              onChange={(status) => setForm((prev) => ({ ...prev, status }))}
              options={PLAYTHROUGH_STATUSES.map((status) => ({
                value: status,
                label: t(`playthroughs.status.${status}`)
              }))}
            />
          </Field>

          <Field label={t('playthroughs.form.platform')}>
            <Combobox
              items={(platforms ?? []).map((platform) => ({
                value: platform.id,
                label: platform.name
              }))}
              value={form.platformId}
              onChange={single<string>((platformId) =>
                setForm((prev) => ({ ...prev, platformId }))
              )}
              placeholder={t('game.panel.platform.placeholder')}
              emptyText={t('common.none')}
            />
          </Field>

          <Field label={t('playthroughs.form.rating')}>
            <RatingStars
              value={form.rating}
              onChange={(rating) => setForm((prev) => ({ ...prev, rating }))}
              ariaLabel={t('playthroughs.form.rating')}
            />
          </Field>

          <div className="flex items-center gap-5">
            <Checkbox
              checked={form.isReplay}
              onChange={(isReplay) => setForm((prev) => ({ ...prev, isReplay }))}
              label={t('playthroughs.form.replay')}
            />
            <Checkbox
              checked={form.isMastered}
              onChange={(isMastered) => setForm((prev) => ({ ...prev, isMastered }))}
              label={t('game.panel.mastered')}
            />
          </div>

          <Field
            label={t('playthroughs.form.time')}
            {...(fromSessions ? { hint: t('playthroughs.form.timeFromSessions') } : {})}
          >
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                disabled={fromSessions}
                value={form.hours}
                onChange={(event) => setForm((prev) => ({ ...prev, hours: event.target.value }))}
                kbd={[t('game.panel.time.hours')]}
                className="w-full"
              />
              <Input
                type="number"
                min={0}
                max={59}
                disabled={fromSessions}
                value={form.minutes}
                onChange={(event) => setForm((prev) => ({ ...prev, minutes: event.target.value }))}
                kbd={[t('game.panel.time.minutes')]}
                className="w-full"
              />
            </div>
          </Field>

          <div className="flex gap-3">
            <Field label={t('game.panel.startedAt')} className="flex-1">
              <input
                type="date"
                value={form.startedAt}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, startedAt: event.target.value }))
                }
                className={DATE_INPUT_CLASS}
              />
            </Field>
            <Field label={t('game.panel.finishedAt')} className="flex-1">
              <input
                type="date"
                value={form.finishedAt}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, finishedAt: event.target.value }))
                }
                className={DATE_INPUT_CLASS}
              />
            </Field>
          </div>

          <Field label={t('playthroughs.form.notes')}>
            <Textarea
              value={form.notes}
              maxLength={4000}
              onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
            />
          </Field>

          {error && <p className="type-small text-danger">{error}</p>}
        </div>

        <DialogFooter>
          {playthrough && (
            <Button
              variant="danger"
              size="sm"
              loading={busy}
              onClick={() => void remove()}
              className="mr-auto"
            >
              <Trash2 size={14} strokeWidth={1.75} />
              {t('action.delete')}
            </Button>
          )}
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {t('action.cancel')}
          </Button>
          <Button variant="primary" loading={busy} onClick={() => void save()}>
            {t('action.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
