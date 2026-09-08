import { useEffect, useState, type ReactElement } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Controller, useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Check, ChevronDown, Save, Search, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { LIST_SORT_MODES } from '@shared/constants'
import { listInputSchema, type ListDto, type ListInput } from '@shared/schema/entities'
import { Button } from '@/components/ui/button'
import { Input, Textarea } from '@/components/ui/input'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Segmented } from '@/components/ui/segmented'
import { Switch } from '@/components/ui/switch'
import { toast } from '@/components/ui/toast'
import { call } from '@/platform/api'
import { cn } from '@/lib/utils'
import { DEFAULT_LIST_ICON, LIST_COLOR_PRESETS, LIST_ICONS, LIST_ICON_IDS } from './list-icons'
import { ListCoverPicker } from './list-cover-picker'

export interface ListFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Список для редактирования; отсутствует — диалог создания (06 §3.2). */
  list?: ListDto | null
  onSaved?: (list: ListDto) => void
  /** Показывает кнопку «Удалить список» и передаёт клик наверх (подтверждение — на экране списка). */
  onRequestDelete?: () => void
}

function FormField({
  label,
  children,
  hint
}: {
  label: string
  children: React.ReactNode
  hint?: string
}): ReactElement {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="type-small" style={{ color: 'var(--text-2)' }}>
        {label}
      </span>
      {children}
      {hint && (
        <span className="type-small" style={{ color: 'var(--text-3)' }}>
          {hint}
        </span>
      )}
    </label>
  )
}

/** Пикер иконки списка: кнопка-триггер + поповер с поиском по ~80 иконкам (06 §3.2). */
function IconField({
  value,
  onChange
}: {
  value: string | null | undefined
  onChange: (icon: string) => void
}): ReactElement {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const current = value ? LIST_ICONS[value] : undefined
  const CurrentIcon = current ?? LIST_ICONS[DEFAULT_LIST_ICON]
  const filtered = LIST_ICON_IDS.filter((id) => id.includes(query.trim().toLowerCase()))

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'flex h-[36px] items-center gap-2 rounded-sm border border-border-1 bg-surface-1 px-3 outline-none transition-colors',
            'hover:border-border-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)]'
          )}
          style={{ transitionDuration: 'var(--d-micro)' }}
        >
          {CurrentIcon && <CurrentIcon size={16} strokeWidth={1.75} />}
          <span className="type-body text-text-1">{value ?? t('lists.form.iconPick')}</span>
          <ChevronDown size={14} strokeWidth={1.75} className="text-text-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[300px] p-2">
        <div className="mb-2 flex items-center gap-2 rounded-sm border border-border-1 bg-surface-1 px-2">
          <Search size={14} strokeWidth={1.75} className="shrink-0 text-text-3" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('common.search') ?? undefined}
            className="type-body h-8 w-full bg-transparent text-text-1 outline-none placeholder:text-text-3"
            autoFocus
          />
        </div>
        <div className="grid max-h-[220px] grid-cols-7 gap-1 overflow-y-auto">
          {filtered.map((id) => {
            const Icon = LIST_ICONS[id]
            if (!Icon) return null
            const selected = id === value
            return (
              <button
                key={id}
                type="button"
                title={id}
                onClick={() => {
                  onChange(id)
                  setOpen(false)
                }}
                className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-sm outline-none transition-colors',
                  selected ? 'bg-accent-soft text-accent' : 'text-text-2 hover:bg-surface-2 hover:text-text-1'
                )}
                style={{ transitionDuration: 'var(--d-micro)' }}
              >
                <Icon size={17} strokeWidth={1.75} />
              </button>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}

/** Выбор цвета: 8 предустановленных + произвольный (06 §3.2). */
function ColorField({
  value,
  onChange
}: {
  value: string | null | undefined
  onChange: (color: string | null) => void
}): ReactElement {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {LIST_COLOR_PRESETS.map((preset) => {
        const selected = value?.toLowerCase() === preset.toLowerCase()
        return (
          <button
            key={preset}
            type="button"
            aria-label={preset}
            onClick={() => onChange(preset)}
            className="flex h-7 w-7 items-center justify-center rounded-full outline-none transition-transform hover:scale-110"
            style={{
              background: preset,
              boxShadow: selected ? '0 0 0 2px var(--bg-0), 0 0 0 4px var(--border-focus)' : undefined,
              transitionDuration: 'var(--d-micro)'
            }}
          >
            {selected && <Check size={14} strokeWidth={2} color="var(--bg-0)" />}
          </button>
        )
      })}
      <label
        className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-border-2"
        title="Custom"
      >
        <input
          type="color"
          value={value ?? LIST_COLOR_PRESETS[0]}
          onChange={(event) => onChange(event.target.value)}
          className="h-9 w-9 cursor-pointer border-none bg-transparent p-0"
        />
      </label>
      {value && (
        <button type="button" className="type-small text-text-3 hover:text-text-1" onClick={() => onChange(null)}>
          ×
        </button>
      )}
    </div>
  )
}

/** Диалог создания/редактирования списка (06 §3.2). */
export function ListFormDialog({
  open,
  onOpenChange,
  list,
  onSaved,
  onRequestDelete
}: ListFormDialogProps): ReactElement {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [coverFile, setCoverFile] = useState<string | null>(list?.coverFile ?? null)

  const form = useForm<ListInput>({
    resolver: zodResolver(listInputSchema) as unknown as Resolver<ListInput>,
    defaultValues: {
      name: '',
      description: null,
      icon: DEFAULT_LIST_ICON,
      color: LIST_COLOR_PRESETS[0],
      isRanked: false,
      sortMode: 'manual',
      isPinned: true
    }
  })
  const { register, control, handleSubmit, reset, watch, formState } = form

  useEffect(() => {
    if (!open) return
    if (list) {
      reset({
        id: list.id,
        name: list.name,
        description: list.description,
        icon: list.icon ?? DEFAULT_LIST_ICON,
        color: list.color ?? LIST_COLOR_PRESETS[0],
        coverImageId: list.coverImageId,
        isRanked: list.isRanked,
        sortMode: list.sortMode,
        isPinned: list.isPinned
      })
      setCoverFile(list.coverFile)
    } else {
      reset({
        name: '',
        description: null,
        icon: DEFAULT_LIST_ICON,
        color: LIST_COLOR_PRESETS[0],
        isRanked: false,
        sortMode: 'manual',
        isPinned: true
      })
      setCoverFile(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, list?.id])

  const description = watch('description') ?? ''

  const submit = handleSubmit(async (values) => {
    try {
      const saved = await call('lists.save', values)
      await queryClient.invalidateQueries({ queryKey: ['lists'] })
      toast({ title: t('lists.saved'), tone: 'success' })
      onSaved?.(saved)
      onOpenChange(false)
    } catch (err) {
      toast({ title: (err as Error).message, tone: 'danger' })
    }
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size={640} closeLabel={t('action.close') ?? undefined}>
        <DialogHeader>
          <DialogTitle>{list ? t('lists.form.editTitle') : t('lists.form.createTitle')}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            void submit()
          }}
          className="flex flex-col gap-4"
        >
          <FormField label={t('lists.form.name')}>
            <Input {...register('name')} autoFocus invalid={Boolean(formState.errors.name)} />
          </FormField>

          <FormField label={t('lists.form.description')} hint={`${description.length}/500`}>
            <Textarea {...register('description')} rows={3} maxLength={500} />
          </FormField>

          <div className="flex flex-wrap gap-6">
            <FormField label={t('lists.form.icon')}>
              <Controller
                control={control}
                name="icon"
                render={({ field }) => (
                  <IconField value={field.value} onChange={(icon) => field.onChange(icon)} />
                )}
              />
            </FormField>
            <FormField label={t('lists.form.color')}>
              <Controller
                control={control}
                name="color"
                render={({ field }) => (
                  <ColorField value={field.value} onChange={(color) => field.onChange(color)} />
                )}
              />
            </FormField>
          </div>

          <Controller
            control={control}
            name="coverImageId"
            render={({ field }) => (
              <ListCoverPicker
                label={t('lists.form.cover')}
                value={field.value ?? null}
                fileName={coverFile}
                onChange={(imageId, fileName) => {
                  field.onChange(imageId)
                  setCoverFile(fileName)
                }}
              />
            )}
          />

          <FormField label={t('lists.form.sortMode')}>
            <Controller
              control={control}
              name="sortMode"
              render={({ field }) => (
                <Segmented
                  value={field.value}
                  onChange={field.onChange}
                  options={LIST_SORT_MODES.map((value) => ({ value, label: t(`lists.sortMode.${value}`) }))}
                />
              )}
            />
          </FormField>

          <div className="flex flex-wrap gap-6">
            <Controller
              control={control}
              name="isRanked"
              render={({ field }) => (
                <Switch checked={field.value} onChange={field.onChange} label={t('lists.form.ranked')} />
              )}
            />
            <Controller
              control={control}
              name="isPinned"
              render={({ field }) => (
                <Switch checked={field.value} onChange={field.onChange} label={t('lists.form.pinned')} />
              )}
            />
          </div>

          <DialogFooter>
            {list && onRequestDelete && (
              <Button
                type="button"
                variant="danger"
                className="mr-auto"
                onClick={() => {
                  onOpenChange(false)
                  onRequestDelete()
                }}
              >
                <Trash2 size={16} strokeWidth={1.75} />
                {t('lists.form.delete')}
              </Button>
            )}
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {t('action.cancel')}
            </Button>
            <Button type="submit" variant="primary" loading={formState.isSubmitting}>
              <Save size={16} strokeWidth={1.75} />
              {t('action.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
