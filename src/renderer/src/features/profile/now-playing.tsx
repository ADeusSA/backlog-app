import type { KeyboardEvent, ReactElement } from 'react'
import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Clock3, Dices, NotebookPen, Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { GameCardDto } from '@shared/schema/entities'
import { Button } from '@/components/ui/button'
import { CoverImage } from '@/components/ui/image'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { toast } from '@/components/ui/toast'
import { call } from '@/platform/api'
import { formatPlaytime, formatRelative } from '@/lib/format'
import { SessionDialog } from '@/features/sessions/session-dialog'

type NowPlayingGame = GameCardDto & { resumeNote: string | null }

const QUICK_MINUTES: Array<{ minutes: number; key: string }> = [
  { minutes: 15, key: 'collection.quickTime.plus15' },
  { minutes: 60, key: 'collection.quickTime.plus1h' },
  { minutes: 120, key: 'collection.quickTime.plus2h' }
]

/**
 * Виджет «Сейчас играю» (06 §1.3).
 *
 * Карточка целиком ведёт на страницу игры, поэтому вместо вложенных кнопок —
 * div с ролью ссылки: `<button>` внутри `<button>` невалиден, а Radix-поповер
 * внутри такого вложения ломает фокус.
 */
export function NowPlaying(): ReactElement {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [sessionFor, setSessionFor] = useState<NowPlayingGame | null>(null)

  const { data: games } = useQuery({
    queryKey: ['profile', 'nowPlaying'],
    queryFn: () => call('profile.nowPlaying')
  })

  // Прохождения нужны только открытому диалогу сессии (02 §3.9).
  const { data: playthroughs } = useQuery({
    queryKey: ['playthroughs', sessionFor?.id],
    queryFn: () => call('playthroughs.list', { gameId: sessionFor!.id }),
    enabled: Boolean(sessionFor)
  })

  const open = (id: string): void => {
    void navigate({ to: '/games/$gameId', params: { gameId: id } })
  }

  const pickRandom = (): void => {
    void call('collection.random', { scope: { kind: 'library', status: 'backlog' }, filters: {} })
      .then((game) => {
        if (game) open(game.id)
        else toast({ title: t('collection.randomEmpty') })
      })
      .catch((err: Error) => toast({ title: err.message, tone: 'danger' }))
  }

  const addTime = (game: NowPlayingGame, minutes: number): void => {
    void call('userGame.addPlaytime', { gameId: game.id, minutes })
      .then(() => {
        toast({ title: t('profile.nowPlaying.timeAdded', { time: formatPlaytime(minutes, true) }) })
        void queryClient.invalidateQueries()
      })
      .catch((err: Error) => toast({ title: err.message, tone: 'danger' }))
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="type-caption">{t('profile.nowPlaying.title')}</h2>

      {(games?.length ?? 0) === 0 ? (
        <div className="flex items-center gap-3">
          <p className="type-body" style={{ color: 'var(--text-2)' }}>
            {t('profile.nowPlaying.empty')}
          </p>
          <Button variant="secondary" size="sm" onClick={pickRandom}>
            <Dices size={14} strokeWidth={1.75} />
            {t('profile.nowPlaying.pick')}
          </Button>
        </div>
      ) : (
        <ul className="flex gap-3 overflow-x-auto px-0.5 pb-2 pt-1">
          {games?.map((game) => (
            <li key={game.id} className="shrink-0">
              <NowPlayingCard
                game={game}
                onOpen={() => open(game.id)}
                onAddTime={(minutes) => addTime(game, minutes)}
                onAddSession={() => setSessionFor(game)}
              />
            </li>
          ))}
        </ul>
      )}

      {sessionFor && (
        <SessionDialog
          open
          onOpenChange={(next) => !next && setSessionFor(null)}
          gameId={sessionFor.id}
          playthroughs={playthroughs ?? []}
          onSaved={() => {
            setSessionFor(null)
            void queryClient.invalidateQueries()
          }}
        />
      )}
    </section>
  )
}

function NowPlayingCard({
  game,
  onOpen,
  onAddTime,
  onAddSession
}: {
  game: NowPlayingGame
  onOpen: () => void
  onAddTime: (minutes: number) => void
  onAddSession: () => void
}): ReactElement {
  const { t } = useTranslation()
  const [timeOpen, setTimeOpen] = useState(false)

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    onOpen()
  }

  return (
    <div
      role="link"
      tabIndex={0}
      aria-label={game.title}
      onClick={onOpen}
      onKeyDown={onKeyDown}
      className="group flex w-[312px] cursor-pointer gap-3 rounded-[var(--r-md)] border border-border-1 bg-[var(--surface-1)] p-3 outline-none transition-[background,border-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-border-2 hover:bg-[var(--surface-2)] hover:shadow-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)]"
      style={{ transitionDuration: 'var(--d-hover)' }}
    >
      <CoverImage
        fileName={game.coverFile}
        title={game.title}
        dominantColor={game.dominantColor}
        size={72}
        // self-start — иначе флекс растянет обложку на высоту карточки и сломает 3:4.
        className="shrink-0 self-start transition-[filter] group-hover:brightness-[1.06]"
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate type-h3" title={game.title}>
          {game.title}
        </span>
        <span className="tabular type-small" style={{ color: 'var(--text-2)' }}>
          {formatPlaytime(game.playtimeMinutes ?? 0)}
          {game.lastActivityAt
            ? ` · ${t('profile.nowPlaying.lastActivity', { time: formatRelative(game.lastActivityAt) })}`
            : ''}
        </span>

        {game.resumeNote && (
          <span
            className="mt-1 line-clamp-2 rounded-[var(--r-xs)] px-1.5 py-1 type-small"
            style={{ background: 'var(--surface-2)', color: 'var(--text-2)' }}
            title={game.resumeNote}
          >
            {game.resumeNote}
          </span>
        )}

        {/* Кнопки — единственное, что не открывает игру, поэтому клик по ним не всплывает. */}
        <div className="flex gap-1.5 pt-2" onClick={(event) => event.stopPropagation()}>
          <Popover open={timeOpen} onOpenChange={setTimeOpen}>
            <PopoverTrigger asChild>
              <Button variant="secondary" size="sm">
                <Clock3 size={14} strokeWidth={1.75} />
                {t('profile.nowPlaying.addTime')}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-[150px] p-1">
              <div className="flex flex-col gap-0.5">
                {QUICK_MINUTES.map((item) => (
                  <button
                    key={item.minutes}
                    type="button"
                    className="rounded-[var(--r-xs)] px-2 py-1.5 text-left type-small hover:bg-[var(--surface-2)]"
                    onClick={() => {
                      setTimeOpen(false)
                      onAddTime(item.minutes)
                    }}
                  >
                    {t(item.key)}
                  </button>
                ))}
                <button
                  type="button"
                  className="flex items-center gap-1.5 rounded-[var(--r-xs)] px-2 py-1.5 text-left type-small hover:bg-[var(--surface-2)]"
                  onClick={() => {
                    setTimeOpen(false)
                    onAddSession()
                  }}
                >
                  <Plus size={12} strokeWidth={1.75} />
                  {t('profile.nowPlaying.exactTime')}
                </button>
              </div>
            </PopoverContent>
          </Popover>

          <Button variant="secondary" size="sm" onClick={onAddSession}>
            <NotebookPen size={14} strokeWidth={1.75} />
            {t('profile.nowPlaying.addSession')}
          </Button>
        </div>
      </div>
    </div>
  )
}
