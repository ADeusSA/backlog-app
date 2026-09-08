import type { ReactElement } from 'react'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Pencil, Plus, Repeat2, Trophy } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { PlaythroughDto } from '@shared/schema/sessions'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { RatingStars } from '@/components/ui/rating-stars'
import { call } from '@/platform/api'
import { formatDate, formatPlaytime } from '@/lib/format'
import { PlaythroughDialog } from './playthrough-dialog'

const STATUS_TONE: Record<PlaythroughDto['status'], 'accent' | 'success' | 'danger'> = {
  in_progress: 'accent',
  completed: 'success',
  dropped: 'danger'
}

/** Секция «Прохождения» страницы игры (02 §3.9, 06 §6.3). */
export function PlaythroughsSection({ gameId }: { gameId: string }): ReactElement {
  const { t } = useTranslation()
  const [editing, setEditing] = useState<PlaythroughDto | null>(null)
  const [open, setOpen] = useState(false)

  const { data: playthroughs } = useQuery({
    queryKey: ['playthroughs', gameId],
    queryFn: () => call('playthroughs.list', { gameId })
  })

  function edit(playthrough: PlaythroughDto | null): void {
    setEditing(playthrough)
    setOpen(true)
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <h2 className="type-caption flex-1">
          {t('playthroughs.title')}
          {(playthroughs?.length ?? 0) > 0 ? ` · ${playthroughs!.length}` : ''}
        </h2>
        <Button variant="ghost" size="sm" onClick={() => edit(null)}>
          <Plus size={14} strokeWidth={1.75} />
          {t('playthroughs.add')}
        </Button>
      </div>

      {(playthroughs?.length ?? 0) === 0 ? (
        <p className="type-small" style={{ color: 'var(--text-3)' }}>
          {t('playthroughs.empty')}
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {playthroughs?.map((playthrough) => (
            <li key={playthrough.id}>
              <button
                type="button"
                className="group flex w-full items-center gap-3 rounded-[var(--r-sm)] px-2 py-2 text-left hover:bg-[var(--surface-1)]"
                onClick={() => edit(playthrough)}
              >
                <span
                  className="w-7 shrink-0 text-center type-small tabular"
                  style={{ color: 'var(--text-3)' }}
                >
                  #{playthrough.number}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate type-body">
                      {playthrough.title ??
                        t('playthroughs.number', { number: playthrough.number })}
                    </span>
                    {playthrough.isReplay && (
                      <Repeat2 size={13} strokeWidth={1.75} style={{ color: 'var(--text-3)' }} />
                    )}
                    {playthrough.isMastered && (
                      <Trophy size={13} strokeWidth={1.75} style={{ color: 'var(--success)' }} />
                    )}
                  </span>
                  <span
                    className="flex flex-wrap items-center gap-2 type-small"
                    style={{ color: 'var(--text-3)' }}
                  >
                    {playthrough.platformName && <span>{playthrough.platformName}</span>}
                    {(playthrough.startedAt || playthrough.finishedAt) && (
                      <span className="tabular">
                        {playthrough.startedAt ? formatDate(playthrough.startedAt) : '…'} —{' '}
                        {playthrough.finishedAt ? formatDate(playthrough.finishedAt) : '…'}
                      </span>
                    )}
                    {playthrough.sessionCount > 0 && (
                      <span>{t('playthroughs.sessions', { count: playthrough.sessionCount })}</span>
                    )}
                  </span>
                </span>
                {playthrough.rating != null && (
                  <RatingStars
                    value={playthrough.rating}
                    readOnly
                    ariaLabel={t('playthroughs.form.rating')}
                  />
                )}
                <span
                  className="w-[64px] shrink-0 text-right type-small tabular"
                  style={{ color: 'var(--text-2)' }}
                >
                  {formatPlaytime(playthrough.playtimeMinutes, true)}
                </span>
                <Badge tone={STATUS_TONE[playthrough.status]}>
                  {t(`playthroughs.status.${playthrough.status}`)}
                </Badge>
                <Pencil
                  size={14}
                  strokeWidth={1.75}
                  className="opacity-0 group-hover:opacity-100"
                  style={{ color: 'var(--text-3)' }}
                />
              </button>
              {playthrough.notes && (
                <p className="px-2 pl-12 type-small" style={{ color: 'var(--text-2)' }}>
                  {playthrough.notes}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      <PlaythroughDialog open={open} onOpenChange={setOpen} gameId={gameId} playthrough={editing} />
    </section>
  )
}
