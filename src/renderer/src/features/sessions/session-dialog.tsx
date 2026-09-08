import type { ReactElement } from 'react'
import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { PlaySessionDto, PlaythroughDto } from '@shared/schema/sessions'
import { SESSION_MAX_MINUTES } from '@shared/schema/sessions'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Input, Textarea } from '@/components/ui/input'
import { Select, SelectItem } from '@/components/ui/select'
import { toast } from '@/components/ui/toast'
import { call } from '@/platform/api'
import { DATE_INPUT_CLASS, Field, todayLocal } from './fields'

export interface SessionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  gameId: string
  /** Прохождения игры — сессию можно привязать к конкретному (02 §3.9). */
  playthroughs: PlaythroughDto[]
  /** Сессия для правки; отсутствует — диалог записи новой. */
  session?: PlaySessionDto | null
  onSaved?: () => void
}

interface FormState {
  playedOn: string
  startedAtTime: string
  hours: string
  minutes: string
  playthroughId: string
  note: string
}

const NO_PLAYTHROUGH = 'none'

function initialState(session: PlaySessionDto | null | undefined): FormState {
  if (!session) {
    return {
      playedOn: todayLocal(),
      startedAtTime: '',
      hours: '1',
      minutes: '0',
      playthroughId: NO_PLAYTHROUGH,
      note: ''
    }
  }
  return {
    playedOn: session.playedOn,
    startedAtTime: session.startedAtTime ?? '',
    hours: String(Math.floor(session.minutes / 60)),
    minutes: String(session.minutes % 60),
    playthroughId: session.playthroughId ?? NO_PLAYTHROUGH,
    note: session.note ?? ''
  }
}

/** Запись и правка сессии журнала (10 §1, итерация 2). */
export function SessionDialog({
  open,
  onOpenChange,
  gameId,
  playthroughs,
  session,
  onSaved
}: SessionDialogProps): ReactElement {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [form, setForm] = useState<FormState>(() => initialState(session))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Диалог переиспользуется для разных сессий, поэтому состояние сбрасывается на открытии.
  useEffect(() => {
    if (open) {
      setForm(initialState(session))
      setError(null)
    }
  }, [open, session])

  const totalMinutes =
    Math.max(0, Number(form.hours) || 0) * 60 + Math.max(0, Number(form.minutes) || 0)

  function addMinutes(delta: number): void {
    const next = Math.min(SESSION_MAX_MINUTES, totalMinutes + delta)
    setForm((prev) => ({
      ...prev,
      hours: String(Math.floor(next / 60)),
      minutes: String(next % 60)
    }))
  }

  async function save(): Promise<void> {
    if (totalMinutes < 1) {
      setError(t('sessions.form.needMinutes'))
      return
    }
    setBusy(true)
    try {
      await call('sessions.save', {
        ...(session ? { id: session.id } : {}),
        gameId,
        playedOn: form.playedOn,
        startedAtTime: form.startedAtTime || null,
        minutes: Math.min(SESSION_MAX_MINUTES, totalMinutes),
        playthroughId: form.playthroughId === NO_PLAYTHROUGH ? null : form.playthroughId,
        note: form.note.trim() || null
      })
      await queryClient.invalidateQueries()
      toast({ title: t('sessions.saved'), tone: 'success' })
      onSaved?.()
      onOpenChange(false)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function remove(): Promise<void> {
    if (!session) return
    setBusy(true)
    try {
      await call('sessions.delete', { id: session.id })
      await queryClient.invalidateQueries()
      toast({ title: t('sessions.deleted'), tone: 'info' })
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
            {session ? t('sessions.form.editTitle') : t('sessions.form.newTitle')}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div className="flex gap-3">
            <Field label={t('sessions.form.date')} className="flex-1">
              <input
                type="date"
                value={form.playedOn}
                max={todayLocal()}
                onChange={(event) => setForm((prev) => ({ ...prev, playedOn: event.target.value }))}
                className={DATE_INPUT_CLASS}
              />
            </Field>
            <Field
              label={t('sessions.form.startedAt')}
              hint={t('sessions.form.startedAtHint')}
              className="flex-1"
            >
              <input
                type="time"
                value={form.startedAtTime}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, startedAtTime: event.target.value }))
                }
                className={DATE_INPUT_CLASS}
              />
            </Field>
          </div>

          <Field label={t('sessions.form.duration')}>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                max={24}
                value={form.hours}
                onChange={(event) => setForm((prev) => ({ ...prev, hours: event.target.value }))}
                kbd={[t('game.panel.time.hours')]}
                className="w-full"
              />
              <Input
                type="number"
                min={0}
                max={59}
                value={form.minutes}
                onChange={(event) => setForm((prev) => ({ ...prev, minutes: event.target.value }))}
                kbd={[t('game.panel.time.minutes')]}
                className="w-full"
              />
            </div>
          </Field>
          <div className="flex gap-1.5">
            <Button variant="secondary" size="sm" onClick={() => addMinutes(30)}>
              {t('sessions.form.quick30')}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => addMinutes(60)}>
              {t('game.panel.time.quick1h')}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => addMinutes(120)}>
              {t('game.panel.time.quick2h')}
            </Button>
          </div>

          {playthroughs.length > 0 && (
            <Field label={t('sessions.form.playthrough')}>
              <Select<string>
                value={form.playthroughId}
                onChange={(value) => setForm((prev) => ({ ...prev, playthroughId: value }))}
              >
                <SelectItem value={NO_PLAYTHROUGH}>{t('sessions.form.noPlaythrough')}</SelectItem>
                {playthroughs.map((playthrough) => (
                  <SelectItem key={playthrough.id} value={playthrough.id}>
                    {playthrough.title ?? t('playthroughs.number', { number: playthrough.number })}
                  </SelectItem>
                ))}
              </Select>
            </Field>
          )}

          <Field label={t('sessions.form.note')}>
            <Textarea
              value={form.note}
              maxLength={500}
              placeholder={t('sessions.form.notePlaceholder')}
              onChange={(event) => setForm((prev) => ({ ...prev, note: event.target.value }))}
            />
          </Field>

          {error && <p className="type-small text-danger">{error}</p>}
        </div>

        <DialogFooter>
          {session && (
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
