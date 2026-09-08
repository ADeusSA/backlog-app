/**
 * Правила предпросмотра импорта (08 §3 п. 2): какие поля показываем в диалоге
 * «Сейчас в форме / Из источника», как считаем текущее значение и как применяем новое.
 *
 * Здесь же живёт сопоставление связанных сущностей с каталогом: всё, что не нашлось
 * по slug или имени, помечается как «будет создано» и уходит в `createEntities`,
 * а создаётся уже backend'ом при сохранении формы.
 */
import type { GameInput } from '@shared/schema/entities'
import type { CanonicalGame, CreateEntities, NamedRef } from '@shared/schema/providers'
import type { CompanyDto, GenreDto, ModeDto, PlatformDto, SeriesDto, TagDto } from '@shared/schema/entities'

/** Справочники каталога, против которых сопоставляем имена из источника. */
export interface Catalogs {
  companies: CompanyDto[]
  genres: GenreDto[]
  platforms: PlatformDto[]
  modes: ModeDto[]
  tags: TagDto[]
  series: SeriesDto[]
}

export interface MatchedRef extends NamedRef {
  /** id в каталоге либо `null`, если такой записи ещё нет. */
  id: string | null
  /** Имя, под которым запись уже есть в каталоге («Экшен» вместо «Action»). */
  catalogName: string | null
}

const lower = (value: string): string => value.trim().toLowerCase()

function matchBySlug<T extends { id: string; name: string; slug: string }>(items: T[], ref: NamedRef): MatchedRef {
  const found =
    items.find((item) => item.slug === ref.slug) ?? items.find((item) => lower(item.name) === lower(ref.name))
  return { ...ref, id: found?.id ?? null, catalogName: found?.name ?? null }
}

function matchByName<T extends { id: string; name: string }>(
  items: T[],
  ref: NamedRef,
  alternate?: (item: T) => string
): MatchedRef {
  const found =
    items.find((item) => lower(item.name) === lower(ref.name)) ??
    (alternate ? items.find((item) => lower(alternate(item)) === lower(ref.name)) : undefined)
  return { ...ref, id: found?.id ?? null, catalogName: found?.name ?? null }
}

/** Разбор всех связанных сущностей игры на «нашлось» и «будет создано». */
export function matchEntities(game: CanonicalGame, catalogs: Catalogs): {
  developers: MatchedRef[]
  publishers: MatchedRef[]
  genres: MatchedRef[]
  platforms: MatchedRef[]
  modes: MatchedRef[]
  tags: MatchedRef[]
  series: MatchedRef | null
} {
  return {
    developers: game.developers.map((ref) => matchBySlug(catalogs.companies, ref)),
    publishers: game.publishers.map((ref) => matchBySlug(catalogs.companies, ref)),
    genres: game.genres.map((ref) => matchBySlug(catalogs.genres, ref)),
    platforms: game.platforms.map((ref) => matchByName(catalogs.platforms, ref, (p) => p.shortName)),
    modes: game.modes.map((ref) => matchBySlug(catalogs.modes, ref)),
    tags: game.tags.map((ref) => matchByName(catalogs.tags, ref)),
    series: game.series ? matchBySlug(catalogs.series, game.series) : null
  }
}

export type FieldKind = 'text' | 'longText' | 'number' | 'list' | 'image' | 'enum'

/** Идентификаторы строк диалога; они же пишутся в `field_provenance`. */
export type FieldId =
  | 'title'
  | 'altTitles'
  | 'category'
  | 'releaseDate'
  | 'releaseStatus'
  | 'summary'
  | 'storyline'
  | 'ageRating'
  | 'website'
  | 'metacriticScore'
  | 'hltb'
  | 'developers'
  | 'publishers'
  | 'genres'
  | 'platforms'
  | 'modes'
  | 'tags'
  | 'series'
  | 'coverImageId'
  | 'backdropImageId'
  | 'logoImageId'

export interface FieldRow {
  id: FieldId
  kind: FieldKind
  /** Ключ i18n подписи строки. */
  labelKey: string
  /** Что уже введено в форме — строкой для показа. */
  current: string
  /** Что предлагает источник — строкой для показа. */
  incoming: string
  /** Ссылка на картинку у провайдера (только для `kind === 'image'`). */
  imageUrl?: string | null
  /** Записи, которых нет в каталоге, — для пометки «будет создано». */
  createsNew?: string[]
  /** Отмечено ли по умолчанию: пустое поле формы — да, заполненное — нет (08 §3 п. 2). */
  defaultChecked: boolean
}

function refsToText(refs: MatchedRef[]): string {
  return refs.map((ref) => ref.catalogName ?? ref.name).join(', ')
}

function hours(minutes: number | null | undefined): string | null {
  if (!minutes) return null
  return `${(minutes / 60).toFixed(1).replace('.0', '')} ч`
}

function hltbText(game: Pick<CanonicalGame, 'hltbMainMin' | 'hltbExtraMin' | 'hltbCompleteMin'>): string {
  const parts = [hours(game.hltbMainMin), hours(game.hltbExtraMin), hours(game.hltbCompleteMin)]
  return parts.every((p) => p === null) ? '' : parts.map((p) => p ?? '—').join(' / ')
}

/**
 * Строит список строк предпросмотра. Пустые у источника поля не показываем вовсе —
 * иначе диалог превращается в стену прочерков.
 */
export function buildRows(
  game: CanonicalGame,
  form: GameInput,
  matched: ReturnType<typeof matchEntities>,
  catalogs: Catalogs,
  currentImages: { cover: string | null; backdrop: string | null; logo: string | null }
): FieldRow[] {
  const rows: FieldRow[] = []

  /** Числовые поля формы приходят из `valueAsNumber` и на пустом вводе равны NaN. */
  const asText = (value: unknown): string =>
    value == null || value === '' || (typeof value === 'number' && Number.isNaN(value)) ? '' : String(value)

  const addText = (id: FieldId, labelKey: string, current: unknown, incoming: unknown, kind: FieldKind = 'text'): void => {
    const incomingText = asText(incoming)
    if (!incomingText) return
    const currentText = asText(current)
    // Одинаковые значения в диалоге не показываем: применять там нечего.
    if (currentText === incomingText) return
    rows.push({ id, kind, labelKey, current: currentText, incoming: incomingText, defaultChecked: !currentText })
  }

  addText('title', 'catalog.form.title', form.title, game.title)
  addText('altTitles', 'catalog.form.altTitles', (form.altTitles ?? []).join(', '), game.altTitles.join(', '), 'list')
  addText('category', 'catalog.form.category', form.category, game.category, 'enum')
  addText('releaseDate', 'catalog.form.releaseDate', form.releaseDate, game.releaseDate)
  addText('releaseStatus', 'catalog.form.releaseStatus', form.releaseStatus, game.releaseStatus, 'enum')
  addText('summary', 'catalog.form.summary', form.summary, game.summary, 'longText')
  addText('storyline', 'catalog.form.storyline', form.storyline, game.storyline, 'longText')
  addText('ageRating', 'catalog.form.ageRating', form.ageRating, game.ageRating)
  addText('website', 'catalog.form.website', form.website, game.website)
  addText('metacriticScore', 'catalog.import.field.metacritic', form.metacriticScore, game.metacriticScore, 'number')
  addText(
    'hltb',
    'catalog.import.field.hltb',
    hltbText({ hltbMainMin: form.hltbMainMin, hltbExtraMin: form.hltbExtraMin, hltbCompleteMin: form.hltbCompleteMin }),
    hltbText(game),
    'number'
  )

  const addRefs = (id: FieldId, labelKey: string, refs: MatchedRef[], currentIds: string[] | undefined, all: Array<{ id: string; name: string }>): void => {
    if (refs.length === 0) return
    const current = (currentIds ?? []).map((cid) => all.find((item) => item.id === cid)?.name ?? '').filter(Boolean)
    const incoming = refsToText(refs)
    if (current.join(', ') === incoming) return
    rows.push({
      id,
      kind: 'list',
      labelKey,
      current: current.join(', '),
      incoming,
      createsNew: refs.filter((ref) => ref.id === null).map((ref) => ref.name),
      defaultChecked: current.length === 0
    })
  }

  addRefs('developers', 'role.developer', matched.developers, form.developerIds, catalogs.companies)
  addRefs('publishers', 'role.publisher', matched.publishers, form.publisherIds, catalogs.companies)
  addRefs('genres', 'catalog.entity.genres', matched.genres, form.genreIds, catalogs.genres)
  addRefs('platforms', 'catalog.entity.platforms', matched.platforms, form.platformIds, catalogs.platforms)
  addRefs('modes', 'catalog.form.modes', matched.modes, form.modeIds, catalogs.modes)
  addRefs('tags', 'catalog.entity.tags', matched.tags, form.tagIds, catalogs.tags)

  if (matched.series) {
    const currentName = catalogs.series.find((s) => s.id === form.seriesId)?.name ?? ''
    rows.push({
      id: 'series',
      kind: 'list',
      labelKey: 'nav.series',
      current: currentName,
      incoming: matched.series.catalogName ?? matched.series.name,
      createsNew: matched.series.id === null ? [matched.series.name] : [],
      defaultChecked: !currentName
    })
  }

  const addImage = (id: FieldId, labelKey: string, url: string | null | undefined, current: string | null): void => {
    if (!url) return
    rows.push({
      id,
      kind: 'image',
      labelKey,
      current: current ? 'set' : '',
      incoming: url,
      imageUrl: url,
      defaultChecked: !current
    })
  }

  addImage('coverImageId', 'catalog.form.cover', game.images.cover, currentImages.cover)
  addImage('backdropImageId', 'catalog.form.backdrop', game.images.backdrop, currentImages.backdrop)
  addImage('logoImageId', 'catalog.form.logo', game.images.logo, currentImages.logo)

  return rows
}

/** Значения нетекстовых полей, которые применяются вместе с отмеченной строкой. */
export interface ApplyResult {
  /** Патч простых полей формы. */
  patch: Partial<GameInput>
  /** Идентификаторы каталога по типам связей. */
  ids: {
    developerIds?: string[]
    publisherIds?: string[]
    genreIds?: string[]
    platformIds?: string[]
    modeIds?: string[]
    tagIds?: string[]
    seriesId?: string | null
  }
  /** Имена, которых нет в каталоге, — их создаст backend при сохранении. */
  create: CreateEntities
  /** Картинки, которые надо скачать и сохранить: поле формы → ссылка. */
  images: Array<{ field: 'coverImageId' | 'backdropImageId' | 'logoImageId'; url: string }>
}

/** Объединяет наборы «создать при сохранении» из нескольких применённых импортов. */
export function mergeCreate(prev: CreateEntities | null, next: CreateEntities): CreateEntities {
  if (!prev) return next
  const union = (a: NamedRef[], b: NamedRef[]): NamedRef[] => {
    const seen = new Set(a.map((ref) => ref.slug))
    return [...a, ...b.filter((ref) => !seen.has(ref.slug))]
  }
  return {
    developers: union(prev.developers, next.developers),
    publishers: union(prev.publishers, next.publishers),
    genres: union(prev.genres, next.genres),
    platforms: union(prev.platforms, next.platforms),
    modes: union(prev.modes, next.modes),
    tags: union(prev.tags, next.tags),
    series: next.series ?? prev.series ?? null
  }
}

const EMPTY_CREATE: CreateEntities = {
  developers: [],
  publishers: [],
  genres: [],
  platforms: [],
  modes: [],
  tags: [],
  series: null
}

/** Собирает изменения по отмеченным строкам. */
export function applyRows(
  game: CanonicalGame,
  matched: ReturnType<typeof matchEntities>,
  selected: Set<FieldId>
): ApplyResult {
  const result: ApplyResult = { patch: {}, ids: {}, create: { ...EMPTY_CREATE }, images: [] }

  const takeRefs = (
    refs: MatchedRef[],
    idsKey: keyof ApplyResult['ids'],
    createKey: keyof Omit<CreateEntities, 'series'>
  ): void => {
    result.ids[idsKey] = refs.filter((ref) => ref.id).map((ref) => ref.id as string) as never
    result.create[createKey] = refs.filter((ref) => !ref.id).map(({ slug, name }) => ({ slug, name }))
  }

  if (selected.has('title') && game.title) result.patch.title = game.title
  if (selected.has('altTitles')) result.patch.altTitles = game.altTitles
  if (selected.has('category') && game.category) result.patch.category = game.category
  if (selected.has('releaseDate')) {
    result.patch.releaseDate = game.releaseDate ?? null
    result.patch.releaseDatePrecision = game.releaseDatePrecision ?? 'day'
  }
  if (selected.has('releaseStatus') && game.releaseStatus) result.patch.releaseStatus = game.releaseStatus
  if (selected.has('summary')) result.patch.summary = game.summary ?? null
  if (selected.has('storyline')) result.patch.storyline = game.storyline ?? null
  if (selected.has('ageRating')) result.patch.ageRating = game.ageRating ?? null
  if (selected.has('website')) result.patch.website = game.website ?? null
  if (selected.has('metacriticScore')) {
    result.patch.metacriticScore = game.metacriticScore ?? null
    result.patch.metacriticUrl = game.metacriticUrl ?? null
  }
  if (selected.has('hltb')) {
    result.patch.hltbMainMin = game.hltbMainMin ?? null
    result.patch.hltbExtraMin = game.hltbExtraMin ?? null
    result.patch.hltbCompleteMin = game.hltbCompleteMin ?? null
  }

  if (selected.has('developers')) takeRefs(matched.developers, 'developerIds', 'developers')
  if (selected.has('publishers')) takeRefs(matched.publishers, 'publisherIds', 'publishers')
  if (selected.has('genres')) takeRefs(matched.genres, 'genreIds', 'genres')
  if (selected.has('platforms')) takeRefs(matched.platforms, 'platformIds', 'platforms')
  if (selected.has('modes')) takeRefs(matched.modes, 'modeIds', 'modes')
  if (selected.has('tags')) takeRefs(matched.tags, 'tagIds', 'tags')
  if (selected.has('series') && matched.series) {
    if (matched.series.id) result.ids.seriesId = matched.series.id
    else result.create.series = { slug: matched.series.slug, name: matched.series.name }
  }

  for (const field of ['coverImageId', 'backdropImageId', 'logoImageId'] as const) {
    if (!selected.has(field)) continue
    const url =
      field === 'coverImageId' ? game.images.cover : field === 'backdropImageId' ? game.images.backdrop : game.images.logo
    if (url) result.images.push({ field, url })
  }

  return result
}
