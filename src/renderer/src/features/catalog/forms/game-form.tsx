import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Controller, useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Save } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  CATEGORIES_WITH_PARENT,
  GAME_CATEGORIES,
  GAME_STATUSES,
  PLATFORM_FAMILIES,
  RELEASE_DATE_PRECISIONS,
  RELEASE_STATUSES,
  type GameCategory,
  type GameStatus,
  type ImportProvider,
  type ReleaseStatus
} from '@shared/constants'
import { gameInputSchema, type GameInput } from '@shared/schema/entities'
import type { CanonicalGame, CreateEntities, ImportProvenance } from '@shared/schema/providers'
import { makeSortTitle } from '@shared/text'
import { Button } from '@/components/ui/button'
import { Input, Textarea } from '@/components/ui/input'
import { Chip } from '@/components/ui/chip'
import { Combobox } from '@/components/ui/combobox'
import { Segmented } from '@/components/ui/segmented'
import { Checkbox } from '@/components/ui/checkbox'
import { toast } from '@/components/ui/toast'
import { ImagePicker } from '../components/image-picker'
import { ImportPanel } from '../import/import-panel'
import { ImportPreviewDialog } from '../import/import-preview-dialog'
import { mergeCreate, type ApplyResult } from '../import/fields'
import { bytesFromUrl, saveImage as saveImageFile } from '@/lib/image-pipeline'
import { call } from '@/platform/api'
import { optionalNumber, single, singleRequired } from '@/lib/form-utils'

interface Props {
  gameId?: string
}

const EMPTY: GameInput = {
  title: '',
  altTitles: [],
  category: 'main',
  releaseDatePrecision: 'day',
  releaseStatus: 'released',
  developerIds: [],
  publisherIds: [],
  supportingIds: [],
  portingIds: [],
  genreIds: [],
  platformIds: [],
  modeIds: [],
  tagIds: [],
  addToLibrary: true,
  addStatus: 'backlog'
}

/** Форма игры (ТЗ 06 §7.3). */
export function GameForm({ gameId }: Props): React.ReactElement {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [altInput, setAltInput] = useState('')
  const [coverFile, setCoverFile] = useState<string | null>(null)
  const [backdropFile, setBackdropFile] = useState<string | null>(null)
  const [logoFile, setLogoFile] = useState<string | null>(null)

  const { data: existing } = useQuery({
    queryKey: ['catalog', 'game', gameId],
    queryFn: () => call('catalog.games.get', { id: gameId! }),
    enabled: Boolean(gameId)
  })
  const { data: companies } = useQuery({ queryKey: ['companies'], queryFn: () => call('companies.list') })
  const { data: genres } = useQuery({ queryKey: ['catalog', 'genres'], queryFn: () => call('catalog.genres.list') })
  const { data: platforms } = useQuery({
    queryKey: ['catalog', 'platforms'],
    queryFn: () => call('catalog.platforms.list')
  })
  const { data: modes } = useQuery({ queryKey: ['catalog', 'modes'], queryFn: () => call('catalog.modes.list') })
  const { data: tags } = useQuery({ queryKey: ['catalog', 'tags'], queryFn: () => call('catalog.tags.list') })
  const { data: series } = useQuery({ queryKey: ['series'], queryFn: () => call('series.list') })

  // Схема имеет значения по умолчанию, поэтому её вход и выход различаются —
  // форма работает с выходным типом, резолвер приводится к нему явно.
  const form = useForm<GameInput>({
    resolver: zodResolver(gameInputSchema) as unknown as Resolver<GameInput>,
    defaultValues: EMPTY,
    // Не `onBlur`: над формой стоит панель импорта, и клик в её поиск уводил фокус
    // из ещё не заполненного «Названия» — форма ругалась, не дав ничего ввести.
    // Проверяем при отправке, дальше — на каждое изменение.
    mode: 'onSubmit',
    reValidateMode: 'onChange'
  })
  const { register, handleSubmit, control, watch, setValue, reset, formState } = form

  // Имена файлов уже сохранённых изображений нужны для предпросмотра в форме:
  // `catalog.games.get` отдаёт только идентификаторы.
  const { data: detail } = useQuery({
    queryKey: ['game', gameId],
    queryFn: () => call('games.getDetail', { id: gameId! }),
    enabled: Boolean(gameId)
  })

  useEffect(() => {
    if (existing) reset(existing)
  }, [existing, reset])

  useEffect(() => {
    if (!detail) return
    setCoverFile(detail.coverFile)
    setBackdropFile(detail.backdropFile)
    setLogoFile(detail.logoFile)
  }, [detail])

  const title = watch('title')
  const category = watch('category')
  const altTitles = watch('altTitles')

  // Похожие названия — защита от дублей (06 §7.3)
  const { data: similar } = useQuery({
    queryKey: ['catalog', 'similar', title],
    queryFn: () => call('catalog.games.similar', { title, ...(gameId ? { excludeId: gameId } : {}) }),
    enabled: title.trim().length >= 3
  })

  const companyOptions = useMemo(
    () => (companies ?? []).map((c) => ({ value: c.id, label: c.name })),
    [companies]
  )

  /* ------------------------------------------------ импорт из источника (08 §3) */

  const [importGame, setImportGame] = useState<CanonicalGame | null>(null)
  const [importing, setImporting] = useState(false)
  const [applying, setApplying] = useState(false)
  // Накапливаем по всем применённым импортам: имена для создания и источники полей.
  const [createEntities, setCreateEntities] = useState<CreateEntities | null>(null)
  const [provenance, setProvenance] = useState<ImportProvenance[]>([])

  const pickFromProvider = async (provider: ImportProvider, externalId: string): Promise<void> => {
    setImporting(true)
    try {
      setImportGame(await call('providers.fetch', { provider, externalId }))
    } catch (err) {
      toast({ title: (err as Error).message, tone: 'danger' })
    } finally {
      setImporting(false)
    }
  }

  const applyImport = async (result: ApplyResult, fields: string[]): Promise<void> => {
    if (!importGame) return
    setApplying(true)
    try {
      for (const [key, value] of Object.entries(result.patch)) {
        setValue(key as keyof GameInput, value as never, { shouldDirty: true, shouldValidate: true })
      }
      for (const [key, value] of Object.entries(result.ids)) {
        setValue(key as keyof GameInput, value as never, { shouldDirty: true, shouldValidate: true })
      }

      // Картинки: main скачивает байты, renderer конвертирует в WebP и сохраняет (01 §7).
      for (const image of result.images) {
        const kind = image.field === 'coverImageId' ? 'cover' : image.field === 'backdropImageId' ? 'backdrop' : 'logo'
        const saved = await saveImageFile(await bytesFromUrl(image.url), {
          kind,
          keepAlpha: kind === 'logo',
          sourceUrl: image.url
        })
        setValue(image.field, saved.id, { shouldDirty: true, shouldValidate: true })
        if (image.field === 'coverImageId') setCoverFile(saved.fileName)
        if (image.field === 'backdropImageId') setBackdropFile(saved.fileName)
        if (image.field === 'logoImageId') setLogoFile(saved.fileName)
      }

      setCreateEntities((prev) => mergeCreate(prev, result.create))
      setProvenance((prev) => [
        ...prev.filter((item) => item.provider !== importGame.provider),
        {
          provider: importGame.provider,
          externalId: importGame.externalId,
          url: importGame.url ?? null,
          rawHash: importGame.rawHash,
          rawJson: importGame.rawJson,
          fields
        }
      ])

      setImportGame(null)
      toast({ title: t('catalog.import.applied', { count: fields.length }), tone: 'success' })
    } catch (err) {
      toast({ title: (err as Error).message, tone: 'danger' })
    } finally {
      setApplying(false)
    }
  }

  /** Добавляет к значениям формы то, что должен создать backend при сохранении. */
  const withImport = (values: GameInput): GameInput => ({
    ...values,
    ...(createEntities ? { createEntities } : {}),
    ...(provenance.length > 0 ? { provenance } : {})
  })

  const submit = handleSubmit(async (values) => {
    try {
      const saved = await call('catalog.games.save', withImport(values))
      await queryClient.invalidateQueries()
      toast({ title: t('catalog.saved'), tone: 'success' })
      await navigate({ to: '/games/$gameId', params: { gameId: saved.id } })
    } catch (err) {
      toast({ title: (err as Error).message, tone: 'danger' })
    }
  })

  const saveAndNew = handleSubmit(async (values) => {
    try {
      await call('catalog.games.save', withImport(values))
      await queryClient.invalidateQueries()
      toast({ title: t('catalog.saved'), tone: 'success' })
      setCreateEntities(null)
      setProvenance([])
      // Связи «разработчик/серия/платформы» остаются для следующей игры (06 §7.3)
      reset({
        ...EMPTY,
        developerIds: values.developerIds,
        publisherIds: values.publisherIds,
        platformIds: values.platformIds,
        seriesId: values.seriesId ?? null
      })
      setCoverFile(null)
      setBackdropFile(null)
      setLogoFile(null)
    } catch (err) {
      toast({ title: (err as Error).message, tone: 'danger' })
    }
  })

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        void submit()
      }}
      className="flex min-h-0 flex-1 flex-col"
    >
      <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto pb-6">
        {/* Заполнение из внешнего источника (06 §7.3, 08 §3) */}
        <ImportPanel title={title} onPick={pickFromProvider} loading={importing} />

        <Section title={t('catalog.form.main')}>
          {/* Сообщение zod приходит по-английски («Too small: expected string…») —
              показываем свою локализованную подсказку. */}
          <Field label={t('catalog.form.title')} error={formState.errors.title ? t('catalog.form.required') : undefined}>
            <Input
              {...register('title', {
                onBlur: (event: React.FocusEvent<HTMLInputElement>) => {
                  if (!watch('sortTitle')) setValue('sortTitle', makeSortTitle(event.target.value))
                }
              })}
              autoFocus
              invalid={Boolean(formState.errors.title)}
            />
          </Field>
          {(similar?.length ?? 0) > 0 && (
            <p className="type-small" style={{ color: 'var(--warning)' }}>
              {t('catalog.form.similar')}: {similar?.map((s) => `${s.title}${s.releaseYear ? ` (${s.releaseYear})` : ''}`).join(', ')}
            </p>
          )}

          <Field label={t('catalog.form.altTitles')}>
            <div className="flex flex-wrap items-center gap-1.5">
              {altTitles.map((alt) => (
                <Chip
                  key={alt}
                  selected
                  onRemove={() =>
                    setValue(
                      'altTitles',
                      altTitles.filter((value) => value !== alt)
                    )
                  }
                >
                  {alt}
                </Chip>
              ))}
              <Input
                value={altInput}
                onChange={(event) => setAltInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && altInput.trim()) {
                    event.preventDefault()
                    setValue('altTitles', [...altTitles, altInput.trim()])
                    setAltInput('')
                  }
                }}
                placeholder={t('catalog.form.altTitlesHint')}
                className="w-[220px]"
              />
            </div>
          </Field>

          <Field label={t('catalog.form.sortTitle')}>
            <Input {...register('sortTitle')} />
          </Field>

          <Field label={t('catalog.form.category')}>
            <Controller
              control={control}
              name="category"
              render={({ field }) => (
                <Combobox<GameCategory>
                  items={GAME_CATEGORIES.map((value) => ({ value, label: t(`category.${value}`) }))}
                  value={field.value}
                  onChange={singleRequired<GameCategory>(field.onChange, 'main')}
                />
              )}
            />
          </Field>

          {CATEGORIES_WITH_PARENT.includes(category) && (
            <Field label={t('catalog.form.parentGame')}>
              <Controller
                control={control}
                name="parentGameId"
                render={({ field }) => (
                  <GameSearchCombobox value={field.value ?? null} onChange={field.onChange} excludeId={gameId} />
                )}
              />
            </Field>
          )}
        </Section>

        <Section title={t('catalog.form.release')}>
          <div className="flex flex-wrap gap-3">
            <Field label={t('catalog.form.releaseDate')}>
              <Input {...register('releaseDate')} placeholder="2022-02-24" className="w-[160px]" />
            </Field>
            <Field label={t('catalog.form.precision')}>
              <Controller
                control={control}
                name="releaseDatePrecision"
                render={({ field }) => (
                  <Segmented
                    value={field.value}
                    onChange={field.onChange}
                    options={RELEASE_DATE_PRECISIONS.map((value) => ({
                      value,
                      label: t(`catalog.precision.${value}`)
                    }))}
                  />
                )}
              />
            </Field>
            <Field label={t('catalog.form.releaseStatus')}>
              <Controller
                control={control}
                name="releaseStatus"
                render={({ field }) => (
                  <Combobox<ReleaseStatus>
                    items={RELEASE_STATUSES.map((value) => ({ value, label: t(`releaseStatus.${value}`) }))}
                    value={field.value}
                    onChange={singleRequired<ReleaseStatus>(field.onChange, 'released')}
                  />
                )}
              />
            </Field>
            <Field label={t('catalog.form.ageRating')}>
              <Input {...register('ageRating')} placeholder="PEGI 18" className="w-[140px]" />
            </Field>
          </div>
        </Section>

        <Section title={t('catalog.form.description')}>
          <Textarea {...register('summary')} rows={4} placeholder={t('catalog.form.summary')} />
          <Textarea {...register('storyline')} rows={3} placeholder={t('catalog.form.storyline')} />
        </Section>

        <Section title={t('catalog.form.images')}>
          <div className="grid grid-cols-3 gap-4">
            <Controller
              control={control}
              name="coverImageId"
              render={({ field }) => (
                <ImagePicker
                  kind="cover"
                  aspect={0.75}
                  label={t('catalog.form.cover')}
                  value={field.value ?? null}
                  fileName={coverFile}
                  onChange={(id, file) => {
                    field.onChange(id)
                    setCoverFile(file)
                  }}
                />
              )}
            />
            <Controller
              control={control}
              name="backdropImageId"
              render={({ field }) => (
                <ImagePicker
                  kind="backdrop"
                  aspect={16 / 9}
                  label={t('catalog.form.backdrop')}
                  value={field.value ?? null}
                  fileName={backdropFile}
                  onChange={(id, file) => {
                    field.onChange(id)
                    setBackdropFile(file)
                  }}
                />
              )}
            />
            <Controller
              control={control}
              name="logoImageId"
              render={({ field }) => (
                <ImagePicker
                  kind="logo"
                  aspect={0}
                  label={t('catalog.form.logo')}
                  value={field.value ?? null}
                  fileName={logoFile}
                  onChange={(id, file) => {
                    field.onChange(id)
                    setLogoFile(file)
                  }}
                />
              )}
            />
          </div>
        </Section>

        <Section title={t('catalog.form.relations')}>
          <Field label={t('role.developer')}>
            <Controller
              control={control}
              name="developerIds"
              render={({ field }) => (
                <Combobox multiple items={companyOptions} value={field.value} onChange={field.onChange} />
              )}
            />
          </Field>
          <Field label={t('role.publisher')}>
            <Controller
              control={control}
              name="publisherIds"
              render={({ field }) => (
                <Combobox multiple items={companyOptions} value={field.value} onChange={field.onChange} />
              )}
            />
          </Field>
          <div className="flex gap-3">
            <Field label={t('nav.series')}>
              <Controller
                control={control}
                name="seriesId"
                render={({ field }) => (
                  <Combobox
                    items={(series ?? []).map((s) => ({ value: s.id, label: s.name }))}
                    value={field.value ?? null}
                    onChange={single(field.onChange)}
                  />
                )}
              />
            </Field>
            <Field label={t('catalog.form.seriesPosition')}>
              <Input type="number" min={1} {...register('seriesPosition', optionalNumber)} className="w-[100px]" />
            </Field>
          </div>
          <Field label={t('catalog.entity.genres')}>
            <Controller
              control={control}
              name="genreIds"
              render={({ field }) => (
                <Combobox
                  multiple
                  items={(genres ?? []).map((g) => ({ value: g.id, label: g.name }))}
                  value={field.value}
                  onChange={field.onChange}
                />
              )}
            />
          </Field>
          <Field label={t('catalog.form.modes')}>
            <Controller
              control={control}
              name="modeIds"
              render={({ field }) => (
                <Combobox
                  multiple
                  items={(modes ?? []).map((m) => ({ value: m.id, label: m.name }))}
                  value={field.value}
                  onChange={field.onChange}
                />
              )}
            />
          </Field>
          <Field label={t('catalog.entity.platforms')}>
            <Controller
              control={control}
              name="platformIds"
              render={({ field }) => (
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap gap-1.5">
                    {PLATFORM_FAMILIES.map((family) => (
                      <Button
                        key={family}
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const ids = (platforms ?? [])
                            .filter((p) => p.family === family)
                            .map((p) => p.id)
                          const next = new Set([...field.value, ...ids])
                          field.onChange([...next])
                        }}
                      >
                        + {t(`family.${family}`)}
                      </Button>
                    ))}
                  </div>
                  <Combobox
                    multiple
                    items={(platforms ?? []).map((p) => ({ value: p.id, label: p.name }))}
                    value={field.value}
                    onChange={field.onChange}
                  />
                </div>
              )}
            />
          </Field>
          <Field label={t('catalog.entity.tags')}>
            <Controller
              control={control}
              name="tagIds"
              render={({ field }) => (
                <Combobox
                  multiple
                  items={(tags ?? []).map((tag) => ({ value: tag.id, label: tag.name }))}
                  value={field.value}
                  onChange={field.onChange}
                />
              )}
            />
          </Field>
        </Section>

        <Section title={t('catalog.form.scores')}>
          <div className="flex flex-wrap gap-3">
            <Field label="Metacritic">
              <Input type="number" min={0} max={100} {...register('metacriticScore', optionalNumber)} className="w-[100px]" />
            </Field>
            <Field label="Metacritic URL">
              <Input {...register('metacriticUrl')} className="w-[240px]" />
            </Field>
            <Field label="OpenCritic">
              <Input type="number" min={0} max={100} {...register('opencriticScore', optionalNumber)} className="w-[100px]" />
            </Field>
          </div>
          <div className="flex flex-wrap gap-3">
            <Field label={t('catalog.form.hltbMain')}>
              <Input type="number" min={0} {...register('hltbMainMin', optionalNumber)} className="w-[120px]" />
            </Field>
            <Field label={t('catalog.form.hltbExtra')}>
              <Input type="number" min={0} {...register('hltbExtraMin', optionalNumber)} className="w-[120px]" />
            </Field>
            <Field label={t('catalog.form.hltbComplete')}>
              <Input type="number" min={0} {...register('hltbCompleteMin', optionalNumber)} className="w-[120px]" />
            </Field>
            <Field label={t('catalog.form.website')}>
              <Input {...register('website')} className="w-[260px]" />
            </Field>
          </div>
        </Section>

        {!gameId && (
          <Section title={t('nav.library')}>
            <Controller
              control={control}
              name="addToLibrary"
              render={({ field }) => (
                <Checkbox
                  checked={field.value ?? true}
                  onChange={field.onChange}
                  label={t('catalog.form.addToLibrary')}
                />
              )}
            />
            <Controller
              control={control}
              name="addStatus"
              render={({ field }) => (
                <Combobox<GameStatus>
                  items={GAME_STATUSES.map((value) => ({ value, label: t(`status.${value}`) }))}
                  value={field.value ?? 'backlog'}
                  onChange={singleRequired<GameStatus>(field.onChange, 'backlog')}
                />
              )}
            />
          </Section>
        )}
      </div>

      <footer
        className="sticky bottom-0 flex items-center justify-end gap-2 py-3"
        style={{ background: 'var(--bg-0)', borderTop: '1px solid var(--border-1)' }}
      >
        <Button type="button" variant="ghost" onClick={() => void navigate({ to: '/catalog' })}>
          {t('action.cancel')}
        </Button>
        {!gameId && (
          <Button type="button" variant="secondary" onClick={() => void saveAndNew()}>
            {t('catalog.form.saveAndNew')}
          </Button>
        )}
        <Button type="submit" variant="primary" loading={formState.isSubmitting}>
          <Save size={16} strokeWidth={1.75} />
          {t('action.save')}
        </Button>
      </footer>

      <ImportPreviewDialog
        game={importGame}
        form={watch()}
        catalogs={{
          companies: companies ?? [],
          genres: genres ?? [],
          platforms: platforms ?? [],
          modes: modes ?? [],
          tags: tags ?? [],
          series: series ?? []
        }}
        currentImages={{ cover: coverFile, backdrop: backdropFile, logo: logoFile }}
        applying={applying}
        onCancel={() => setImportGame(null)}
        onApply={(result, fields) => void applyImport(result, fields)}
      />
    </form>
  )
}

export function Section({
  title,
  children
}: {
  title: string
  children: React.ReactNode
}): React.ReactElement {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="type-caption">{title}</h2>
      {children}
    </section>
  )
}

export function Field({
  label,
  error,
  children
}: {
  label: string
  error?: string
  children: React.ReactNode
}): React.ReactElement {
  return (
    <label className="flex flex-col gap-1">
      <span className="type-small" style={{ color: 'var(--text-2)' }}>
        {label}
      </span>
      {children}
      {error && (
        <span className="type-small" style={{ color: 'var(--danger)' }}>
          {error}
        </span>
      )}
    </label>
  )
}

/** Поиск игры по каталогу для поля «родительская игра» (06 §7.3). */
function GameSearchCombobox({
  value,
  onChange,
  excludeId
}: {
  value: string | null
  onChange: (value: string | null) => void
  excludeId?: string
}): React.ReactElement {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')

  const { data } = useQuery({
    queryKey: ['games', 'quickSearch', query, excludeId],
    queryFn: () =>
      call('games.quickSearch', {
        q: query,
        limit: 20,
        ...(excludeId ? { excludeIds: [excludeId] } : {})
      }),
    enabled: query.trim().length >= 2
  })

  const { data: current } = useQuery({
    queryKey: ['game', value],
    queryFn: () => call('games.getDetail', { id: value! }),
    enabled: Boolean(value)
  })

  return (
    <div className="flex flex-col gap-1">
      <Input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={t('common.search')}
      />
      {current && (
        <div className="flex items-center gap-2 type-small" style={{ color: 'var(--text-2)' }}>
          <span>{current.title}</span>
          <button type="button" onClick={() => onChange(null)} style={{ color: 'var(--danger)' }}>
            {t('action.delete')}
          </button>
        </div>
      )}
      {(data?.length ?? 0) > 0 && query.trim().length >= 2 && (
        <ul
          className="max-h-[180px] overflow-y-auto rounded-[var(--r-sm)]"
          style={{ background: 'var(--surface-1)', border: '1px solid var(--border-1)' }}
        >
          {data?.map((game) => (
            <li key={game.id}>
              <button
                type="button"
                className="w-full px-2 py-1.5 text-left type-small hover:bg-[var(--surface-2)]"
                onClick={() => {
                  onChange(game.id)
                  setQuery('')
                }}
              >
                {game.title}
                {game.releaseYear ? ` (${game.releaseYear})` : ''}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
