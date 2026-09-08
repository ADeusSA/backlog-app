import type { ReactElement, RefObject } from 'react'
import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarCheck, Clock3, Heart, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { GameDetail, TagDto, UserGamePatch } from '@shared/schema/entities'
import {
  GAME_STATUSES,
  MASTERABLE_STATUSES,
  OWNERSHIPS,
  RATEABLE_STATUSES,
  STORES
} from '@shared/constants'
import type { GameStatus, Ownership } from '@shared/constants'
import { StatusPicker, type StatusPickerLabel } from '@/components/ui/status-picker'
import { RatingStars } from '@/components/ui/rating-stars'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectItem } from '@/components/ui/select'
import { Combobox } from '@/components/ui/combobox'
import { Segmented } from '@/components/ui/segmented'
import { Switch } from '@/components/ui/switch'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { toast } from '@/components/ui/toast'
import { call } from '@/platform/api'
import { formatPlaytime } from '@/lib/format'
import { single } from '@/lib/form-utils'
import { SessionDialog } from '@/features/sessions/session-dialog'
import { useGameAutosave, SavedTick } from './use-autosave'
import { ListsBlock, TagsBlock } from './user-panel-lists-tags'
import { NotesField, ResumeNoteField, ReviewField } from './user-panel-notes'

interface UserPanelProps {
  game: GameDetail
  ratingRef: RefObject<HTMLDivElement | null>
  hoursInputRef: RefObject<HTMLInputElement | null>
}

const today = (): string => new Date().toISOString().slice(0, 10)

function storeLabel(store: string): string {
  return store.charAt(0).toUpperCase() + store.slice(1).replace(/_/g, ' ')
}

/** Панель пользователя страницы игры — 14 блоков автосохранения (06 §6.2). */
export function UserPanel({ game, ratingRef, hoursInputRef }: UserPanelProps): ReactElement | null {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const userGame = game.userGame
  const { patch, saved } = useGameAutosave(game.id)
  const [dateError, setDateError] = useState<string | null>(null)
  const [removeBusy, setRemoveBusy] = useState(false)
  const [statusBusy, setStatusBusy] = useState(false)
  const [sessionOpen, setSessionOpen] = useState(false)
  const [switchOpen, setSwitchOpen] = useState(false)

  const { data: platformsCatalog } = useQuery({
    queryKey: ['catalog', 'platforms'],
    queryFn: () => call('catalog.platforms.list')
  })

  const { data: playthroughs } = useQuery({
    queryKey: ['playthroughs', game.id],
    queryFn: () => call('playthroughs.list', { gameId: game.id })
  })

  // Нужен только ответ «журнал пуст или нет» — перед переключением режима.
  const { data: firstSession } = useQuery({
    queryKey: ['sessions', 'exists', game.id],
    queryFn: () => call('sessions.list', { gameId: game.id, limit: 1, offset: 0 })
  })

  const statusLabels = useMemo(
    () =>
      Object.fromEntries(
        GAME_STATUSES.map((status) => [
          status,
          {
            title: t(`status.${status}`),
            description: t(`status.${status}.desc`)
          } satisfies StatusPickerLabel
        ])
      ) as Record<GameStatus, StatusPickerLabel>,
    [t]
  )

  const platformItems = useMemo(() => {
    const ownIds = new Set(game.platforms.map((p) => p.id))
    const rest = (platformsCatalog ?? []).filter((p) => !ownIds.has(p.id))
    return [
      ...game.platforms.map((p) => ({ value: p.id, label: p.name })),
      ...rest.map((p) => ({ value: p.id, label: p.name }))
    ]
  }, [game.platforms, platformsCatalog])

  // Все хуки выше вызываются безусловно — панель монтируется только когда userGame есть
  // (иначе экран показывает AddToLibraryPanel), но тип поля остаётся nullable.
  if (!userGame) return null

  const canRate = RATEABLE_STATUSES.includes(userGame.status)
  const canMaster = MASTERABLE_STATUSES.includes(userGame.status)
  const hours = Math.floor(userGame.playtimeMinutes / 60)
  const minutes = userGame.playtimeMinutes % 60

  function setTime(nextHours: number, nextMinutes: number): void {
    const total = Math.max(
      0,
      Math.round(nextHours) * 60 + Math.max(0, Math.min(59, Math.round(nextMinutes)))
    )
    patch('time', { playtimeMinutes: total })
  }

  async function addQuickTime(deltaMinutes: number): Promise<void> {
    try {
      const updated = await call('userGame.addPlaytime', { gameId: game.id, minutes: deltaMinutes })
      queryClient.setQueryData<GameDetail | null | undefined>(['game', game.id], (old) =>
        old ? { ...old, userGame: updated } : old
      )
    } catch (err) {
      toast({ title: (err as Error).message, tone: 'danger' })
    }
  }

  async function changeStatus(status: GameStatus): Promise<void> {
    setStatusBusy(true)
    try {
      const updated = await call('userGame.setStatus', { gameId: game.id, status })
      queryClient.setQueryData<GameDetail | null | undefined>(['game', game.id], (old) =>
        old ? { ...old, userGame: updated } : old
      )
      void queryClient.invalidateQueries({ queryKey: ['game', game.id] })
    } catch (err) {
      toast({ title: (err as Error).message, tone: 'danger' })
    } finally {
      setStatusBusy(false)
    }
  }

  /**
   * Включение режима «часы по журналу» (02 §3.8). Если журнал пуст, а ручные часы есть,
   * сначала спрашиваем: сумма сессий заменит введённое число.
   */
  function requestMode(checked: boolean): void {
    if (!checked) {
      patch('time', { playtimeMode: 'manual' }, 0)
      return
    }
    const journalEmpty = (firstSession?.length ?? 0) === 0
    if (journalEmpty && (userGame?.playtimeMinutes ?? 0) > 0) {
      setSwitchOpen(true)
      return
    }
    patch('time', { playtimeMode: 'sessions' }, 0)
  }

  function setDate(field: 'startedAt' | 'finishedAt', value: string | null): void {
    const started = field === 'startedAt' ? value : (userGame?.startedAt ?? null)
    const finished = field === 'finishedAt' ? value : (userGame?.finishedAt ?? null)
    if (started && finished && finished < started) {
      setDateError(t('game.panel.date.error'))
      return
    }
    setDateError(null)
    patch(field, { [field]: value } as UserGamePatch)
  }

  function handleTagsChange(next: TagDto[]): void {
    queryClient.setQueryData<GameDetail | null | undefined>(['game', game.id], (old) =>
      old ? { ...old, tags: next } : old
    )
  }

  async function removeFromLibrary(): Promise<void> {
    setRemoveBusy(true)
    // Статус запоминаем до удаления — он нужен кнопке «Отменить» в тосте (05 §7).
    const previousStatus = userGame?.status ?? 'backlog'
    try {
      await call('userGame.removeFromLibrary', { gameIds: [game.id] })
      queryClient.setQueryData<GameDetail | null | undefined>(['game', game.id], (old) =>
        old ? { ...old, userGame: null } : old
      )
      toast({
        title: t('game.panel.removed'),
        tone: 'info',
        action: {
          label: t('action.undo'),
          onClick: () => {
            void call('userGame.addToLibrary', { gameIds: [game.id], status: previousStatus }).then(
              () => queryClient.invalidateQueries({ queryKey: ['game', game.id] })
            )
          }
        }
      })
    } catch (err) {
      toast({ title: (err as Error).message, tone: 'danger' })
    } finally {
      setRemoveBusy(false)
    }
  }

  return (
    <>
      <div
        className="glass sticky top-0 flex w-full flex-col gap-4 self-start rounded-[var(--r-lg)] border border-border-1 p-4"
        style={{ maxWidth: 320 }}
      >
        {/* 1. Статус */}
        <StatusPicker
          value={userGame.status}
          labels={statusLabels}
          disabled={statusBusy}
          onChange={(status) => void changeStatus(status)}
        />

        {/* 2. Оценка */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="type-caption">{t('game.panel.rating')}</span>
            <SavedTick show={Boolean(saved['rating'])} label={t('game.panel.saved')} />
          </div>
          <div ref={ratingRef} tabIndex={-1}>
            {canRate ? (
              <RatingStars
                value={userGame.rating}
                onChange={(value) => patch('rating', { rating: value }, 0)}
                showLabel
                labels={{
                  'rating.awful': t('rating.awful'),
                  'rating.bad': t('rating.bad'),
                  'rating.meh': t('rating.meh'),
                  'rating.ok': t('rating.ok'),
                  'rating.good': t('rating.good'),
                  'rating.veryGood': t('rating.veryGood'),
                  'rating.great': t('rating.great'),
                  'rating.masterpiece': t('rating.masterpiece')
                }}
                ariaLabel={t('game.panel.rating')}
              />
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="opacity-45">
                    <RatingStars
                      value={userGame.rating}
                      readOnly
                      ariaLabel={t('game.panel.rating')}
                    />
                  </div>
                </TooltipTrigger>
                <TooltipContent>{t('game.panel.rating.disabled')}</TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>

        {/* 3. Флаги */}
        <div className="flex items-center gap-5">
          <Tooltip>
            <TooltipTrigger asChild>
              <span className={canMaster ? undefined : 'opacity-45'}>
                <Checkbox
                  checked={userGame.isMastered}
                  disabled={!canMaster}
                  onChange={(checked) => patch('mastered', { isMastered: checked }, 0)}
                  label={t('game.panel.mastered')}
                />
              </span>
            </TooltipTrigger>
            {!canMaster && <TooltipContent>{t('game.panel.mastered.disabled')}</TooltipContent>}
          </Tooltip>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => patch('favorite', { isFavorite: !userGame.isFavorite }, 0)}
            aria-pressed={userGame.isFavorite}
          >
            <Heart
              size={16}
              strokeWidth={1.75}
              className={userGame.isFavorite ? 'fill-danger text-danger' : undefined}
              style={userGame.isFavorite ? undefined : { color: 'var(--text-3)' }}
            />
            {t('game.panel.favorite')}
          </Button>
        </div>

        {/* 4. Время */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="type-caption">{t('game.panel.time')}</span>
            <SavedTick show={Boolean(saved['time'])} label={t('game.panel.saved')} />
          </div>
          {userGame.playtimeMode === 'sessions' ? (
            <>
              <p className="type-h3 tabular">{formatPlaytime(userGame.playtimeMinutes)}</p>
              <Button
                variant="secondary"
                size="sm"
                className="justify-start"
                onClick={() => setSessionOpen(true)}
              >
                <Clock3 size={14} strokeWidth={1.75} />
                {t('game.panel.time.addSession')}
              </Button>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <Input
                  ref={hoursInputRef}
                  type="number"
                  min={0}
                  value={hours}
                  onChange={(event) => setTime(Number(event.target.value) || 0, minutes)}
                  kbd={[t('game.panel.time.hours')]}
                  className="w-full"
                />
                <Input
                  type="number"
                  min={0}
                  max={59}
                  value={minutes}
                  onChange={(event) => setTime(hours, Number(event.target.value) || 0)}
                  kbd={[t('game.panel.time.minutes')]}
                  className="w-full"
                />
              </div>
              <div className="flex gap-1.5">
                <Button variant="secondary" size="sm" onClick={() => void addQuickTime(15)}>
                  {t('game.panel.time.quick15')}
                </Button>
                <Button variant="secondary" size="sm" onClick={() => void addQuickTime(60)}>
                  {t('game.panel.time.quick1h')}
                </Button>
                <Button variant="secondary" size="sm" onClick={() => void addQuickTime(120)}>
                  {t('game.panel.time.quick2h')}
                </Button>
              </div>
            </>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="w-fit">
                <Switch
                  checked={userGame.playtimeMode === 'sessions'}
                  onChange={(checked) => requestMode(checked)}
                  label={t('game.panel.time.bySessions')}
                />
              </span>
            </TooltipTrigger>
            <TooltipContent>{t('game.panel.time.sessionsHint')}</TooltipContent>
          </Tooltip>
        </div>

        {/* 5. Даты */}
        <div className="flex flex-col gap-1.5">
          {/* Две даты в одну строку не влезали при ширине панели: поле `type=date`
            обрезало год и иконку календаря. Раскладываем в столбик. */}
          <div className="flex flex-col gap-2">
            <DateField
              label={t('game.panel.startedAt')}
              value={userGame.startedAt}
              onChange={(v) => setDate('startedAt', v)}
              todayLabel={t('game.panel.date.today')}
              clearLabel={t('game.panel.date.clear')}
            />
            <DateField
              label={t('game.panel.finishedAt')}
              value={userGame.finishedAt}
              onChange={(v) => setDate('finishedAt', v)}
              todayLabel={t('game.panel.date.today')}
              clearLabel={t('game.panel.date.clear')}
            />
          </div>
          {dateError && <p className="type-small text-danger">{dateError}</p>}
        </div>

        {/* 6. Платформа */}
        <div className="flex flex-col gap-1.5">
          <span className="type-caption">{t('game.panel.platform')}</span>
          <Combobox
            items={platformItems}
            value={userGame.platformId}
            onChange={single<string>((value) => patch('platform', { platformId: value }, 0))}
            placeholder={t('game.panel.platform.placeholder')}
            emptyText={t('common.none')}
          />
        </div>

        {/* 7. Владение */}
        <div className="flex flex-col gap-1.5">
          <span className="type-caption">{t('game.panel.ownership')}</span>
          <Select<Ownership>
            value={userGame.ownership}
            onChange={(value) => patch('ownership', { ownership: value }, 0)}
          >
            {OWNERSHIPS.map((value) => (
              <SelectItem key={value} value={value}>
                {t(`ownership.${value}`)}
              </SelectItem>
            ))}
          </Select>
          {userGame.ownership === 'digital' && (
            <Select<string>
              value={userGame.store ?? undefined}
              onChange={(value) => patch('store', { store: value }, 0)}
              placeholder={t('game.panel.store.placeholder')}
            >
              {STORES.map((store) => (
                <SelectItem key={store} value={store}>
                  {storeLabel(store)}
                </SelectItem>
              ))}
            </Select>
          )}
          {userGame.ownership === 'subscription' && (
            <Input
              value={userGame.subscriptionService ?? ''}
              placeholder={t('game.panel.subscriptionService.placeholder')}
              onChange={(event) =>
                patch('subscriptionService', { subscriptionService: event.target.value || null })
              }
            />
          )}
        </div>

        {/* 8. Приоритет — только для backlog */}
        {userGame.status === 'backlog' && (
          <div className="flex flex-col gap-1.5">
            <span className="type-caption">{t('game.panel.priority')}</span>
            <Segmented<string>
              value={String(userGame.priority)}
              onChange={(value) => {
                const next = Number(value)
                patch('priority', { priority: userGame.priority === next ? 0 : next }, 0)
              }}
              options={[
                { value: '1', label: t('priority.1') },
                { value: '2', label: t('priority.2') },
                { value: '3', label: t('priority.3') }
              ]}
            />
          </div>
        )}

        {/* 9. Списки */}
        <ListsBlock gameId={game.id} />

        {/* 10. Теги */}
        <TagsBlock gameId={game.id} tags={game.tags} onChange={handleTagsChange} />

        {/* 11. Где остановился */}
        <ResumeNoteField
          value={userGame.resumeNote ?? ''}
          saved={Boolean(saved['resumeNote'])}
          onChange={(value) => patch('resumeNote', { resumeNote: value || null })}
        />

        {/* 12. Заметки */}
        <NotesField
          value={userGame.notes ?? ''}
          saved={Boolean(saved['notes'])}
          onChange={(value) => patch('notes', { notes: value || null })}
        />

        {/* 13. Отзыв */}
        <ReviewField
          value={userGame.review ?? ''}
          hasSpoilers={userGame.reviewHasSpoilers}
          saved={Boolean(saved['review'])}
          onChangeValue={(value) => patch('review', { review: value || null })}
          onChangeSpoilers={(value) => patch('review', { reviewHasSpoilers: value }, 0)}
        />

        {/* 14. Убрать из библиотеки */}
        <Button
          variant="danger"
          size="sm"
          loading={removeBusy}
          onClick={() => void removeFromLibrary()}
          className="self-start"
        >
          <X size={14} strokeWidth={1.75} />
          {t('game.panel.remove')}
        </Button>
      </div>

      {/*
        Переход на журнал заменяет ручное число суммой сессий: если журнал пуст,
        часы обнулятся. Спрашиваем явно, а не «переносим» молча — придумывать
        за пользователя даты и длительность прошлых сессий приложение не вправе.
      */}
      <Dialog open={switchOpen} onOpenChange={setSwitchOpen}>
        <DialogContent size={480} closeLabel={t('action.close')}>
          <DialogHeader>
            <DialogTitle>{t('game.panel.time.switchTitle')}</DialogTitle>
            <DialogDescription>
              {t('game.panel.time.switchBody', { time: formatPlaytime(userGame.playtimeMinutes) })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setSwitchOpen(false)}>
              {t('action.cancel')}
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                setSwitchOpen(false)
                patch('time', { playtimeMode: 'sessions' }, 0)
              }}
            >
              {t('game.panel.time.switchConfirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SessionDialog
        open={sessionOpen}
        onOpenChange={setSessionOpen}
        gameId={game.id}
        playthroughs={playthroughs ?? []}
      />
    </>
  )
}

function DateField({
  label,
  value,
  onChange,
  todayLabel,
  clearLabel
}: {
  label: string
  value: string | null
  onChange: (value: string | null) => void
  todayLabel: string
  clearLabel: string
}): ReactElement {
  return (
    <div className="flex flex-col gap-1">
      <span className="type-caption">{label}</span>
      <div className="flex items-center gap-1">
        <input
          type="date"
          value={value ?? ''}
          onChange={(event) => onChange(event.target.value || null)}
          className="type-body h-[36px] w-full min-w-0 rounded-sm border border-border-1 bg-surface-1 px-2 text-text-1 outline-none [color-scheme:dark] hover:border-border-2 focus-visible:border-[var(--border-focus)]"
        />
        {value ? (
          <Button
            variant="icon"
            size="sm"
            onClick={() => onChange(null)}
            aria-label={clearLabel}
            title={clearLabel}
          >
            <X size={13} strokeWidth={1.75} />
          </Button>
        ) : (
          <Button
            variant="icon"
            size="sm"
            onClick={() => onChange(today())}
            aria-label={todayLabel}
            title={todayLabel}
          >
            <CalendarCheck size={14} strokeWidth={1.75} />
          </Button>
        )}
      </div>
    </div>
  )
}
