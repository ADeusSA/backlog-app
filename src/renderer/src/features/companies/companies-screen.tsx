import { useMemo, useState } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Building2, Plus, Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { COUNTRIES, countryName } from '@shared/countries'
import { Button } from '@/components/ui/button'
import { Combobox } from '@/components/ui/combobox'
import { CoverImage } from '@/components/ui/image'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { ProgressRing } from '@/components/ui/progress-ring'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { call } from '@/platform/api'

type Role = 'all' | 'developer' | 'publisher'

const ALPHABET = 'АБВГДЕЖЗИКЛМНОПРСТУФХЦЧШЩЭЮЯABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

/** Индекс студий и издателей (ТЗ 06 §5.1). */
export function CompaniesScreen(): React.ReactElement {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const search = useSearch({ strict: false }) as { role?: Role }
  const role = search.role ?? 'all'
  const [query, setQuery] = useState('')
  const [country, setCountry] = useState<string | null>(null)
  const [letter, setLetter] = useState<string | null>(null)

  const { data, isPending } = useQuery({
    queryKey: ['companies', role],
    queryFn: () => call('companies.list', { role, sort: 'name' })
  })

  const items = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (data ?? []).filter((company) => {
      if (q && !company.name.toLowerCase().includes(q)) return false
      if (country && company.countryCode !== country) return false
      if (letter && !company.sortName.toUpperCase().startsWith(letter)) return false
      return true
    })
  }, [data, query, country, letter])

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 p-6">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="type-h1 flex-1">{t('nav.companies')}</h1>
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('common.search')}
          iconLeft={<Search size={14} strokeWidth={1.75} />}
          className="w-[220px]"
        />
        <Combobox
          items={COUNTRIES.map((item) => ({ value: item.code, label: item.ru }))}
          value={country}
          onChange={(value) => setCountry(Array.isArray(value) ? (value[0] ?? null) : value)}
          placeholder={t('companies.country')}
        />
        <Button
          variant="primary"
          onClick={() => void navigate({ to: '/catalog/$entity/new', params: { entity: 'companies' } })}
        >
          <Plus size={16} strokeWidth={1.75} />
          {t('companies.new')}
        </Button>
      </header>

      <Tabs value={role} onValueChange={(value) => void navigate({ to: '/companies', search: { role: value as Role } })}>
        <TabsList>
          <TabsTrigger value="all">{t('nav.all')}</TabsTrigger>
          <TabsTrigger value="developer">{t('companies.developers')}</TabsTrigger>
          <TabsTrigger value="publisher">{t('companies.publishers')}</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="flex min-h-0 flex-1 gap-3">
        <div className="min-w-0 flex-1 overflow-y-auto">
          {isPending && <Skeleton className="h-[300px] w-full" />}
          {!isPending && items.length === 0 && (
            <EmptyState
              icon={<Building2 size={24} strokeWidth={1.75} />}
              title={t('companies.empty')}
              action={{
                label: t('companies.new'),
                onClick: () => void navigate({ to: '/catalog/$entity/new', params: { entity: 'companies' } })
              }}
            />
          )}
          {/* 260 px: при 220 на название оставалось ~85 px и оно всегда обрезалось. */}
          <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3">
            {items.map((company) => (
              <button
                key={company.id}
                type="button"
                className="flex items-center gap-3 rounded-[var(--r-md)] p-3 text-left"
                style={{ background: 'var(--surface-1)', border: '1px solid var(--border-1)' }}
                onClick={() => void navigate({ to: '/companies/$companyId', params: { companyId: company.id } })}
              >
                <CoverImage
                  fileName={company.logoFile}
                  title={company.name}
                  dominantColor={company.dominantColor}
                  ratio="16/9"
                  size={56}
                />
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 block type-h3">{company.name}</span>
                  <span className="block type-small" style={{ color: 'var(--text-2)' }}>
                    {countryName(company.countryCode)}
                  </span>
                  <span className="block type-small tabular" style={{ color: 'var(--text-3)' }}>
                    {t('companies.counts', { catalog: company.gameCount, mine: company.myGameCount })}
                  </span>
                </span>
                {company.myGameCount > 0 && (
                  <ProgressRing done={company.completedCount} total={company.myGameCount} size={40} />
                )}
              </button>
            ))}
          </div>
        </div>

        <nav className="flex w-[28px] shrink-0 flex-col items-center gap-0.5 overflow-y-auto" aria-label="A–Z">
          {ALPHABET.map((char) => (
            <button
              key={char}
              type="button"
              className="type-small"
              style={{ color: letter === char ? 'var(--accent)' : 'var(--text-3)' }}
              onClick={() => setLetter(letter === char ? null : char)}
            >
              {char}
            </button>
          ))}
        </nav>
      </div>
    </div>
  )
}
