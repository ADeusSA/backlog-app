import { useState, type ReactElement } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Download, KeyRound, Loader2, Search, Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from '@tanstack/react-router'
import { IMPORT_PROVIDERS, type ImportProvider } from '@shared/constants'
import type { ProviderHit } from '@shared/schema/providers'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Segmented } from '@/components/ui/segmented'
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover'
import { toast } from '@/components/ui/toast'
import { call } from '@/platform/api'
import { useRemoteImage } from './use-remote-image'

const PROVIDER_LABEL: Record<ImportProvider, string> = { steam: 'Steam', rawg: 'RAWG', igdb: 'IGDB' }

interface Props {
  /** Текущее название в форме — подставляется в поиск как есть. */
  title: string
  onPick: (provider: ImportProvider, externalId: string) => void
  /** Идёт ли загрузка выбранной карточки. */
  loading: boolean
}

/**
 * Панель «Заполнить из источника» над формой игры (ТЗ 06 §7.3, 08 §3 п. 1–2).
 *
 * Принимает и название, и ссылку: для Steam — `store.steampowered.com/app/…`,
 * `steamdb.info/app/…` или просто appid, для IGDB — `igdb.com/games/<slug>`.
 */
export function ImportPanel({ title, onPick, loading }: Props): ReactElement {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [provider, setProvider] = useState<ImportProvider>('steam')
  const [query, setQuery] = useState('')
  const [term, setTerm] = useState('')
  const [open, setOpen] = useState(false)

  const { data: statuses } = useQuery({ queryKey: ['providers', 'status'], queryFn: () => call('providers.status') })
  const status = statuses?.find((item) => item.provider === provider)
  const ready = status?.ready ?? true

  const {
    data: hits,
    isFetching,
    error
  } = useQuery({
    queryKey: ['providers', 'search', provider, term],
    queryFn: () => call('providers.search', { provider, query: term, limit: 10 }),
    enabled: term.trim().length >= 2 && ready,
    retry: false,
    staleTime: 5 * 60_000
  })

  const runSearch = (): void => {
    const value = (query.trim() || title.trim()).trim()
    if (value.length < 2) {
      toast({ title: t('catalog.import.needQuery') })
      return
    }
    if (!ready) {
      toast({ title: t('catalog.import.needKeys', { provider: PROVIDER_LABEL[provider] }), tone: 'danger' })
      return
    }
    setTerm(value)
    setOpen(true)
  }

  return (
    <div
      className="flex flex-col gap-3 rounded-[var(--r-md)] px-4 py-3"
      style={{ background: 'var(--surface-1)', border: '1px solid var(--border-1)' }}
    >
      <div className="flex flex-wrap items-center gap-3">
        <Sparkles size={16} strokeWidth={1.75} style={{ color: 'var(--accent)' }} />
        <span className="type-body">{t('catalog.import.title')}</span>
        <Segmented<ImportProvider>
          size="sm"
          options={IMPORT_PROVIDERS.map((id) => ({ value: id, label: PROVIDER_LABEL[id] }))}
          value={provider}
          onChange={setProvider}
          ariaLabel={t('catalog.import.provider')}
        />
        <div className="flex-1" />
      </div>

      <Popover open={open && ready} onOpenChange={setOpen}>
        <PopoverAnchor asChild>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              iconLeft={<Search size={16} strokeWidth={1.75} />}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  runSearch()
                }
              }}
              placeholder={t('catalog.import.placeholder', { provider: PROVIDER_LABEL[provider] })}
              className="min-w-[280px] flex-1"
            />
            <Button type="button" variant="secondary" onClick={runSearch} loading={isFetching || loading}>
              <Download size={14} strokeWidth={1.75} />
              {t('catalog.import.find')}
            </Button>
          </div>
        </PopoverAnchor>

        <PopoverContent align="start" className="w-[520px] p-1">
          <HitList hits={hits} loading={isFetching} error={error} onPick={(hit) => {
            setOpen(false)
            onPick(hit.provider, hit.externalId)
          }} />
        </PopoverContent>
      </Popover>

      {!ready && (
        <p className="flex items-center gap-1.5 type-small" style={{ color: 'var(--warning)' }}>
          <KeyRound size={13} strokeWidth={1.75} />
          {status?.reason === 'noEncryption'
            ? t('catalog.import.noEncryption')
            : t('catalog.import.needKeys', { provider: PROVIDER_LABEL[provider] })}
          <button
            type="button"
            className="underline"
            onClick={() => void navigate({ to: '/settings/$section', params: { section: 'sources' } })}
          >
            {t('catalog.import.openSettings')}
          </button>
        </p>
      )}

      {/* type-small, а не type-caption: подсказка длинная, и в верхнем регистре она нечитаема. */}
      <p className="max-w-[760px] type-small" style={{ color: 'var(--text-3)' }}>
        {t(`catalog.import.hint.${provider}`)}
      </p>
    </div>
  )
}

function HitList({
  hits,
  loading,
  error,
  onPick
}: {
  hits: ProviderHit[] | undefined
  loading: boolean
  error: unknown
  onPick: (hit: ProviderHit) => void
}): ReactElement {
  const { t } = useTranslation()

  if (error) {
    return (
      <p className="px-3 py-4 type-small" style={{ color: 'var(--danger)' }}>
        {(error as Error).message}
      </p>
    )
  }
  if (loading) {
    return (
      <p className="flex items-center gap-2 px-3 py-4 type-small" style={{ color: 'var(--text-3)' }}>
        <Loader2 size={14} className="animate-spin" />
        {t('common.loading')}
      </p>
    )
  }
  if (!hits || hits.length === 0) {
    return (
      <p className="px-3 py-4 type-small" style={{ color: 'var(--text-3)' }}>
        {t('catalog.import.noResults')}
      </p>
    )
  }

  return (
    <ul className="max-h-[360px] overflow-y-auto">
      {hits.map((hit) => (
        <li key={`${hit.provider}:${hit.externalId}`}>
          <HitRow hit={hit} onPick={() => onPick(hit)} />
        </li>
      ))}
    </ul>
  )
}

function HitRow({ hit, onPick }: { hit: ProviderHit; onPick: () => void }): ReactElement {
  const { t } = useTranslation()
  const thumb = useRemoteImage(hit.thumbUrl)

  return (
    <button
      type="button"
      onClick={onPick}
      className="flex w-full items-center gap-3 rounded-[var(--r-sm)] px-2 py-1.5 text-left outline-none hover:bg-[var(--surface-2)] focus-visible:bg-[var(--surface-2)]"
    >
      <div
        className="h-10 w-[72px] shrink-0 overflow-hidden rounded-[var(--r-sm)]"
        style={{ background: 'var(--surface-2)' }}
      >
        {thumb && <img src={thumb} alt="" className="h-full w-full object-cover" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate type-body">
          {hit.title}
          {hit.year ? <span style={{ color: 'var(--text-3)' }}> ({hit.year})</span> : null}
        </p>
        <p className="truncate type-caption" style={{ color: 'var(--text-3)' }}>
          {[hit.developer, hit.platforms.slice(0, 3).join(', ')].filter(Boolean).join(' · ') || '—'}
        </p>
      </div>
      {hit.kind && (
        <span
          className="shrink-0 rounded-pill px-2 py-0.5 type-caption"
          style={{ background: 'var(--surface-2)', color: 'var(--text-2)' }}
        >
          {t(`category.${hit.kind}`, { defaultValue: hit.kind })}
        </span>
      )}
    </button>
  )
}
