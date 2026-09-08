import { useNavigate, useSearch } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Building2, Layers, ListChecks, SearchX } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { CoverImage } from '@/components/ui/image'
import { EmptyState } from '@/components/ui/empty-state'
import { StatusDot } from '@/components/ui/status-badge'
import { toast } from '@/components/ui/toast'
import { call } from '@/platform/api'

/** Страница результатов поиска (ТЗ 06 §9). */
export function SearchScreen(): React.ReactElement {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const search = useSearch({ strict: false }) as { q?: string }
  const query = search.q ?? ''

  const { data } = useQuery({
    queryKey: ['search', query, 'page'],
    queryFn: () => call('search.query', { q: query, limit: 50 }),
    enabled: query.trim().length > 0
  })

  const empty =
    data &&
    data.games.length === 0 &&
    data.series.length === 0 &&
    data.companies.length === 0 &&
    data.lists.length === 0

  return (
    <div className="flex flex-col gap-6 p-6">
      <h1 className="type-h1">
        {t('search.title')}: «{query}»
      </h1>

      {empty && (
        <EmptyState icon={<SearchX size={24} strokeWidth={1.75} />} title={t('empty.filters')} />
      )}

      {(data?.games.length ?? 0) > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="type-caption">{t('palette.games')}</h2>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-[var(--gap-grid)]">
            {data?.games.map((game) => (
              <div key={game.id} className="flex flex-col gap-1.5">
                <button
                  type="button"
                  onClick={() => void navigate({ to: '/games/$gameId', params: { gameId: game.id } })}
                >
                  <CoverImage
                    fileName={game.coverFile}
                    title={game.title}
                    dominantColor={game.dominantColor}
                    className="w-full"
                  />
                </button>
                <span className="truncate type-small">{game.title}</span>
                <span className="flex items-center gap-1.5 type-small" style={{ color: 'var(--text-3)' }}>
                  {game.status ? (
                    <>
                      <StatusDot status={game.status} size="sm" />
                      {t(`status.${game.status}`)}
                    </>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        void call('userGame.addToLibrary', { gameIds: [game.id], status: 'backlog' })
                          .then(() => toast({ title: t('action.addToBacklog'), tone: 'success' }))
                          .catch((err: Error) => toast({ title: err.message, tone: 'danger' }))
                      }}
                    >
                      {t('action.addToBacklog')}
                    </Button>
                  )}
                  {game.releaseYear ? <span className="tabular">{game.releaseYear}</span> : null}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {(data?.series.length ?? 0) > 0 && (
        <ResultList
          title={t('palette.series')}
          icon={<Layers size={16} strokeWidth={1.75} />}
          items={(data?.series ?? []).map((item) => ({
            id: item.id,
            name: item.name,
            hint: t('common.games', { count: item.gameCount }),
            onOpen: () => void navigate({ to: '/series/$seriesId', params: { seriesId: item.id } })
          }))}
        />
      )}

      {(data?.companies.length ?? 0) > 0 && (
        <ResultList
          title={t('palette.companies')}
          icon={<Building2 size={16} strokeWidth={1.75} />}
          items={(data?.companies ?? []).map((item) => ({
            id: item.id,
            name: item.name,
            hint: t('common.games', { count: item.gameCount }),
            onOpen: () => void navigate({ to: '/companies/$companyId', params: { companyId: item.id } })
          }))}
        />
      )}

      {(data?.lists.length ?? 0) > 0 && (
        <ResultList
          title={t('palette.lists')}
          icon={<ListChecks size={16} strokeWidth={1.75} />}
          items={(data?.lists ?? []).map((item) => ({
            id: item.id,
            name: item.name,
            hint: t('common.games', { count: item.gameCount }),
            onOpen: () => void navigate({ to: '/lists/$listId', params: { listId: item.id } })
          }))}
        />
      )}
    </div>
  )
}

function ResultList({
  title,
  icon,
  items
}: {
  title: string
  icon: React.ReactNode
  items: Array<{ id: string; name: string; hint: string; onOpen: () => void }>
}): React.ReactElement {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="type-caption">{title}</h2>
      <ul className="flex flex-col gap-1">
        {items.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-[var(--r-sm)] px-2 py-1.5 text-left hover:bg-[var(--surface-1)]"
              onClick={item.onOpen}
            >
              <span style={{ color: 'var(--text-3)' }}>{icon}</span>
              <span className="min-w-0 flex-1 truncate type-body">{item.name}</span>
              <span className="type-small tabular" style={{ color: 'var(--text-3)' }}>
                {item.hint}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
