import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { RotateCcw, Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  GAME_CATEGORIES,
  GAME_STATUSES,
  HLTB_BUCKETS,
  OWNERSHIPS,
  RELEASE_STATUSES,
  STATUS_ORDER,
  type GameStatus
} from '@shared/constants'
import { COUNTRIES } from '@shared/countries'
import type { Facets } from '@shared/schema/entities'
import type { Filters } from '@shared/schema/filters'
import { Button } from '@/components/ui/button'
import { Chip } from '@/components/ui/chip'
import { CollapsibleSection } from '@/components/ui/collapsible-section'
import { Combobox } from '@/components/ui/combobox'
import { Input } from '@/components/ui/input'
import { RangeSlider } from '@/components/ui/slider'
import { Segmented } from '@/components/ui/segmented'
import { Switch } from '@/components/ui/switch'
import { call } from '@/platform/api'
import { statusColor } from '@/lib/color'
import type { FilterSectionKey } from './types'

interface Props {
  filters: Filters
  onChange: (filters: Filters) => void
  facets: Facets | undefined
  hidden: FilterSectionKey[]
  total: number
  onReset: () => void
  onApplyClose?: () => void
}

/** Панель фильтров: 22 секции в порядке ТЗ 07 §7, с фасетными счётчиками. */
export function FiltersPanel({
  filters,
  onChange,
  facets,
  hidden,
  total,
  onReset,
  onApplyClose
}: Props): React.ReactElement {
  const { t } = useTranslation()
  const hiddenSet = useMemo(() => new Set(hidden), [hidden])
  const visible = (key: FilterSectionKey): boolean => !hiddenSet.has(key)

  const { data: genres } = useQuery({
    queryKey: ['catalog', 'genres'],
    queryFn: () => call('catalog.genres.list')
  })
  const { data: platforms } = useQuery({
    queryKey: ['catalog', 'platforms'],
    queryFn: () => call('catalog.platforms.list')
  })
  const { data: modes } = useQuery({
    queryKey: ['catalog', 'modes'],
    queryFn: () => call('catalog.modes.list')
  })
  const { data: tags } = useQuery({
    queryKey: ['catalog', 'tags'],
    queryFn: () => call('catalog.tags.list')
  })
  const { data: companies } = useQuery({
    queryKey: ['companies'],
    queryFn: () => call('companies.list')
  })
  const { data: series } = useQuery({ queryKey: ['series'], queryFn: () => call('series.list') })
  const { data: lists } = useQuery({ queryKey: ['lists'], queryFn: () => call('lists.list') })

  const patch = (next: Partial<Filters>): void => onChange({ ...filters, ...next })

  /** Счётчик совпадений для чипа секции (фасеты считаются без учёта самой секции). */
  const count = (section: string, key: string): number | undefined =>
    facets?.[section]?.find((bucket) => bucket.key === key)?.count

  /**
   * Значения, которых нет ни у одной игры, в панели не показываем (по требованию
   * пользователя). Уже выбранный чип остаётся видимым всегда — иначе его нельзя было бы снять.
   * Пока фасеты не загружены, показываем всё.
   */
  const hasMatches = (section: string, key: string, selected: boolean): boolean => {
    if (selected || !facets?.[section]) return true
    return (count(section, key) ?? 0) > 0
  }

  /** Отбирает чипы секции; если не осталось ни одного, секцию целиком не рисуем. */
  const pickChips = <T extends { id: string }>(
    section: string,
    items: T[] | undefined,
    selected: readonly string[] | undefined
  ): T[] =>
    (items ?? []).filter((item) =>
      hasMatches(section, item.id, selected?.includes(item.id) ?? false)
    )

  const genreChips = pickChips('genres', genres, filters.genres?.ids)
  const platformChips = pickChips('platforms', platforms, filters.platforms)
  const modeChips = pickChips('modes', modes, filters.modes)
  const tagChips = pickChips('tags', tags, filters.tags)

  const toggleIn = <T extends string>(list: T[] | undefined, value: T): T[] | undefined => {
    const current = list ?? []
    const next = current.includes(value)
      ? current.filter((item) => item !== value)
      : [...current, value]
    return next.length > 0 ? next : undefined
  }

  const developerItems = useMemo(
    () =>
      (companies ?? []).filter((c) => c.isDeveloper).map((c) => ({ value: c.id, label: c.name })),
    [companies]
  )
  const publisherItems = useMemo(
    () =>
      (companies ?? []).filter((c) => c.isPublisher).map((c) => ({ value: c.id, label: c.name })),
    [companies]
  )

  return (
    <aside
      className="glass flex w-[var(--w-filters)] shrink-0 flex-col"
      style={{ borderLeft: '1px solid var(--border-1)' }}
      aria-label={t('common.filters')}
    >
      <header
        className="flex items-center gap-2 px-4 py-3"
        style={{ borderBottom: '1px solid var(--border-1)' }}
      >
        <h2 className="type-h3 flex-1">{t('common.filters')}</h2>
        <Button variant="ghost" size="sm" onClick={onReset}>
          <RotateCcw size={14} strokeWidth={1.75} />
          {t('action.reset')}
        </Button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-2">
        {visible('q') && (
          <CollapsibleSection title={t('filters.search')} defaultOpen storageKey="f.q">
            <Input
              value={filters.q ?? ''}
              onChange={(event) => patch({ q: event.target.value || undefined })}
              placeholder={t('common.search')}
              iconLeft={<Search size={14} strokeWidth={1.75} />}
            />
          </CollapsibleSection>
        )}

        {visible('status') && (
          <CollapsibleSection
            title={t('filters.status')}
            count={filters.status?.length}
            defaultOpen
            storageKey="f.status"
          >
            <ChipRow>
              {STATUS_ORDER.filter((status) =>
                hasMatches('status', status, filters.status?.includes(status) ?? false)
              ).map((status) => (
                <Chip
                  key={status}
                  selected={filters.status?.includes(status) ?? false}
                  count={count('status', status)}
                  color={statusColor(status)}
                  onClick={() => patch({ status: toggleIn<GameStatus>(filters.status, status) })}
                >
                  {t(`statusPlural.${status}`)}
                </Chip>
              ))}
            </ChipRow>
          </CollapsibleSection>
        )}

        {visible('flags') && (
          <CollapsibleSection title={t('filters.flags')} storageKey="f.flags">
            <div className="flex flex-col gap-2">
              {(['favorite', 'mastered', 'hasReview', 'unrated', 'prioritized'] as const).map(
                (flag) => (
                  <Switch
                    key={flag}
                    checked={filters.flags?.[flag] === true}
                    onChange={(checked) =>
                      patch({
                        flags: { ...(filters.flags ?? {}), [flag]: checked ? true : null }
                      })
                    }
                    label={t(`filters.flag.${flag}`)}
                  />
                )
              )}
            </div>
          </CollapsibleSection>
        )}

        {visible('year') && (
          <CollapsibleSection title={t('filters.year')} storageKey="f.year">
            <RangeSlider
              min={1970}
              max={new Date().getFullYear() + 2}
              value={[filters.year?.min ?? 1970, filters.year?.max ?? new Date().getFullYear() + 2]}
              onChange={([min, max]) => patch({ year: { ...filters.year, min, max } })}
            />
            <label
              className="flex items-center gap-2 pt-2 type-small"
              style={{ color: 'var(--text-2)' }}
            >
              <input
                type="checkbox"
                checked={filters.year?.includeNull ?? false}
                onChange={(event) =>
                  patch({ year: { ...filters.year, includeNull: event.target.checked } })
                }
              />
              {t('filters.includeUndated')}
            </label>
          </CollapsibleSection>
        )}

        {visible('genres') && genreChips.length > 0 && (
          <CollapsibleSection
            title={t('filters.genres')}
            count={filters.genres?.ids.length}
            storageKey="f.genres"
          >
            <Segmented
              className="mb-2"
              value={filters.genres?.mode ?? 'any'}
              onChange={(mode) =>
                patch({ genres: { ids: filters.genres?.ids ?? [], mode: mode as 'any' | 'all' } })
              }
              options={[
                { value: 'any', label: t('filters.anyOf') },
                { value: 'all', label: t('filters.allOf') }
              ]}
            />
            <ChipRow>
              {genreChips.map((genre) => {
                const ids = filters.genres?.ids ?? []
                const selected = ids.includes(genre.id)
                return (
                  <Chip
                    key={genre.id}
                    selected={selected}
                    count={count('genres', genre.id)}
                    onClick={() =>
                      patch({
                        genres: {
                          ids: selected ? ids.filter((id) => id !== genre.id) : [...ids, genre.id],
                          mode: filters.genres?.mode ?? 'any'
                        }
                      })
                    }
                  >
                    {genre.name}
                  </Chip>
                )
              })}
            </ChipRow>
          </CollapsibleSection>
        )}

        {visible('platforms') && platformChips.length > 0 && (
          <CollapsibleSection
            title={t('filters.platforms')}
            count={filters.platforms?.length}
            storageKey="f.platforms"
          >
            <ChipRow>
              {platformChips.map((platform) => (
                <Chip
                  key={platform.id}
                  selected={filters.platforms?.includes(platform.id) ?? false}
                  count={count('platforms', platform.id)}
                  onClick={() => patch({ platforms: toggleIn(filters.platforms, platform.id) })}
                >
                  {platform.shortName}
                </Chip>
              ))}
            </ChipRow>
          </CollapsibleSection>
        )}

        {/* Секция «Моя платформа» убрана по требованию пользователя: дублировала
            «Платформу». Поле `myPlatforms` в схеме и на backend осталось — старые
            пресеты с ним продолжают работать. */}

        {visible('modes') && modeChips.length > 0 && (
          <CollapsibleSection
            title={t('filters.modes')}
            count={filters.modes?.length}
            storageKey="f.modes"
          >
            <ChipRow>
              {modeChips.map((mode) => (
                <Chip
                  key={mode.id}
                  selected={filters.modes?.includes(mode.id) ?? false}
                  count={count('modes', mode.id)}
                  onClick={() => patch({ modes: toggleIn(filters.modes, mode.id) })}
                >
                  {mode.name}
                </Chip>
              ))}
            </ChipRow>
          </CollapsibleSection>
        )}

        {visible('developers') && developerItems.length > 0 && (
          <CollapsibleSection
            title={t('role.developer')}
            count={filters.developers?.length}
            storageKey="f.developers"
          >
            <Combobox
              multiple
              items={developerItems}
              value={filters.developers ?? []}
              onChange={(value) => patch({ developers: normalizeMulti(value) })}
              placeholder={t('filters.pickCompany')}
            />
          </CollapsibleSection>
        )}

        {visible('publishers') && publisherItems.length > 0 && (
          <CollapsibleSection
            title={t('role.publisher')}
            count={filters.publishers?.length}
            storageKey="f.publishers"
          >
            <Combobox
              multiple
              items={publisherItems}
              value={filters.publishers ?? []}
              onChange={(value) => patch({ publishers: normalizeMulti(value) })}
              placeholder={t('filters.pickCompany')}
            />
          </CollapsibleSection>
        )}

        {visible('series') && (series ?? []).length > 0 && (
          <CollapsibleSection
            title={t('nav.series')}
            count={filters.series?.ids.length}
            storageKey="f.series"
          >
            <Combobox
              multiple
              items={(series ?? []).map((s) => ({ value: s.id, label: s.name }))}
              value={filters.series?.ids ?? []}
              onChange={(value) =>
                patch({
                  series: { ids: normalizeMulti(value) ?? [], none: filters.series?.none ?? false }
                })
              }
              placeholder={t('filters.pickSeries')}
            />
            <label
              className="flex items-center gap-2 pt-2 type-small"
              style={{ color: 'var(--text-2)' }}
            >
              <input
                type="checkbox"
                checked={filters.series?.none ?? false}
                onChange={(event) =>
                  patch({ series: { ids: filters.series?.ids ?? [], none: event.target.checked } })
                }
              />
              {t('filters.noSeries')}
            </label>
          </CollapsibleSection>
        )}

        {visible('countries') && (
          <CollapsibleSection
            title={t('filters.country')}
            count={filters.countries?.length}
            storageKey="f.countries"
          >
            <Combobox
              multiple
              items={COUNTRIES.map((country) => ({ value: country.code, label: country.ru }))}
              value={filters.countries ?? []}
              onChange={(value) => patch({ countries: normalizeMulti(value) })}
              placeholder={t('filters.pickCountry')}
            />
          </CollapsibleSection>
        )}

        {visible('metacritic') && (
          <CollapsibleSection title="Metacritic" storageKey="f.metacritic">
            <RangeSlider
              min={0}
              max={100}
              value={[filters.metacritic?.min ?? 0, filters.metacritic?.max ?? 100]}
              onChange={([min, max]) => patch({ metacritic: { ...filters.metacritic, min, max } })}
            />
            <label
              className="flex items-center gap-2 pt-2 type-small"
              style={{ color: 'var(--text-2)' }}
            >
              <input
                type="checkbox"
                checked={filters.metacritic?.includeNull ?? false}
                onChange={(event) =>
                  patch({
                    metacritic: { ...filters.metacritic, includeNull: event.target.checked }
                  })
                }
              />
              {t('filters.includeUnscored')}
            </label>
          </CollapsibleSection>
        )}

        {visible('rating') && (
          <CollapsibleSection title={t('filters.myRating')} storageKey="f.rating">
            <RangeSlider
              min={1}
              max={10}
              value={[filters.rating?.min ?? 1, filters.rating?.max ?? 10]}
              onChange={([min, max]) => patch({ rating: { ...filters.rating, min, max } })}
              formatValue={(value) => `${value / 2}★`}
            />
          </CollapsibleSection>
        )}

        {visible('playtime') && (
          <CollapsibleSection title={t('filters.playtime')} storageKey="f.playtime">
            <RangeSlider
              min={0}
              max={200}
              value={[
                Math.round((filters.playtime?.minMin ?? 0) / 60),
                Math.round((filters.playtime?.maxMin ?? 200 * 60) / 60)
              ]}
              onChange={([min, max]) =>
                patch({ playtime: { minMin: min * 60, maxMin: max >= 200 ? null : max * 60 } })
              }
              formatValue={(value) => `${value} ч`}
            />
          </CollapsibleSection>
        )}

        {visible('hltb') && (
          <CollapsibleSection
            title={t('filters.hltb')}
            count={filters.hltb?.length}
            storageKey="f.hltb"
          >
            <ChipRow>
              {HLTB_BUCKETS.filter((bucket) =>
                hasMatches('hltb', bucket, filters.hltb?.includes(bucket) ?? false)
              ).map((bucket) => (
                <Chip
                  key={bucket}
                  selected={filters.hltb?.includes(bucket) ?? false}
                  count={count('hltb', bucket)}
                  onClick={() => patch({ hltb: toggleIn(filters.hltb, bucket) })}
                >
                  {t(`filters.hltb.${bucket}`)}
                </Chip>
              ))}
            </ChipRow>
          </CollapsibleSection>
        )}

        {visible('category') && (
          <CollapsibleSection
            title={t('filters.category')}
            count={filters.category?.length}
            storageKey="f.category"
          >
            <ChipRow>
              {GAME_CATEGORIES.filter((category) =>
                hasMatches('category', category, filters.category?.includes(category) ?? false)
              ).map((category) => (
                <Chip
                  key={category}
                  selected={filters.category?.includes(category) ?? false}
                  count={count('category', category)}
                  onClick={() => patch({ category: toggleIn(filters.category, category) })}
                >
                  {t(`category.${category}`)}
                </Chip>
              ))}
            </ChipRow>
          </CollapsibleSection>
        )}

        {visible('releaseStatus') && (
          <CollapsibleSection
            title={t('filters.releaseStatus')}
            count={filters.releaseStatus?.length}
            storageKey="f.releaseStatus"
          >
            <ChipRow>
              {RELEASE_STATUSES.filter((status) =>
                hasMatches(
                  'releaseStatus',
                  status,
                  filters.releaseStatus?.includes(status) ?? false
                )
              ).map((status) => (
                <Chip
                  key={status}
                  selected={filters.releaseStatus?.includes(status) ?? false}
                  count={count('releaseStatus', status)}
                  onClick={() => patch({ releaseStatus: toggleIn(filters.releaseStatus, status) })}
                >
                  {t(`releaseStatus.${status}`)}
                </Chip>
              ))}
            </ChipRow>
          </CollapsibleSection>
        )}

        {visible('ownership') && (
          <CollapsibleSection
            title={t('filters.ownership')}
            count={filters.ownership?.length}
            storageKey="f.ownership"
          >
            <ChipRow>
              {OWNERSHIPS.filter((value) => value !== 'unknown')
                .filter((ownership) =>
                  hasMatches(
                    'ownership',
                    ownership,
                    filters.ownership?.includes(ownership) ?? false
                  )
                )
                .map((ownership) => (
                  <Chip
                    key={ownership}
                    selected={filters.ownership?.includes(ownership) ?? false}
                    count={count('ownership', ownership)}
                    onClick={() => patch({ ownership: toggleIn(filters.ownership, ownership) })}
                  >
                    {t(`ownership.${ownership}`)}
                  </Chip>
                ))}
            </ChipRow>
          </CollapsibleSection>
        )}

        {visible('tags') && tagChips.length > 0 && (
          <CollapsibleSection
            title={t('catalog.entity.tags')}
            count={filters.tags?.length}
            storageKey="f.tags"
          >
            <ChipRow>
              {tagChips.map((tag) => (
                <Chip
                  key={tag.id}
                  selected={filters.tags?.includes(tag.id) ?? false}
                  count={count('tags', tag.id)}
                  onClick={() => patch({ tags: toggleIn(filters.tags, tag.id) })}
                >
                  {tag.name}
                </Chip>
              ))}
            </ChipRow>
          </CollapsibleSection>
        )}

        {visible('lists') && (lists ?? []).length > 0 && (
          <CollapsibleSection
            title={t('nav.lists')}
            count={filters.lists?.in?.length}
            storageKey="f.lists"
          >
            <Combobox
              multiple
              items={(lists ?? []).map((list) => ({ value: list.id, label: list.name }))}
              value={filters.lists?.in ?? []}
              onChange={(value) =>
                patch({ lists: { ...filters.lists, in: normalizeMulti(value) ?? [] } })
              }
              placeholder={t('filters.inList')}
            />
          </CollapsibleSection>
        )}

        {visible('dates') && (
          <CollapsibleSection title={t('filters.dates')} storageKey="f.dates">
            {/* Подпись над полями: в строке из трёх элементов поля `type=date`
                обрезали год и иконку календаря при ширине панели. */}
            {(['added', 'started', 'finished'] as const).map((kind) => (
              <div key={kind} className="flex flex-col gap-1 pb-2">
                <span className="type-small" style={{ color: 'var(--text-2)' }}>
                  {t(`filters.date.${kind}`)}
                </span>
                <div className="flex items-center gap-2">
                  <Input
                    type="date"
                    value={filters.dates?.[kind]?.from ?? ''}
                    onChange={(event) =>
                      patch({
                        dates: {
                          ...filters.dates,
                          [kind]: { ...filters.dates?.[kind], from: event.target.value || null }
                        }
                      })
                    }
                  />
                  <Input
                    type="date"
                    value={filters.dates?.[kind]?.to ?? ''}
                    onChange={(event) =>
                      patch({
                        dates: {
                          ...filters.dates,
                          [kind]: { ...filters.dates?.[kind], to: event.target.value || null }
                        }
                      })
                    }
                  />
                </div>
              </div>
            ))}
          </CollapsibleSection>
        )}
      </div>

      <footer className="px-4 py-3" style={{ borderTop: '1px solid var(--border-1)' }}>
        <Button variant="primary" className="w-full" onClick={onApplyClose}>
          {t('filters.show', { count: total })}
        </Button>
      </footer>
    </aside>
  )
}

function ChipRow({ children }: { children: React.ReactNode }): React.ReactElement {
  return <div className="flex flex-wrap gap-1.5">{children}</div>
}

/** `Combobox` в мультирежиме отдаёт `T | T[]`; фильтры хранят массив либо `undefined`. */
function normalizeMulti<T extends string>(value: T | T[]): T[] | undefined {
  const list = Array.isArray(value) ? value : [value]
  return list.length > 0 ? list : undefined
}

/** Все статусы — для проверки полноты набора чипов (07 §7 секция 2). */
export const ALL_STATUS_CHIPS = GAME_STATUSES
