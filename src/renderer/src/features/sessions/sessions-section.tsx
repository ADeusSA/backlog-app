import type { ReactElement } from 'react'
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Pencil, Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { PlaySessionDto } from '@shared/schema/sessions'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { call } from '@/platform/api'
import { formatDate, formatPlaytime } from '@/lib/format'
import { ActivityPanel } from './activity-panel'
import { SessionDialog } from './session-dialog'

const PAGE = 20

/** Группировка журнала по месяцам — так его проще просматривать (06 §6.3). */
function groupByMonth(
  sessions: PlaySessionDto[],
  locale: string
): Array<{ key: string; label: string; items: PlaySessionDto[] }> {
  const format = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' })
  const groups = new Map<string, PlaySessionDto[]>()
  for (const session of sessions) {
    const key = session.playedOn.slice(0, 7)
    const bucket = groups.get(key)
    if (bucket) bucket.push(session)
    else groups.set(key, [session])
  }
  return [...groups.entries()].map(([key, items]) => ({
    key,
    label: format.format(new Date(`${key}-01T00:00:00Z`)),
    items
  }))
}

/** Секция «Журнал сессий» страницы игры (10 §1, итерация 2). */
export function SessionsSection({ gameId }: { gameId: string }): ReactElement {
  const { t, i18n } = useTranslation()
  const [limit, setLimit] = useState(PAGE)
  const [editing, setEditing] = useState<PlaySessionDto | null>(null)
  const [open, setOpen] = useState(false)

  const { data: sessions } = useQuery({
    queryKey: ['sessions', 'list', gameId, limit],
    queryFn: () => call('sessions.list', { gameId, limit: limit + 1, offset: 0 })
  })
  const { data: playthroughs } = useQuery({
    queryKey: ['playthroughs', gameId],
    queryFn: () => call('playthroughs.list', { gameId })
  })

  const hasMore = (sessions?.length ?? 0) > limit
  const visible = useMemo(() => (sessions ?? []).slice(0, limit), [sessions, limit])
  const groups = useMemo(() => groupByMonth(visible, i18n.language), [visible, i18n.language])

  function edit(session: PlaySessionDto | null): void {
    setEditing(session)
    setOpen(true)
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <h2 className="type-caption flex-1">{t('sessions.title')}</h2>
        <Button variant="ghost" size="sm" onClick={() => edit(null)}>
          <Plus size={14} strokeWidth={1.75} />
          {t('sessions.add')}
        </Button>
      </div>

      {visible.length === 0 ? (
        <p className="type-small" style={{ color: 'var(--text-3)' }}>
          {t('sessions.empty')}
        </p>
      ) : (
        <>
          <ActivityPanel gameId={gameId} />

          <ul className="flex flex-col gap-2">
            {groups.map((group) => (
              <li key={group.key} className="flex flex-col gap-0.5">
                <span className="type-caption first-letter:uppercase">{group.label}</span>
                <ul className="flex flex-col">
                  {group.items.map((session) => (
                    <li key={session.id}>
                      <button
                        type="button"
                        className="group flex w-full items-center gap-3 rounded-[var(--r-sm)] px-2 py-1.5 text-left hover:bg-[var(--surface-1)]"
                        onClick={() => edit(session)}
                      >
                        <span
                          className="w-[112px] shrink-0 type-small tabular"
                          style={{ color: 'var(--text-3)' }}
                        >
                          {formatDate(session.playedOn)}
                        </span>
                        <span className="w-[76px] shrink-0 type-small tabular">
                          {formatPlaytime(session.minutes)}
                        </span>
                        {session.startedAtTime && (
                          <span className="type-small tabular" style={{ color: 'var(--text-3)' }}>
                            {session.startedAtTime}
                          </span>
                        )}
                        {session.playthroughTitle && <Badge>{session.playthroughTitle}</Badge>}
                        <span
                          className="min-w-0 flex-1 truncate type-small"
                          style={{ color: 'var(--text-2)' }}
                        >
                          {session.note}
                        </span>
                        <Pencil
                          size={13}
                          strokeWidth={1.75}
                          className="shrink-0 opacity-0 group-hover:opacity-100"
                          style={{ color: 'var(--text-3)' }}
                        />
                      </button>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>

          {hasMore && (
            <Button
              variant="ghost"
              size="sm"
              className="self-start"
              onClick={() => setLimit((v) => v + PAGE)}
            >
              {t('sessions.more')}
            </Button>
          )}
        </>
      )}

      <SessionDialog
        open={open}
        onOpenChange={setOpen}
        gameId={gameId}
        playthroughs={playthroughs ?? []}
        session={editing}
      />
    </section>
  )
}
