import type { ReactElement, Ref } from 'react'
import { useTranslation } from 'react-i18next'
import { Star } from 'lucide-react'
import type { Recap } from '@shared/schema/recap'
import { CoverImage } from '@/components/ui/image'
import { formatNumber, formatPlaytime } from '@/lib/format'

/** Ширина карточки фиксирована: её же снимает экспорт в PNG, размер не должен зависеть от окна. */
export const RECAP_CARD_WIDTH = 860

function Metric({ value, label }: { value: string; label: string }): ReactElement {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="type-display tabular" style={{ fontSize: 34, lineHeight: 1.1 }}>
        {value}
      </span>
      <span className="type-caption">{label}</span>
    </div>
  )
}

function GameRow({
  title,
  coverFile,
  trailing
}: {
  title: string
  coverFile: string | null
  trailing: string
}): ReactElement {
  return (
    <li className="flex items-center gap-2.5">
      <CoverImage fileName={coverFile} title={title} size={28} />
      <span className="min-w-0 flex-1 truncate type-body">{title}</span>
      <span className="tabular type-small" style={{ color: 'var(--text-2)' }}>
        {trailing}
      </span>
    </li>
  )
}

/**
 * Карточка «Итоги года» (00-TZ §6 п.10) — она же то, что уходит в PNG.
 * Никаких интерактивных элементов: снимок делается с этого DOM-узла как есть.
 */
export function RecapCard({ recap, ref }: { recap: Recap; ref?: Ref<HTMLDivElement> }): ReactElement {
  const { t } = useTranslation()
  const months = t('recap.months', { returnObjects: true }) as string[]

  return (
    <div
      ref={ref}
      className="relative overflow-hidden rounded-[var(--r-lg)] border border-border-1 p-7"
      style={{ width: RECAP_CARD_WIDTH, background: 'var(--bg-1)' }}
    >
      {/* Одно мягкое свечение вместо полноценного bloom: карточка должна одинаково
          выглядеть и на экране, и в PNG, где анимации уже нет. */}
      <div
        aria-hidden
        className="pointer-events-none absolute"
        style={{
          right: -120,
          top: -160,
          width: 420,
          height: 420,
          borderRadius: '50%',
          background: 'radial-gradient(circle, var(--bloom-a), transparent 68%)',
          opacity: 'var(--bloom-opacity)',
          filter: 'blur(var(--bloom-blur))'
        }}
      />

      <div className="relative flex flex-col gap-6">
        <div>
          <p className="type-caption">{t('recap.title')}</p>
          <p className="type-display tabular">{recap.year}</p>
        </div>

        <div className="grid grid-cols-4 gap-4">
          <Metric value={formatNumber(recap.completed)} label={t('recap.completed')} />
          <Metric value={formatPlaytime(recap.minutes, true)} label={t('recap.played')} />
          <Metric value={formatNumber(recap.days)} label={t('recap.days')} />
          <Metric value={formatNumber(recap.bestStreak)} label={t('recap.streak')} />
        </div>

        <div className="grid grid-cols-2 gap-6">
          <section className="flex min-w-0 flex-col gap-2">
            <h3 className="type-caption">{t('recap.topByHours')}</h3>
            {recap.topByHours.length === 0 ? (
              <p className="type-small" style={{ color: 'var(--text-3)' }}>
                {t('recap.nothing')}
              </p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {recap.topByHours.map((game) => (
                  <GameRow
                    key={game.id}
                    title={game.title}
                    coverFile={game.coverFile}
                    trailing={formatPlaytime(game.minutes ?? 0, true)}
                  />
                ))}
              </ul>
            )}
          </section>

          <section className="flex min-w-0 flex-col gap-2">
            <h3 className="type-caption">{t('recap.topRated')}</h3>
            {recap.topRated.length === 0 ? (
              <p className="type-small" style={{ color: 'var(--text-3)' }}>
                {t('recap.nothing')}
              </p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {recap.topRated.map((game) => (
                  <GameRow
                    key={game.id}
                    title={game.title}
                    coverFile={game.coverFile}
                    trailing={`${game.rating ?? 0}/10`}
                  />
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="flex flex-col gap-1.5 border-t border-border-1 pt-4 type-small" style={{ color: 'var(--text-2)' }}>
          <div className="flex flex-wrap gap-x-5 gap-y-1">
            <span>{t('recap.added', { count: recap.added })}</span>
            <span>{t('recap.sessions', { count: recap.sessions })}</span>
            {recap.mastered > 0 && <span>{t('recap.mastered', { count: recap.mastered })}</span>}
            {recap.avgRating !== null && (
              <span className="flex items-center gap-1">
                <Star size={13} strokeWidth={1.75} style={{ color: 'var(--accent)' }} />
                {t('recap.avgRating', {
                  value: recap.avgRating.toFixed(1),
                  count: recap.ratedCount
                })}
              </span>
            )}
            {recap.bestMonth && (
              <span>
                {t('recap.bestMonth', {
                  month: months[recap.bestMonth.month - 1] ?? '',
                  time: formatPlaytime(recap.bestMonth.minutes, true)
                })}
              </span>
            )}
          </div>
          {recap.genres.length > 0 && (
            <span>{t('recap.genres', { list: recap.genres.map((g) => g.name).join(' · ') })}</span>
          )}
          {/*
            «Первая и последняя» имеют смысл, только когда даты различаются: при импорте
            и в демо-данных все прохождения нередко помечены одним днём.
          */}
          {recap.completed === 1 && recap.firstCompleted && (
            <span>{t('recap.onlyOne', { title: recap.firstCompleted.title })}</span>
          )}
          {recap.completed > 1 &&
            recap.firstCompleted &&
            recap.lastCompleted &&
            recap.firstCompleted.date !== recap.lastCompleted.date && (
              <span>
                {t('recap.firstLast', {
                  first: recap.firstCompleted.title,
                  last: recap.lastCompleted.title
                })}
              </span>
            )}
        </div>
      </div>
    </div>
  )
}
