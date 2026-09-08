import type { ReactElement } from 'react'
import { useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { motion } from 'motion/react'
import { ImageIcon, Pencil } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { GameDetail } from '@shared/schema/entities'
import { CoverImage } from '@/components/ui/image'
import { MetacriticBadge } from '@/components/ui/metacritic-badge'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Chip } from '@/components/ui/chip'
import { COUNTRIES } from '@shared/countries'
import { formatPlaytime, formatReleaseDate, imageUrl } from '@/lib/format'
import { transitions } from '@/lib/motion'
import { DEFAULT_VIEW_STATE, encodeViewState } from '@/lib/route-state'
import { useSettings } from '@/stores/settings-store'

interface HeroProps {
  game: GameDetail
}

/** Шапка страницы игры (06 §6.1): фон, обложка, заголовок, связи, чипы, оценки, время. */
export function Hero({ game }: HeroProps): ReactElement {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const settings = useSettings()
  const [lightboxOpen, setLightboxOpen] = useState(false)

  const developers = game.companies.filter((c) => c.role === 'developer' || c.role === 'co_developer')
  const publishers = game.companies.filter((c) => c.role === 'publisher')
  const primaryDeveloper = developers[0]
  const country = primaryDeveloper?.countryCode
    ? COUNTRIES.find((c) => c.code === primaryDeveloper.countryCode)
    : undefined

  const myRating = game.userGame?.rating ?? null
  const showBackdrop = settings.showGameBackdrop
  const backdropSrc = showBackdrop ? imageUrl(game.backdropFile ?? game.coverFile) : null

  function goToLibraryFiltered(patch: Parameters<typeof encodeViewState>[0]['filters']): void {
    const f = encodeViewState({ ...DEFAULT_VIEW_STATE, filters: patch })
    void navigate({ to: '/library', search: { status: 'all', ...(f ? { f } : {}) } })
  }

  const releaseLabel =
    game.releaseStatus === 'tba' || !game.releaseDate
      ? t('game.hero.tba')
      : formatReleaseDate(game.releaseDate, game.releaseDatePrecision)

  return (
    <div className="relative shrink-0">
      <div
        className="relative overflow-hidden rounded-b-[var(--r-xl)]"
        style={{ height: 'clamp(240px, 28vh, 320px)', background: game.dominantColor ?? 'var(--bg-1)' }}
      >
        {backdropSrc && (
          <img
            src={backdropSrc}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            style={{ filter: game.backdropFile ? undefined : 'blur(28px) saturate(1.1)' }}
          />
        )}
        <div
          className="absolute inset-0"
          style={{ background: 'var(--hero-scrim)' }}
        />
      </div>

      <div className="relative flex items-end gap-5 px-6" style={{ marginTop: -64 }}>
        <motion.button
          type="button"
          layoutId={`cover-${game.id}`}
          transition={transitions.page}
          onClick={() => setLightboxOpen(true)}
          className="group relative shrink-0 outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--border-focus)]"
          style={{ width: 180 }}
        >
          <CoverImage
            fileName={game.coverFile}
            title={game.title}
            dominantColor={game.dominantColor}
            ratio="3/4"
            className="shadow-3"
          />
          <span
            className="absolute inset-0 flex items-center justify-center gap-1.5 rounded-md opacity-0 transition-opacity group-hover:opacity-100"
            style={{ background: 'var(--overlay)', transitionDuration: 'var(--d-hover)' }}
            onClick={(event) => {
              event.stopPropagation()
              void navigate({ to: '/catalog/$entity/$id/edit', params: { entity: 'games', id: game.id } })
            }}
          >
            <Pencil size={16} strokeWidth={1.75} className="text-text-1" />
            <span className="type-small font-semibold text-text-1">{t('game.hero.changeCover')}</span>
          </span>
        </motion.button>

        <div className="flex min-w-0 flex-1 items-end justify-between gap-4 pb-1.5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              {game.category !== 'main' && (
                <Badge tone="accent">
                  {game.parent ? (
                    <Link
                      to="/games/$gameId"
                      params={{ gameId: game.parent.id }}
                      className="hover:underline"
                    >
                      {t('game.hero.dlcOf', { title: game.parent.title })}
                    </Link>
                  ) : (
                    t(`category.${game.category}`)
                  )}
                </Badge>
              )}
              {game.releaseStatus === 'early_access' && <Badge tone="warning">{t('releaseStatus.early_access')}</Badge>}
              {game.releaseStatus === 'cancelled' && <Badge tone="danger">{t('releaseStatus.cancelled')}</Badge>}
            </div>
            <h1 className="type-display truncate text-text-1">{game.title}</h1>
            {game.altTitles.length > 0 && (
              <p className="type-small truncate text-text-3">{game.altTitles.join(' · ')}</p>
            )}
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3.5 gap-y-1 type-small text-text-2">
              <span className="tabular">{releaseLabel}</span>
              {developers.length > 0 && (
                <span>
                  {t('game.hero.developer')}{' '}
                  {developers.map((d, i) => (
                    <span key={d.id}>
                      {i > 0 && ', '}
                      <Link to="/companies/$companyId" params={{ companyId: d.id }} className="text-accent hover:underline">
                        {d.name}
                      </Link>
                    </span>
                  ))}
                </span>
              )}
              {publishers.length > 0 && (
                <span>
                  {t('game.hero.publisher')}{' '}
                  {publishers.map((p, i) => (
                    <span key={p.id}>
                      {i > 0 && ', '}
                      <Link to="/companies/$companyId" params={{ companyId: p.id }} className="text-accent hover:underline">
                        {p.name}
                      </Link>
                    </span>
                  ))}
                </span>
              )}
              {game.series && (
                <span>
                  <Link to="/series/$seriesId" params={{ seriesId: game.series.id }} className="text-accent hover:underline">
                    {game.series.name}
                  </Link>{' '}
                  · {t('game.hero.seriesPosition', { position: game.series.position, total: game.series.total })}
                </span>
              )}
              {country && <span>{i18n.language === 'ru' ? country.ru : country.en}</span>}
            </div>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {[...game.genres]
                .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary))
                .map((genre) => (
                  <Chip key={genre.id} onClick={() => goToLibraryFiltered({ genres: { ids: [genre.id], mode: 'any' } })}>
                    {genre.name}
                  </Chip>
                ))}
              {game.modes.map((mode) => (
                <Chip key={mode.id} onClick={() => goToLibraryFiltered({ modes: [mode.id] })}>
                  {mode.name}
                </Chip>
              ))}
              {game.platforms.map((platform) => (
                <Chip
                  key={platform.id}
                  onClick={() => goToLibraryFiltered({ platforms: [platform.id] })}
                >
                  {platform.shortName}
                </Chip>
              ))}
            </div>
          </div>

          <div className="flex shrink-0 items-end gap-2.5">
            {game.metacriticScore != null && (
              <ScoreTile label={t('game.hero.metacritic')}>
                <MetacriticBadge score={game.metacriticScore} url={game.metacriticUrl ?? undefined} />
              </ScoreTile>
            )}
            {game.opencriticScore != null && (
              <ScoreTile label={t('game.hero.opencritic')}>
                <span className="type-h2 tabular text-text-1">{game.opencriticScore}</span>
              </ScoreTile>
            )}
            {myRating != null && (
              <ScoreTile label={t('game.hero.myRating')}>
                <span className="type-h2 tabular text-success">{myRating}</span>
              </ScoreTile>
            )}
          </div>
        </div>
      </div>

      {(game.hltbMainMin || game.hltbExtraMin || game.hltbCompleteMin || game.userGame) && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-6 pt-3 type-small text-text-2">
          {game.hltbMainMin != null && <span>{t('game.hero.playtime.main', { hours: formatPlaytime(game.hltbMainMin) })}</span>}
          {game.hltbExtraMin != null && <span>{t('game.hero.playtime.extra', { hours: formatPlaytime(game.hltbExtraMin) })}</span>}
          {game.hltbCompleteMin != null && (
            <span>{t('game.hero.playtime.complete', { hours: formatPlaytime(game.hltbCompleteMin) })}</span>
          )}
          {game.userGame && game.userGame.playtimeMinutes > 0 && (
            <span className="tabular text-text-1">
              {t('game.hero.playtime.mine', { hours: formatPlaytime(game.userGame.playtimeMinutes) })}
            </span>
          )}
        </div>
      )}

      <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
        <DialogContent size={480} closeLabel={t('action.close')}>
          {game.coverFile ? (
            <img src={imageUrl(game.coverFile) ?? undefined} alt={game.title} className="w-full rounded-[var(--r-md)]" />
          ) : (
            <div className="flex h-64 items-center justify-center text-text-3">
              <ImageIcon size={32} strokeWidth={1.5} />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

/**
 * Плитка оценки. Ширина — по подписи: при фиксированных 64 px «METACRITIC»
 * и «Моя оценка» вылезали за плитку и наезжали друг на друга.
 */
function ScoreTile({ label, children }: { label: string; children: ReactElement }): ReactElement {
  return (
    <div
      className="flex min-w-16 flex-col items-center gap-1 rounded-[var(--r-md)] border border-border-1 px-2.5 py-1.5"
      style={{ background: 'var(--surface-1)' }}
    >
      {children}
      <span className="type-caption whitespace-nowrap text-text-3">{label}</span>
    </div>
  )
}
