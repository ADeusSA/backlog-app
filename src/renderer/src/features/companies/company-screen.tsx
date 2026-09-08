import { useNavigate, useParams, useSearch } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Building2, ExternalLink, Pencil } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { countryName } from '@shared/countries'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CoverImage } from '@/components/ui/image'
import { EmptyState } from '@/components/ui/empty-state'
import { ProgressRing } from '@/components/ui/progress-ring'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { GameCollectionView } from '@/features/collection/game-collection-view'
import { call } from '@/platform/api'

type Tab = 'games' | 'series' | 'children'

/** Страница компании (ТЗ 06 §5.2). */
export function CompanyScreen(): React.ReactElement {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { companyId } = useParams({ strict: false }) as { companyId?: string }
  const search = useSearch({ strict: false }) as { tab?: Tab }
  const tab = search.tab ?? 'games'

  const { data: company, isPending } = useQuery({
    queryKey: ['companies', companyId],
    queryFn: () => call('companies.get', { id: companyId! }),
    enabled: Boolean(companyId)
  })
  const { data: series } = useQuery({
    queryKey: ['companies', companyId, 'series'],
    queryFn: () => call('companies.series', { id: companyId! }),
    enabled: Boolean(companyId) && tab === 'series'
  })
  const { data: children } = useQuery({
    queryKey: ['companies', companyId, 'children'],
    queryFn: () => call('companies.children', { id: companyId! }),
    enabled: Boolean(companyId)
  })

  if (isPending) return <Skeleton className="m-6 h-[400px]" />
  if (!company || !companyId) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <EmptyState icon={<Building2 size={24} strokeWidth={1.75} />} title={t('error.not_found')} />
      </div>
    )
  }

  const header = (
    <div className="flex flex-col gap-3">
      <div className="flex items-start gap-4">
        <CoverImage
          fileName={company.logoFile}
          title={company.name}
          dominantColor={company.dominantColor}
          ratio="16/9"
          size={96}
        />
        <div className="min-w-0 flex-1">
          <h1 className="type-h1 truncate">{company.name}</h1>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {company.isDeveloper && <Badge tone="accent">{t('role.developer')}</Badge>}
            {company.isPublisher && <Badge>{t('role.publisher')}</Badge>}
            <span className="type-small" style={{ color: 'var(--text-2)' }}>
              {[countryName(company.countryCode), company.city].filter(Boolean).join(' · ')}
            </span>
            {company.foundedYear && (
              <span className="type-small tabular" style={{ color: 'var(--text-2)' }}>
                {t('companies.founded', { year: company.foundedYear })}
                {company.closedYear ? ` · ${t('companies.closed', { year: company.closedYear })}` : ''}
              </span>
            )}
            {company.parentCompanyId && company.parentCompanyName && (
              <button
                type="button"
                className="type-small"
                style={{ color: 'var(--accent)' }}
                onClick={() =>
                  void navigate({
                    to: '/companies/$companyId',
                    params: { companyId: company.parentCompanyId! }
                  })
                }
              >
                {t('companies.partOf', { name: company.parentCompanyName })}
              </button>
            )}
          </div>
          {company.description && (
            <p className="type-body-lg pt-2" style={{ color: 'var(--text-2)' }}>
              {company.description}
            </p>
          )}
        </div>
        {company.myGameCount > 0 && (
          <ProgressRing done={company.completedCount} total={company.myGameCount} size={56} />
        )}
      </div>

      <Tabs
        value={tab}
        onValueChange={(value) =>
          void navigate({ to: '/companies/$companyId', params: { companyId }, search: { tab: value as Tab } })
        }
      >
        <TabsList>
          <TabsTrigger value="games">{t('catalog.entity.games')}</TabsTrigger>
          <TabsTrigger value="series">{t('nav.series')}</TabsTrigger>
          {(children?.length ?? 0) > 0 && <TabsTrigger value="children">{t('companies.children')}</TabsTrigger>}
        </TabsList>
      </Tabs>
    </div>
  )

  if (tab === 'games') {
    return (
      <GameCollectionView
        scope={{ kind: 'company', companyId }}
        title={company.name}
        titleSlot={header}
        subtitle={t('companies.counts', { catalog: company.gameCount, mine: company.myGameCount })}
        defaultSort={{ field: 'release_date', dir: 'desc' }}
        hiddenFilterSections={['developers']}
        breadcrumbContext={{ from: 'company', fromId: companyId, fromTitle: company.name }}
        actionsSlot={
          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              void navigate({ to: '/catalog/$entity/$id/edit', params: { entity: 'companies', id: companyId } })
            }
          >
            <Pencil size={16} strokeWidth={1.75} />
            {t('action.edit')}
          </Button>
        }
      />
    )
  }

  return (
    <div className="flex flex-col gap-4 p-6">
      {header}

      {tab === 'series' && (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
          {(series ?? []).map((item) => (
            <button
              key={item.id}
              type="button"
              className="flex items-center gap-3 rounded-[var(--r-md)] p-3 text-left"
              style={{ background: 'var(--surface-1)', border: '1px solid var(--border-1)' }}
              onClick={() => void navigate({ to: '/series/$seriesId', params: { seriesId: item.id } })}
            >
              <CoverImage fileName={item.coverFile} title={item.name} size={48} />
              <span className="min-w-0 flex-1">
                <span className="block truncate type-h3">{item.name}</span>
                <span className="block type-small tabular" style={{ color: 'var(--text-2)' }}>
                  {t('companies.seriesShare', { own: item.companyGameCount, total: item.gameCount })}
                </span>
              </span>
            </button>
          ))}
          {(series?.length ?? 0) === 0 && (
            <p className="type-small" style={{ color: 'var(--text-3)' }}>
              {t('empty.title')}
            </p>
          )}
        </div>
      )}

      {tab === 'children' && (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
          {(children ?? []).map((child) => (
            <button
              key={child.id}
              type="button"
              className="flex items-center gap-3 rounded-[var(--r-md)] p-3 text-left"
              style={{ background: 'var(--surface-1)', border: '1px solid var(--border-1)' }}
              onClick={() => void navigate({ to: '/companies/$companyId', params: { companyId: child.id } })}
            >
              <CoverImage fileName={child.logoFile} title={child.name} ratio="16/9" size={48} />
              <span className="min-w-0 flex-1 truncate type-h3">{child.name}</span>
            </button>
          ))}
        </div>
      )}

      {company.website && (
        <Button
          variant="ghost"
          size="sm"
          className="self-start"
          onClick={() => void call('app.openExternal', { url: company.website! })}
        >
          <ExternalLink size={14} strokeWidth={1.75} />
          {company.website}
        </Button>
      )}
    </div>
  )
}
