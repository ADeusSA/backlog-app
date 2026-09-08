import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ExternalLink, Gamepad2, Pencil } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { GameCardDto } from '@shared/schema/entities'
import { GAME_STATUSES, STATUS_META, type GameStatus } from '@shared/constants'
import { Button } from '@/components/ui/button'
import { Chip } from '@/components/ui/chip'
import { CollapsibleSection } from '@/components/ui/collapsible-section'
import { CoverImage } from '@/components/ui/image'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusDot } from '@/components/ui/status-badge'
import { StatusPicker } from '@/components/ui/status-picker'
import { toast } from '@/components/ui/toast'
import { call } from '@/platform/api'
import { formatDate, formatPlaytime, formatRelative } from '@/lib/format'
import { comboFromEvent, isTypingTarget, resolveCombos } from '@/lib/hotkeys'
import { useSettings } from '@/stores/settings-store'
import { PlaythroughsSection } from '@/features/sessions/playthroughs-section'
import { SessionsSection } from '@/features/sessions/sessions-section'
import { Hero } from './hero'
import { UserPanel } from './user-panel'
import { useGameBloom } from './use-game-bloom'
import { formatActivityText } from './activity-text'

/** Человеческие имена провайдеров для подвала (08 §6); ключи — значения `external_ids.provider`. */
const PROVIDER_NAMES: Record<string, string> = { steam: 'Steam', rawg: 'RAWG.io', igdb: 'IGDB' }

/** Страница игры (ТЗ 06 §6). */
export function GameScreen(): React.ReactElement {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { gameId } = useParams({ strict: false }) as { gameId?: string }
  const ratingRef = useRef<HTMLDivElement>(null)
  const hoursInputRef = useRef<HTMLInputElement>(null)
  const [adding, setAdding] = useState(false)
  const settings = useSettings()
  const combos = useMemo(() => resolveCombos(settings.hotkeys), [settings.hotkeys])

  const { data: game, isPending } = useQuery({
    queryKey: ['game', gameId],
    queryFn: () => call('games.getDetail', { id: gameId! }),
    enabled: Boolean(gameId)
  })

  useGameBloom(game?.dominantColor ?? null, settings.animations, settings.theme)

  useEffect(() => {
    if (game?.title) document.title = game.title
    return () => {
      document.title = 'Backlog'
    }
  }, [game?.title])

  useEffect(() => {
    if (gameId) void call('search.pushRecent', { entityType: 'game', id: gameId }).catch(() => undefined)
  }, [gameId])

  // Горячие клавиши страницы игры (05 §5): S, R, T, L, F, E.
  useEffect(() => {
    if (!game) return
    const onKeyDown = (event: KeyboardEvent): void => {
      if (isTypingTarget(event.target)) return
      const combo = comboFromEvent(event)
      if (combo === combos['game.edit']) {
        event.preventDefault()
        void navigate({ to: '/catalog/$entity/$id/edit', params: { entity: 'games', id: game.id } })
      }
      if (combo === combos['game.rate']) {
        event.preventDefault()
        ratingRef.current?.focus()
      }
      if (combo === combos['game.time']) {
        event.preventDefault()
        hoursInputRef.current?.focus()
      }
      if (combo === combos['game.favorite'] && game.userGame) {
        event.preventDefault()
        void call('userGame.patch', {
          gameId: game.id,
          patch: { isFavorite: !game.userGame.isFavorite }
        }).then(() => queryClient.invalidateQueries({ queryKey: ['game', game.id] }))
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [game, navigate, queryClient, combos])

  if (isPending) {
    return (
      <div className="flex flex-col gap-4 p-6">
        <Skeleton className="h-[280px] w-full" />
        <Skeleton className="h-6 w-1/3" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    )
  }

  if (!game) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <EmptyState icon={<Gamepad2 size={24} strokeWidth={1.75} />} title={t('error.not_found')} />
      </div>
    )
  }

  const addToLibrary = (status: GameStatus): void => {
    setAdding(true)
    void call('userGame.addToLibrary', { gameIds: [game.id], status })
      .then(() => queryClient.invalidateQueries({ queryKey: ['game', game.id] }))
      .catch((err: Error) => toast({ title: err.message, tone: 'danger' }))
      .finally(() => setAdding(false))
  }

  return (
    <div className="flex flex-col">
      <Hero game={game} />

      <div className="flex flex-col gap-8 px-6 pb-10 pt-6 lg:flex-row">
        <div className="flex min-w-0 flex-1 flex-col gap-8">
          {game.summary && (
            <section className="flex flex-col gap-2">
              <h2 className="type-caption">{t('game.summary')}</h2>
              <p className="type-body-lg" style={{ color: 'var(--text-2)' }}>
                {game.summary}
              </p>
            </section>
          )}

          {game.storyline && (
            <CollapsibleSection title={t('game.storyline')} storageKey="game.storyline">
              <p className="type-body-lg" style={{ color: 'var(--text-2)' }}>
                {game.storyline}
              </p>
            </CollapsibleSection>
          )}

          {game.series && (
            <section className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <h2 className="type-caption">
                  {t('game.inSeries', { name: game.series.name, position: game.series.position, total: game.series.total })}
                </h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void navigate({ to: '/series/$seriesId', params: { seriesId: game.series!.id } })}
                >
                  {t('game.openSeries')}
                </Button>
              </div>
              <GameStrip
                games={game.series.games}
                currentId={game.id}
                onOpen={(id) =>
                  void navigate({
                    to: '/games/$gameId',
                    params: { gameId: id },
                    search: { from: 'series', fromId: game.series!.id, fromTitle: game.series!.name }
                  })
                }
              />
            </section>
          )}

          {game.dlc.length > 0 && (
            <section className="flex flex-col gap-3">
              <h2 className="type-caption">
                {t('game.dlc')} · {t('game.dlcDone', {
                  done: game.dlc.filter((d) => d.status === 'completed').length,
                  total: game.dlc.length
                })}
              </h2>
              <ul className="flex flex-col gap-1">
                {game.dlc.map((dlc) => (
                  <li key={dlc.id}>
                    <button
                      type="button"
                      className="flex w-full items-center gap-3 rounded-[var(--r-sm)] px-2 py-1.5 text-left hover:bg-[var(--surface-1)]"
                      onClick={() => void navigate({ to: '/games/$gameId', params: { gameId: dlc.id } })}
                    >
                      <CoverImage fileName={dlc.coverFile} title={dlc.title} dominantColor={dlc.dominantColor} size={36} />
                      <span className="min-w-0 flex-1 truncate type-body">{dlc.title}</span>
                      <span className="type-small tabular" style={{ color: 'var(--text-3)' }}>
                        {dlc.releaseYear ?? ''}
                      </span>
                      {dlc.status ? (
                        <span className="flex items-center gap-1.5 type-small" style={{ color: 'var(--text-2)' }}>
                          <StatusDot status={dlc.status} />
                          {t(`status.${dlc.status}`)}
                        </span>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(event) => {
                            event.stopPropagation()
                            void call('userGame.addToLibrary', { gameIds: [dlc.id], status: 'backlog' }).then(() =>
                              queryClient.invalidateQueries()
                            )
                          }}
                        >
                          {t('action.addToBacklog')}
                        </Button>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {game.editions.length > 0 && (
            <section className="flex flex-col gap-2">
              <h2 className="type-caption">{t('game.editions')}</h2>
              <div className="flex flex-wrap gap-1.5">
                {game.editions.map((edition) => (
                  <Chip
                    key={edition.id}
                    onClick={() => void navigate({ to: '/games/$gameId', params: { gameId: edition.id } })}
                  >
                    {edition.title}
                  </Chip>
                ))}
              </div>
            </section>
          )}

          {game.sameDeveloper.length > 0 && (
            <section className="flex flex-col gap-3">
              <h2 className="type-caption">{t('game.sameDeveloper')}</h2>
              <GameStrip
                games={game.sameDeveloper}
                onOpen={(id) => void navigate({ to: '/games/$gameId', params: { gameId: id } })}
              />
            </section>
          )}

          {/* Прохождения и журнал сессий — только для игр из библиотеки (10 §1, итерация 2). */}
          {game.userGame && (
            <>
              <PlaythroughsSection gameId={game.id} />
              <SessionsSection gameId={game.id} />
            </>
          )}

          {game.activity.length > 0 && (
            <CollapsibleSection title={t('game.history')} defaultOpen={false} storageKey="game.history">
              <ul className="flex flex-col gap-1.5">
                {game.activity.map((entry) => (
                  <li key={entry.id} className="flex items-center gap-2 type-small">
                    <span style={{ color: 'var(--text-3)' }}>{formatRelative(entry.happenedAt)}</span>
                    <span style={{ color: 'var(--text-2)' }}>
                      {formatActivityText(t, entry.type, entry.payload)}
                    </span>
                  </li>
                ))}
              </ul>
            </CollapsibleSection>
          )}

          <footer className="flex flex-wrap items-center gap-3 type-small" style={{ color: 'var(--text-3)' }}>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void navigate({ to: '/catalog/$entity/$id/edit', params: { entity: 'games', id: game.id } })}
            >
              <Pencil size={14} strokeWidth={1.75} />
              {t('game.editInCatalog')}
            </Button>
            {game.website && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void call('app.openExternal', { url: game.website! })}
              >
                <ExternalLink size={14} strokeWidth={1.75} />
                {t('game.website')}
              </Button>
            )}
            <span>{t('game.updatedAt', { date: formatDate(game.updatedAt) })}</span>
            {/*
              Происхождение данных карточки (08 §6): либо перечень источников, либо «вручную».
              Каждый источник — ссылка на его страницу игры: RAWG на бесплатном тарифе требует
              именно видимую ссылку, а не просто упоминание.
            */}
            {game.sources.length > 0 ? (
              <span>
                {t('game.sources')}:{' '}
                {game.sources.map((source, index) => (
                  <span key={source.provider}>
                    {index > 0 && ', '}
                    {source.url ? (
                      <button
                        type="button"
                        className="underline underline-offset-2 hover:text-text-2"
                        onClick={() => void call('app.openExternal', { url: source.url! })}
                      >
                        {PROVIDER_NAMES[source.provider] ?? source.provider}
                      </button>
                    ) : (
                      (PROVIDER_NAMES[source.provider] ?? source.provider)
                    )}
                    {source.syncedAt ? ` (${formatDate(source.syncedAt)})` : ''}
                  </span>
                ))}
              </span>
            ) : (
              <span>{t('game.source')}</span>
            )}
          </footer>
        </div>

        <aside className="w-full shrink-0 lg:w-[360px]">
          {game.userGame ? (
            <UserPanel game={game} ratingRef={ratingRef} hoursInputRef={hoursInputRef} />
          ) : (
            <div
              className="flex flex-col gap-3 rounded-[var(--r-lg)] p-4"
              style={{ background: 'var(--surface-1)', border: '1px solid var(--border-1)' }}
            >
              <p className="type-h3">{t('game.notInLibrary')}</p>
              <Button variant="primary" loading={adding} onClick={() => addToLibrary('backlog')}>
                {t('action.addToLibrary')}
              </Button>
              <StatusPicker
                value={null}
                onChange={addToLibrary}
                placeholder={t('game.pickStatus')}
                labels={
                  Object.fromEntries(
                    GAME_STATUSES.map((status) => [
                      status,
                      { title: t(`status.${status}`), description: t(`status.${status}.desc`) }
                    ])
                  ) as Record<GameStatus, { title: string; description: string }>
                }
              />
              <p className="type-small" style={{ color: 'var(--text-3)' }}>
                {t(STATUS_META.backlog.i18nKey)} — {t('status.backlog.desc')}
              </p>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}

/** Горизонтальная лента обложек (серия, «от того же разработчика») — 06 §6.3. */
function GameStrip({
  games,
  currentId,
  onOpen
}: {
  games: GameCardDto[]
  currentId?: string
  onOpen: (id: string) => void
}): React.ReactElement {
  return (
    <ul className="flex gap-3 overflow-x-auto pb-2">
      {games.map((game) => (
        <li key={game.id} className="shrink-0">
          <button
            type="button"
            className="flex w-[112px] flex-col gap-1.5 text-left"
            onClick={() => onOpen(game.id)}
            style={{
              outline: game.id === currentId ? '2px solid var(--accent)' : undefined,
              outlineOffset: 3,
              borderRadius: 'var(--r-md)'
            }}
          >
            <span className="relative block">
              <CoverImage
                fileName={game.coverFile}
                title={game.title}
                dominantColor={game.dominantColor}
                size={112}
              />
              {game.position != null && (
                <span
                  className="absolute bottom-1 left-1 rounded-[var(--r-xs)] px-1.5 type-caption"
                  style={{ background: 'var(--surface-glass)', color: 'var(--text-1)' }}
                >
                  {game.position}
                </span>
              )}
            </span>
            <span className="truncate type-small">{game.title}</span>
            <span className="flex items-center gap-1.5 type-small" style={{ color: 'var(--text-3)' }}>
              {game.status && <StatusDot status={game.status} size="sm" />}
              {game.releaseYear ?? ''}
              {game.playtimeMinutes ? ` · ${formatPlaytime(game.playtimeMinutes, true)}` : ''}
            </span>
          </button>
        </li>
      ))}
    </ul>
  )
}
