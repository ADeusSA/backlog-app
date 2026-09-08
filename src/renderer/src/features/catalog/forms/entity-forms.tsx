import { useEffect, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Controller, useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Save } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { PLATFORM_FAMILIES, SERIES_KINDS } from '@shared/constants'
import {
  companyInputSchema,
  seriesInputSchema,
  type CompanyInput,
  type SeriesInput
} from '@shared/schema/entities'
import { COUNTRIES } from '@shared/countries'
import { Button } from '@/components/ui/button'
import { Input, Textarea } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Combobox } from '@/components/ui/combobox'
import { Segmented } from '@/components/ui/segmented'
import { toast } from '@/components/ui/toast'
import { ImagePicker } from '../components/image-picker'
import { Field, Section } from './game-form'
import { call } from '@/platform/api'
import { single } from '@/lib/form-utils'

function FormFooter({
  submitting,
  onCancel
}: {
  submitting: boolean
  onCancel: () => void
}): React.ReactElement {
  const { t } = useTranslation()
  return (
    <footer
      className="sticky bottom-0 flex items-center justify-end gap-2 py-3"
      style={{ background: 'var(--bg-0)', borderTop: '1px solid var(--border-1)' }}
    >
      <Button type="button" variant="ghost" onClick={onCancel}>
        {t('action.cancel')}
      </Button>
      <Button type="submit" variant="primary" loading={submitting}>
        <Save size={16} strokeWidth={1.75} />
        {t('action.save')}
      </Button>
    </footer>
  )
}

/** Форма компании (ТЗ 06 §7.4). */
export function CompanyForm({ id }: { id?: string }): React.ReactElement {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: existing } = useQuery({
    queryKey: ['catalog', 'company', id],
    queryFn: () => call('catalog.companies.get', { id: id! }),
    enabled: Boolean(id)
  })
  const { data: companies } = useQuery({ queryKey: ['companies'], queryFn: () => call('companies.list') })
  // Имена файлов для предпросмотра: catalog.companies.get отдаёт только идентификаторы.
  const { data: companyDto } = useQuery({
    queryKey: ['companies', id],
    queryFn: () => call('companies.get', { id: id! }),
    enabled: Boolean(id)
  })
  const [logoFile, setLogoFile] = useState<string | null>(null)
  const [bannerFile, setBannerFile] = useState<string | null>(null)
  useEffect(() => {
    if (!companyDto) return
    setLogoFile(companyDto.logoFile)
    setBannerFile(companyDto.bannerFile)
  }, [companyDto])

  const form = useForm<CompanyInput>({
    resolver: zodResolver(companyInputSchema) as unknown as Resolver<CompanyInput>,
    defaultValues: { name: '', isDeveloper: true, isPublisher: false }
  })
  const { register, control, handleSubmit, reset, formState, watch } = form

  useEffect(() => {
    if (existing) reset(existing)
  }, [existing, reset])

  const submit = handleSubmit(async (values) => {
    try {
      const saved = await call('catalog.companies.save', values)
      await queryClient.invalidateQueries()
      toast({ title: t('catalog.saved'), tone: 'success' })
      await navigate({ to: '/companies/$companyId', params: { companyId: saved.id } })
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
        <Section title={t('catalog.form.main')}>
          <Field label={t('catalog.form.title')} error={formState.errors.name?.message}>
            <Input {...register('name')} autoFocus invalid={Boolean(formState.errors.name)} />
          </Field>
          <div className="flex gap-4">
            <Controller
              control={control}
              name="isDeveloper"
              render={({ field }) => (
                <Checkbox checked={field.value} onChange={field.onChange} label={t('role.developer')} />
              )}
            />
            <Controller
              control={control}
              name="isPublisher"
              render={({ field }) => (
                <Checkbox checked={field.value} onChange={field.onChange} label={t('role.publisher')} />
              )}
            />
          </div>
          {!watch('isDeveloper') && !watch('isPublisher') && (
            <p className="type-small" style={{ color: 'var(--danger)' }}>
              {t('catalog.form.roleRequired')}
            </p>
          )}
          <div className="flex flex-wrap gap-3">
            <Field label={t('catalog.form.country')}>
              <Controller
                control={control}
                name="countryCode"
                render={({ field }) => (
                  <Combobox
                    items={COUNTRIES.map((country) => ({ value: country.code, label: country.ru }))}
                    value={field.value ?? null}
                    onChange={single(field.onChange)}
                  />
                )}
              />
            </Field>
            <Field label={t('catalog.form.city')}>
              <Input {...register('city')} className="w-[200px]" />
            </Field>
            <Field label={t('catalog.form.founded')}>
              <Input type="number" {...register('foundedYear', { valueAsNumber: true })} className="w-[120px]" />
            </Field>
            <Field label={t('catalog.form.closed')}>
              <Input type="number" {...register('closedYear', { valueAsNumber: true })} className="w-[120px]" />
            </Field>
          </div>
          <Field label={t('catalog.form.parentCompany')}>
            <Controller
              control={control}
              name="parentCompanyId"
              render={({ field }) => (
                <Combobox
                  items={(companies ?? [])
                    .filter((company) => company.id !== id)
                    .map((company) => ({ value: company.id, label: company.name }))}
                  value={field.value ?? null}
                  onChange={single(field.onChange)}
                />
              )}
            />
          </Field>
          <Field label={t('catalog.form.website')}>
            <Input {...register('website')} />
          </Field>
          <Textarea {...register('description')} rows={4} placeholder={t('catalog.form.summary')} />
        </Section>

        <Section title={t('catalog.form.images')}>
          <div className="grid grid-cols-2 gap-4">
            <Controller
              control={control}
              name="logoImageId"
              render={({ field }) => (
                <ImagePicker
                  kind="logo"
                  aspect={1}
                  label={t('catalog.form.logo')}
                  value={field.value ?? null}
                  fileName={logoFile}
                  onChange={(imageId, file) => {
                    field.onChange(imageId)
                    setLogoFile(file)
                  }}
                />
              )}
            />
            <Controller
              control={control}
              name="bannerImageId"
              render={({ field }) => (
                <ImagePicker
                  kind="banner"
                  aspect={16 / 5}
                  label={t('catalog.form.banner')}
                  value={field.value ?? null}
                  fileName={bannerFile}
                  onChange={(imageId, file) => {
                    field.onChange(imageId)
                    setBannerFile(file)
                  }}
                />
              )}
            />
          </div>
        </Section>
      </div>
      <FormFooter submitting={formState.isSubmitting} onCancel={() => void navigate({ to: '/companies' })} />
    </form>
  )
}

/** Форма серии (ТЗ 06 §7.5). */
export function SeriesForm({ id }: { id?: string }): React.ReactElement {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: existing } = useQuery({
    queryKey: ['catalog', 'series', id],
    queryFn: () => call('catalog.series.get', { id: id! }),
    enabled: Boolean(id)
  })
  const { data: allSeries } = useQuery({ queryKey: ['series'], queryFn: () => call('series.list') })
  // Имена файлов для предпросмотра: форма редактирования знает только идентификаторы.
  const { data: seriesDto } = useQuery({
    queryKey: ['series', id],
    queryFn: () => call('series.get', { id: id! }),
    enabled: Boolean(id)
  })
  const [coverFile, setCoverFile] = useState<string | null>(null)
  const [bannerFile, setBannerFile] = useState<string | null>(null)

  const form = useForm<SeriesInput>({
    resolver: zodResolver(seriesInputSchema) as unknown as Resolver<SeriesInput>,
    defaultValues: { name: '', kind: 'series' }
  })
  const { register, control, handleSubmit, reset, formState } = form

  useEffect(() => {
    if (existing) reset(existing)
  }, [existing, reset])

  useEffect(() => {
    if (!seriesDto) return
    setCoverFile(seriesDto.coverFile)
    setBannerFile(seriesDto.bannerFile)
  }, [seriesDto])

  const submit = handleSubmit(async (values) => {
    try {
      const saved = await call('catalog.series.save', values)
      await queryClient.invalidateQueries()
      toast({ title: t('catalog.saved'), tone: 'success' })
      await navigate({ to: '/series/$seriesId', params: { seriesId: saved.id } })
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
        <Section title={t('catalog.form.main')}>
          <Field label={t('catalog.form.title')} error={formState.errors.name?.message}>
            <Input {...register('name')} autoFocus invalid={Boolean(formState.errors.name)} />
          </Field>
          <Field label={t('catalog.form.seriesKind')}>
            <Controller
              control={control}
              name="kind"
              render={({ field }) => (
                <Segmented
                  value={field.value}
                  onChange={field.onChange}
                  options={SERIES_KINDS.map((value) => ({ value, label: t(`catalog.seriesKind.${value}`) }))}
                />
              )}
            />
          </Field>
          <Field label={t('catalog.form.parentSeries')}>
            <Controller
              control={control}
              name="parentSeriesId"
              render={({ field }) => (
                <Combobox
                  items={(allSeries ?? [])
                    .filter((series) => series.id !== id)
                    .map((series) => ({ value: series.id, label: series.name }))}
                  value={field.value ?? null}
                  onChange={single(field.onChange)}
                />
              )}
            />
          </Field>
          <Textarea {...register('description')} rows={4} placeholder={t('catalog.form.summary')} />
        </Section>

        <Section title={t('catalog.form.images')}>
          <div className="grid grid-cols-2 gap-4">
            <Controller
              control={control}
              name="coverImageId"
              render={({ field }) => (
                <ImagePicker
                  kind="series_cover"
                  aspect={0.75}
                  label={t('catalog.form.cover')}
                  value={field.value ?? null}
                  fileName={coverFile}
                  onChange={(imageId, file) => {
                    field.onChange(imageId)
                    setCoverFile(file)
                  }}
                />
              )}
            />
            <Controller
              control={control}
              name="bannerImageId"
              render={({ field }) => (
                <ImagePicker
                  kind="banner"
                  aspect={16 / 5}
                  label={t('catalog.form.banner')}
                  value={field.value ?? null}
                  fileName={bannerFile}
                  onChange={(imageId, file) => {
                    field.onChange(imageId)
                    setBannerFile(file)
                  }}
                />
              )}
            />
          </div>
        </Section>
      </div>
      <FormFooter submitting={formState.isSubmitting} onCancel={() => void navigate({ to: '/series' })} />
    </form>
  )
}

/** Строка простого справочника — общий вид для жанра, платформы и тега. */
interface SimpleRow {
  id: string
  name: string
  shortName?: string
  family?: (typeof PLATFORM_FAMILIES)[number]
  color?: string | null
  description?: string | null
}

interface SimpleFormValues {
  name: string
  shortName?: string
  family?: (typeof PLATFORM_FAMILIES)[number]
  color?: string | null
  description?: string | null
}

/** Формы жанра, платформы и тега (ТЗ 06 §7.6). */
export function SimpleEntityForm({
  entity,
  id
}: {
  entity: 'genres' | 'platforms' | 'tags'
  id?: string
}): React.ReactElement {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: rows } = useQuery({
    queryKey: ['catalog', entity],
    queryFn: async (): Promise<SimpleRow[]> => {
      if (entity === 'genres') {
        const list = await call('catalog.genres.list')
        return list.map((g) => ({ id: g.id, name: g.name, description: g.description, color: g.color }))
      }
      if (entity === 'platforms') {
        const list = await call('catalog.platforms.list')
        return list.map((p) => ({ id: p.id, name: p.name, shortName: p.shortName, family: p.family }))
      }
      const list = await call('catalog.tags.list')
      return list.map((tag) => ({ id: tag.id, name: tag.name, color: tag.color }))
    }
  })
  const existing = rows?.find((row) => row.id === id)

  const form = useForm<SimpleFormValues>({
    defaultValues: { name: '', shortName: '', family: 'pc', color: null, description: null }
  })
  const { register, control, handleSubmit, reset, formState } = form

  useEffect(() => {
    if (!existing) return
    reset({
      name: existing.name,
      shortName: existing.shortName ?? '',
      family: existing.family ?? 'pc',
      color: existing.color ?? null,
      description: existing.description ?? null
    })
  }, [existing, reset])

  const submit = handleSubmit(async (values) => {
    try {
      if (entity === 'genres') {
        await call('catalog.genres.save', {
          ...(id ? { id } : {}),
          name: values.name,
          description: values.description ?? null,
          color: values.color ?? null
        })
      } else if (entity === 'platforms') {
        await call('catalog.platforms.save', {
          ...(id ? { id } : {}),
          name: values.name,
          shortName: values.shortName ?? values.name.slice(0, 8),
          family: values.family ?? 'other',
          sortOrder: 0
        })
      } else {
        await call('catalog.tags.save', {
          ...(id ? { id } : {}),
          name: values.name,
          color: values.color ?? null
        })
      }
      await queryClient.invalidateQueries()
      toast({ title: t('catalog.saved'), tone: 'success' })
      await navigate({ to: '/catalog/$entity', params: { entity } })
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
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pb-6">
        <Field label={t('catalog.form.title')}>
          <Input {...register('name', { required: true })} autoFocus className="w-[320px]" />
        </Field>
        {entity === 'platforms' && (
          <>
            <Field label={t('catalog.form.shortName')}>
              <Input {...register('shortName')} className="w-[160px]" />
            </Field>
            <Field label={t('catalog.form.family')}>
              <Controller
                control={control}
                name="family"
                render={({ field }) => (
                  <Combobox
                    items={PLATFORM_FAMILIES.map((value) => ({ value, label: t(`family.${value}`) }))}
                    value={field.value ?? 'other'}
                    onChange={(value) => field.onChange(value)}
                  />
                )}
              />
            </Field>
          </>
        )}
        {entity === 'genres' && (
          <Field label={t('catalog.form.summary')}>
            <Textarea {...register('description')} rows={3} />
          </Field>
        )}
        {(entity === 'genres' || entity === 'tags') && (
          <Field label={t('catalog.form.color')}>
            <Input type="color" {...register('color')} className="w-[80px]" />
          </Field>
        )}
      </div>
      <FormFooter
        submitting={formState.isSubmitting}
        onCancel={() => void navigate({ to: '/catalog/$entity', params: { entity } })}
      />
    </form>
  )
}
