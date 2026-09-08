import { useMemo, useState } from 'react'
import { useNavigate, useParams } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Gamepad2, Merge, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { GameCardDto } from '@shared/schema/entities'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Segmented } from '@/components/ui/segmented'
import { CoverImage } from '@/components/ui/image'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/components/ui/toast'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Combobox } from '@/components/ui/combobox'
import { call } from '@/platform/api'
import { formatDate } from '@/lib/format'

type Entity = 'games' | 'companies' | 'series' | 'genres' | 'platforms' | 'tags'

/** Справочники живут в одном разделе сайдбара («Жанры и теги»), поэтому переключаются на месте. */
const TAXONOMIES = ['genres', 'tags', 'platforms'] as const
type Taxonomy = (typeof TAXONOMIES)[number]

function isTaxonomy(kind: Entity): kind is Taxonomy {
  return (TAXONOMIES as readonly string[]).includes(kind)
}

/** Таблицы сущностей каталога (ТЗ 06 §7.2). */
export function CatalogEntityScreen(): React.ReactElement {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { entity } = useParams({ strict: false }) as { entity?: string }
  const kind = (entity ?? 'games') as Entity
  const [query, setQuery] = useState('')

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 p-6">
      <header className="flex items-center gap-3">
        <h1 className="type-h1">{t(`catalog.entity.${kind}`)}</h1>
        {isTaxonomy(kind) && (
          <Segmented
            options={TAXONOMIES.map((item) => ({ value: item, label: t(`catalog.entity.${item}`) }))}
            value={kind}
            onChange={(next) => void navigate({ to: '/catalog/$entity', params: { entity: next } })}
            ariaLabel={t('nav.taxonomy')}
          />
        )}
        <div className="flex-1" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('common.search')}
          iconLeft={<Search size={14} strokeWidth={1.75} />}
          className="w-[260px]"
        />
        <Button variant="primary" onClick={() => void navigate({ to: '/catalog/$entity/new', params: { entity: kind } })}>
          <Plus size={16} strokeWidth={1.75} />
          {t('action.add')}
        </Button>
      </header>

      {kind === 'games' ? (
        <GamesTable query={query} />
      ) : (
        <TaxonomyTable kind={kind} query={query} />
      )}
    </div>
  )
}

function GamesTable({ query }: { query: string }): React.ReactElement {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data, isPending } = useQuery({
    queryKey: ['catalog', 'games', query],
    queryFn: () =>
      call('collection.query', {
        scope: { kind: 'catalog' },
        filters: query ? { q: query } : {},
        sort: { field: 'title', dir: 'asc' }
      })
  })

  const remove = (game: GameCardDto): void => {
    void call('catalog.games.delete', { ids: [game.id] })
      .then(() => {
        toast({ title: t('catalog.deleted', { name: game.title }), tone: 'success' })
        void queryClient.invalidateQueries()
      })
      .catch((err: Error) => toast({ title: err.message, tone: 'danger' }))
  }

  if (isPending) return <Skeleton className="h-[400px] w-full" />
  if (!data || data.items.length === 0) {
    return (
      <EmptyState
        icon={<Gamepad2 size={24} strokeWidth={1.75} />}
        title={t('empty.title')}
        description={t('empty.libraryHint')}
      />
    )
  }

  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <table className="w-full border-collapse">
        <thead className="sticky top-0" style={{ background: 'var(--bg-0)' }}>
          <tr className="type-caption">
            <th className="w-[52px] px-2 py-2 text-left" />
            <th className="px-2 py-2 text-left">{t('catalog.col.title')}</th>
            <th className="w-[70px] px-2 py-2 text-right">{t('catalog.col.year')}</th>
            <th className="w-[180px] px-2 py-2 text-left">{t('role.developer')}</th>
            <th className="w-[120px] px-2 py-2 text-left">{t('catalog.col.category')}</th>
            <th className="w-[120px] px-2 py-2 text-left">{t('catalog.col.completeness')}</th>
            <th className="w-[110px] px-2 py-2 text-left">{t('catalog.col.inLibrary')}</th>
            <th className="w-[96px] px-2 py-2" />
          </tr>
        </thead>
        <tbody>
          {data.items.map((game) => (
            <tr
              key={game.id}
              className="hover:bg-[var(--surface-1)]"
              style={{ borderTop: '1px solid var(--border-1)' }}
            >
              <td className="px-2 py-1.5">
                <CoverImage
                  fileName={game.coverFile}
                  title={game.title}
                  dominantColor={game.dominantColor}
                  ratio="3/4"
                  size={36}
                />
              </td>
              <td className="px-2 py-1.5">
                <button
                  type="button"
                  className="type-body hover:underline"
                  onClick={() => void navigate({ to: '/games/$gameId', params: { gameId: game.id } })}
                >
                  {game.title}
                </button>
              </td>
              <td className="px-2 py-1.5 text-right type-small tabular" style={{ color: 'var(--text-2)' }}>
                {game.releaseYear ?? '—'}
              </td>
              <td className="truncate px-2 py-1.5 type-small" style={{ color: 'var(--text-2)' }}>
                {game.developer ?? '—'}
              </td>
              <td className="px-2 py-1.5 type-small" style={{ color: 'var(--text-2)' }}>
                {t(`category.${game.category}`)}
              </td>
              <td className="px-2 py-1.5">
                <CompletenessBar value={game.completeness ?? 0} />
              </td>
              <td className="px-2 py-1.5 type-small" style={{ color: 'var(--text-2)' }}>
                {game.status ? t(`status.${game.status}`) : '—'}
              </td>
              <td className="px-2 py-1.5">
                <div className="flex justify-end gap-1">
                  <Button
                    variant="icon"
                    size="sm"
                    aria-label={t('action.edit')}
                    onClick={() =>
                      void navigate({
                        to: '/catalog/$entity/$id/edit',
                        params: { entity: 'games', id: game.id }
                      })
                    }
                  >
                    <Pencil size={14} strokeWidth={1.75} />
                  </Button>
                  <Button variant="icon" size="sm" aria-label={t('action.delete')} onClick={() => remove(game)}>
                    <Trash2 size={14} strokeWidth={1.75} />
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function CompletenessBar({ value }: { value: number }): React.ReactElement {
  return (
    <span className="flex items-center gap-2">
      <span
        className="h-1.5 w-[64px] overflow-hidden rounded-[var(--r-pill)]"
        style={{ background: 'var(--track)' }}
      >
        <span
          className="block h-full rounded-[var(--r-pill)]"
          style={{ width: `${value}%`, background: 'var(--accent)' }}
        />
      </span>
      <span className="type-small tabular" style={{ color: 'var(--text-3)' }}>
        {value}%
      </span>
    </span>
  )
}

interface TaxonomyRow {
  id: string
  name: string
  gameCount?: number
  extra?: string
  updatedAt?: string
}

function TaxonomyTable({ kind, query }: { kind: Entity; query: string }): React.ReactElement {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [mergeFrom, setMergeFrom] = useState<TaxonomyRow | null>(null)
  const [mergeInto, setMergeInto] = useState<string | null>(null)

  const { data, isPending } = useQuery({
    queryKey: ['catalog', kind],
    queryFn: async (): Promise<TaxonomyRow[]> => {
      switch (kind) {
        case 'companies':
          return (await call('companies.list')).map((c) => ({
            id: c.id,
            name: c.name,
            gameCount: c.gameCount,
            extra: [c.isDeveloper ? t('role.developer') : null, c.isPublisher ? t('role.publisher') : null]
              .filter(Boolean)
              .join(' · '),
            updatedAt: c.updatedAt
          }))
        case 'series':
          return (await call('series.list')).map((s) => ({
            id: s.id,
            name: s.name,
            gameCount: s.gameCount,
            updatedAt: s.updatedAt
          }))
        case 'genres':
          return (await call('catalog.genres.list')).map((g) => ({
            id: g.id,
            name: g.name,
            gameCount: g.gameCount ?? 0
          }))
        case 'platforms':
          return (await call('catalog.platforms.list')).map((p) => ({
            id: p.id,
            name: p.name,
            gameCount: p.gameCount ?? 0,
            extra: t(`family.${p.family}`)
          }))
        case 'tags':
          return (await call('catalog.tags.list')).map((tag) => ({
            id: tag.id,
            name: tag.name,
            gameCount: tag.gameCount ?? 0
          }))
        default:
          return []
      }
    }
  })

  const rows = useMemo(
    () =>
      (data ?? []).filter((row) => (query ? row.name.toLowerCase().includes(query.toLowerCase()) : true)),
    [data, query]
  )

  const remove = (row: TaxonomyRow): void => {
    const channel =
      kind === 'companies'
        ? 'catalog.companies.delete'
        : kind === 'series'
          ? 'catalog.series.delete'
          : kind === 'genres'
            ? 'catalog.genres.delete'
            : kind === 'platforms'
              ? 'catalog.platforms.delete'
              : 'catalog.tags.delete'
    void call(channel as 'catalog.tags.delete', { id: row.id })
      .then(() => {
        toast({ title: t('catalog.deleted', { name: row.name }), tone: 'success' })
        void queryClient.invalidateQueries()
      })
      .catch((err: Error) => toast({ title: err.message, tone: 'danger' }))
  }

  const merge = (): void => {
    if (!mergeFrom || !mergeInto) return
    const channel =
      kind === 'companies'
        ? 'catalog.companies.merge'
        : kind === 'genres'
          ? 'catalog.genres.merge'
          : kind === 'platforms'
            ? 'catalog.platforms.merge'
            : 'catalog.tags.merge'
    void call(channel as 'catalog.tags.merge', { fromId: mergeFrom.id, intoId: mergeInto })
      .then(() => {
        toast({ title: t('catalog.merged'), tone: 'success' })
        setMergeFrom(null)
        setMergeInto(null)
        void queryClient.invalidateQueries()
      })
      .catch((err: Error) => toast({ title: err.message, tone: 'danger' }))
  }

  if (isPending) return <Skeleton className="h-[400px] w-full" />
  if (rows.length === 0) {
    return <EmptyState icon={<Merge size={24} strokeWidth={1.75} />} title={t('empty.title')} />
  }

  const editable = kind === 'companies' || kind === 'series'
  const mergeable = kind !== 'series'

  return (
    <>
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full border-collapse">
          <thead className="sticky top-0" style={{ background: 'var(--bg-0)' }}>
            <tr className="type-caption">
              <th className="px-2 py-2 text-left">{t('catalog.col.title')}</th>
              <th className="w-[200px] px-2 py-2 text-left">{t('catalog.col.extra')}</th>
              <th className="w-[100px] px-2 py-2 text-right">{t('catalog.col.games')}</th>
              <th className="w-[130px] px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="hover:bg-[var(--surface-1)]" style={{ borderTop: '1px solid var(--border-1)' }}>
                <td className="px-2 py-1.5 type-body">{row.name}</td>
                <td className="px-2 py-1.5 type-small" style={{ color: 'var(--text-2)' }}>
                  {row.extra ?? (row.updatedAt ? formatDate(row.updatedAt) : '—')}
                </td>
                <td className="px-2 py-1.5 text-right type-small tabular" style={{ color: 'var(--text-2)' }}>
                  {row.gameCount ?? 0}
                </td>
                <td className="px-2 py-1.5">
                  <div className="flex justify-end gap-1">
                    {editable && (
                      <Button
                        variant="icon"
                        size="sm"
                        aria-label={t('action.edit')}
                        onClick={() =>
                          void navigate({
                            to: '/catalog/$entity/$id/edit',
                            params: { entity: kind, id: row.id }
                          })
                        }
                      >
                        <Pencil size={14} strokeWidth={1.75} />
                      </Button>
                    )}
                    {mergeable && (
                      <Button
                        variant="icon"
                        size="sm"
                        aria-label={t('catalog.merge')}
                        onClick={() => setMergeFrom(row)}
                      >
                        <Merge size={14} strokeWidth={1.75} />
                      </Button>
                    )}
                    <Button variant="icon" size="sm" aria-label={t('action.delete')} onClick={() => remove(row)}>
                      <Trash2 size={14} strokeWidth={1.75} />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={Boolean(mergeFrom)} onOpenChange={(open) => !open && setMergeFrom(null)}>
        <DialogContent size={480}>
          <DialogHeader>
            <DialogTitle>{t('catalog.merge')}</DialogTitle>
          </DialogHeader>
          <p className="type-body" style={{ color: 'var(--text-2)' }}>
            {t('catalog.merge.hint', { name: mergeFrom?.name ?? '' })}
          </p>
          <Combobox
            items={rows
              .filter((row) => row.id !== mergeFrom?.id)
              .map((row) => ({ value: row.id, label: row.name }))}
            value={mergeInto}
            onChange={(value) => setMergeInto(Array.isArray(value) ? (value[0] ?? null) : value)}
            placeholder={t('catalog.merge.target')}
          />
          <DialogFooter>
            <Button variant="secondary" onClick={() => setMergeFrom(null)}>
              {t('action.cancel')}
            </Button>
            <Button variant="primary" disabled={!mergeInto} onClick={merge}>
              {t('catalog.merge')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
