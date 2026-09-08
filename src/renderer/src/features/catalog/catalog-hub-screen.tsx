import { useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Building2, Gamepad2, Layers, Plus, Tag, Tags, Monitor, type LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { CoverImage } from '@/components/ui/image'
import { formatRelative } from '@/lib/format'
import { call } from '@/platform/api'

const ENTITIES: Array<{ id: string; icon: LucideIcon }> = [
  { id: 'games', icon: Gamepad2 },
  { id: 'companies', icon: Building2 },
  { id: 'series', icon: Layers },
  { id: 'genres', icon: Tags },
  { id: 'platforms', icon: Monitor },
  { id: 'tags', icon: Tag }
]

/** Хаб модерации каталога (ТЗ 06 §7.1). */
export function CatalogHubScreen(): React.ReactElement {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { data: counts } = useQuery({ queryKey: ['catalog', 'counts'], queryFn: () => call('catalog.counts') })
  const { data: recent } = useQuery({
    queryKey: ['catalog', 'recent'],
    queryFn: () => call('catalog.recent', { limit: 10 })
  })

  return (
    <div className="flex flex-col gap-8 p-6">
      <header>
        <h1 className="type-h1">{t('nav.addContent')}</h1>
        <p className="type-body" style={{ color: 'var(--text-2)' }}>
          {t('catalog.hub.hint')}
        </p>
      </header>

      <section className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4">
        {ENTITIES.map((entity) => {
          const count = counts?.[entity.id as keyof typeof counts] ?? 0
          return (
            <div
              key={entity.id}
              className="flex flex-col gap-3 rounded-[var(--r-md)] p-4"
              style={{ background: 'var(--surface-1)', border: '1px solid var(--border-1)' }}
            >
              <div className="flex items-center gap-2">
                <entity.icon size={20} strokeWidth={1.75} style={{ color: 'var(--text-2)' }} />
                <span className="type-h3">{t(`catalog.entity.${entity.id}`)}</span>
              </div>
              <span className="type-small tabular" style={{ color: 'var(--text-3)' }}>
                {count}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="flex h-[32px] flex-1 items-center justify-center gap-1 rounded-[var(--r-pill)] type-small"
                  style={{ background: 'var(--accent)', color: 'var(--accent-on)' }}
                  onClick={() =>
                    void navigate({ to: '/catalog/$entity/new', params: { entity: entity.id } })
                  }
                >
                  <Plus size={14} strokeWidth={1.75} />
                  {t('action.add')}
                </button>
                <button
                  type="button"
                  className="h-[32px] rounded-[var(--r-pill)] px-3 type-small"
                  style={{ background: 'var(--surface-2)', color: 'var(--text-1)' }}
                  onClick={() => void navigate({ to: '/catalog/$entity', params: { entity: entity.id } })}
                >
                  {t('catalog.hub.table')}
                </button>
              </div>
            </div>
          )
        })}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="type-caption">{t('catalog.hub.recent')}</h2>
        <ul className="flex flex-col gap-1">
          {(recent ?? []).map((item) => (
            <li key={`${item.entityType}-${item.id}`}>
              <button
                type="button"
                className="flex w-full items-center gap-3 rounded-[var(--r-sm)] px-2 py-1.5 text-left hover:bg-[var(--surface-1)]"
                onClick={() =>
                  void navigate({
                    to: item.entityType === 'game' ? '/games/$gameId' : '/catalog/$entity',
                    params:
                      item.entityType === 'game'
                        ? { gameId: item.id }
                        : { entity: `${item.entityType}s` }
                  })
                }
              >
                <CoverImage fileName={item.coverFile} title={item.name} ratio="3/4" size={28} />
                <span className="min-w-0 flex-1 truncate type-body">{item.name}</span>
                <span className="type-small" style={{ color: 'var(--text-3)' }}>
                  {formatRelative(item.createdAt)}
                </span>
              </button>
            </li>
          ))}
          {(recent?.length ?? 0) === 0 && (
            <li className="type-small" style={{ color: 'var(--text-3)' }}>
              {t('empty.title')}
            </li>
          )}
        </ul>
      </section>
    </div>
  )
}
