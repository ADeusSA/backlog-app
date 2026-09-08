import { useState } from 'react'
import { Heart, Inbox, Plus, Settings2, Trash2 } from 'lucide-react'
import { GAME_STATUSES, STATUS_ORDER, type GameStatus } from '@shared/constants'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Chip } from '@/components/ui/chip'
import { CollapsibleSection } from '@/components/ui/collapsible-section'
import { Combobox } from '@/components/ui/combobox'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger
} from '@/components/ui/context-menu'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { EmptyState } from '@/components/ui/empty-state'
import { Heatmap, type HeatmapDay, type HeatmapLabels } from '@/components/ui/heatmap'
import { CoverImage } from '@/components/ui/image'
import { Input, Textarea } from '@/components/ui/input'
import { Kbd } from '@/components/ui/kbd'
import { MetacriticBadge } from '@/components/ui/metacritic-badge'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ProgressRing } from '@/components/ui/progress-ring'
import { RatingStars } from '@/components/ui/rating-stars'
import { Segmented } from '@/components/ui/segmented'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Slider, RangeSlider } from '@/components/ui/slider'
import { StatusBadge, StatusDot } from '@/components/ui/status-badge'
import { StatusPicker } from '@/components/ui/status-picker'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from '@/components/ui/toast'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cardBorder, cardTint, statusColor } from '@/lib/color'

/**
 * Витрина компонентов дизайн-системы Aurora (ТЗ 10 §3 п.6): маршрут `/dev/ui`.
 * Здесь каждый компонент показан во всех обязательных состояниях — это инструмент
 * ревью дизайна, поэтому строки написаны прямо в коде, без i18n.
 */
export function UiShowcase(): React.ReactElement {
  const [rating, setRating] = useState<number | null>(7)
  const [status, setStatus] = useState<GameStatus | null>('playing')
  const [checked, setChecked] = useState(true)
  const [switched, setSwitched] = useState(true)
  const [zoom, setZoom] = useState(1.4)
  const [range, setRange] = useState<[number, number]>([2015, 2026])
  const [segment, setSegment] = useState('grid')
  const [combo, setCombo] = useState<string | null>('rpg')

  const statusLabels = Object.fromEntries(
    GAME_STATUSES.map((value) => [
      value,
      { title: RU_STATUS[value], description: RU_STATUS_DESC[value] }
    ])
  ) as Record<GameStatus, { title: string; description: string }>

  return (
    <div className="flex flex-col gap-10 p-6">
      <header>
        <h1 className="type-h1">Дизайн-система Aurora</h1>
        <p className="type-body" style={{ color: 'var(--text-2)' }}>
          Витрина компонентов во всех состояниях. Проверяйте по чек-листу «не пёстро» (документ 04 §7).
        </p>
      </header>

      <Block title="Кнопки">
        <Row>
          <Button variant="primary">Основная</Button>
          <Button variant="accent" icon={<Plus size={16} strokeWidth={1.75} />}>
            Акцентная
          </Button>
          <Button variant="secondary">Вторичная</Button>
          <Button variant="ghost">Прозрачная</Button>
          <Button variant="danger" icon={<Trash2 size={16} strokeWidth={1.75} />}>
            Удалить
          </Button>
          <Button variant="icon" aria-label="Настройки">
            <Settings2 size={16} strokeWidth={1.75} />
          </Button>
        </Row>
        <Row>
          <Button variant="primary" size="sm">
            Компакт 32
          </Button>
          <Button variant="primary" size="md">
            Стандарт 36
          </Button>
          <Button variant="primary" size="lg">
            Крупная 44
          </Button>
          <Button variant="primary" loading>
            Загрузка
          </Button>
          <Button variant="primary" disabled>
            Отключена
          </Button>
        </Row>
      </Block>

      <Block title="Поля ввода">
        <Row>
          <Input placeholder="Обычное поле" className="w-[240px]" />
          <Input placeholder="С ошибкой" invalid className="w-[240px]" />
          <Input placeholder="Отключено" disabled className="w-[240px]" />
          <Input placeholder="С клавишей" kbd={['Ctrl', 'K']} className="w-[240px]" />
        </Row>
        <Textarea placeholder="Многострочное поле" rows={3} className="max-w-[520px]" />
      </Block>

      <Block title="Чипы">
        <Row>
          <Chip>Обычный</Chip>
          <Chip selected>Выбранный</Chip>
          <Chip count={42}>Со счётчиком</Chip>
          <Chip selected count={7} onRemove={() => undefined} removeLabel="Убрать фильтр">
            С крестиком
          </Chip>
          <Chip selected color={statusColor('completed')}>
            Цветной
          </Chip>
          <Chip disabled>Отключён</Chip>
        </Row>
      </Block>

      <Block title="Сегментированный контрол">
        <Row>
          <Segmented
            value={segment}
            onChange={setSegment}
            ariaLabel="Вид коллекции"
            options={[
              { value: 'grid', label: 'Сетка' },
              { value: 'list', label: 'Список' }
            ]}
          />
          <Segmented
            value={segment}
            onChange={setSegment}
            tone="accent"
            size="sm"
            ariaLabel="Вид коллекции, акцентный"
            options={[
              { value: 'grid', label: 'S' },
              { value: 'list', label: 'M' }
            ]}
          />
        </Row>
      </Block>

      <Block title="Статусы: бейджи, точки, подкраска карточки">
        <Row>
          {STATUS_ORDER.map((value) => (
            <StatusBadge key={value} status={value} label={RU_STATUS[value]} />
          ))}
        </Row>
        <Row>
          {STATUS_ORDER.map((value) => (
            <span key={value} className="flex items-center gap-1.5 type-small">
              <StatusDot status={value} />
              {RU_STATUS[value]}
            </span>
          ))}
        </Row>
        <Row>
          {STATUS_ORDER.map((value) => (
            <div
              key={value}
              className="flex h-[64px] w-[120px] items-end rounded-[var(--r-md)] p-2 type-small"
              style={{
                background: cardTint(value),
                border: `1px solid ${cardBorder(value)}`,
                color: 'var(--text-2)'
              }}
            >
              {RU_STATUS[value]}
            </div>
          ))}
        </Row>
      </Block>

      <Block title="StatusPicker">
        <div className="w-[280px]">
          <StatusPicker
            value={status}
            onChange={setStatus}
            labels={statusLabels}
            placeholder="Не в библиотеке"
          />
        </div>
      </Block>

      <Block title="Оценка">
        <Row>
          <RatingStars value={rating} onChange={setRating} showLabel labels={RU_RATING} ariaLabel="Моя оценка" />
          <RatingStars value={9} readOnly size={16} />
          <RatingStars value={null} readOnly size={24} />
        </Row>
      </Block>

      <Block title="Кольца прогресса">
        <Row>
          <ProgressRing done={0} total={100} size={56} label="0 %" />
          <ProgressRing done={44} total={100} size={56} label="44 / 100" />
          <ProgressRing done={100} total={100} size={56} tone="success" label="100 %" />
          <ProgressRing done={7} total={12} size={40} />
          <ProgressRing done={3} total={10} size={24} showValue={false} />
        </Row>
      </Block>

      <Block title="Карта активности (heatmap)">
        <Heatmap
          from={DEMO_HEATMAP.from}
          to={DEMO_HEATMAP.to}
          days={DEMO_HEATMAP.days}
          metric="minutes"
          labels={DEMO_HEATMAP_LABELS}
          selected={DEMO_HEATMAP.days[10]?.date ?? null}
        />
      </Block>

      <Block title="Обложки и плашки">
        <Row>
          <CoverImage fileName={null} title="Elden Ring" dominantColor="#6b4b2a" size={120} />
          <CoverImage fileName={null} title="Игра без обложки с очень длинным названием" size={120} />
          <CoverImage fileName={null} title="Широкая" ratio="16/9" size={200} />
          <div className="flex flex-col gap-2">
            <MetacriticBadge score={94} />
            <MetacriticBadge score={68} />
            <MetacriticBadge score={41} />
          </div>
          <div className="flex flex-col gap-2">
            <Badge>нейтральный</Badge>
            <Badge tone="accent">акцент</Badge>
            <Badge tone="success">успех</Badge>
            <Badge tone="warning">внимание</Badge>
            <Badge tone="danger">ошибка</Badge>
          </div>
          <Avatar name="Игрок" size={48} />
        </Row>
      </Block>

      <Block title="Слои поверх: поповер, меню, диалог, подсказка">
        <Row>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="secondary">Поповер</Button>
            </PopoverTrigger>
            <PopoverContent className="w-[240px]">
              <p className="type-h3">Заголовок</p>
              <p className="type-small" style={{ color: 'var(--text-2)' }}>
                Стекло, радиус 18, тень 3.
              </p>
            </PopoverContent>
          </Popover>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary">Выпадающее меню</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem>Открыть</DropdownMenuItem>
              <DropdownMenuItem>Сменить статус</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>Убрать из библиотеки</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <ContextMenu>
            <ContextMenuTrigger asChild>
              <Button variant="secondary">ПКМ здесь</Button>
            </ContextMenuTrigger>
            <ContextMenuContent>
              <ContextMenuItem>Оценить</ContextMenuItem>
              <ContextMenuItem>Записать время</ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem>Удалить</ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>

          <Dialog>
            <DialogTrigger asChild>
              <Button variant="secondary">Диалог</Button>
            </DialogTrigger>
            <DialogContent size={480}>
              <DialogHeader>
                <DialogTitle>Удалить список?</DialogTitle>
              </DialogHeader>
              <p className="type-body" style={{ color: 'var(--text-2)' }}>
                Игры останутся в библиотеке.
              </p>
              <DialogFooter>
                <Button variant="secondary">Отмена</Button>
                <Button variant="danger">Удалить</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" aria-label="Избранное">
                <Heart size={16} strokeWidth={1.75} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Подсказка через 400 мс</TooltipContent>
          </Tooltip>
        </Row>
      </Block>

      <Block title="Тосты">
        <Row>
          <Button variant="secondary" onClick={() => toast({ title: 'Сохранено' })}>
            Обычный
          </Button>
          <Button
            variant="secondary"
            onClick={() => toast({ title: 'Достижение открыто: Минус бэклог I', tone: 'success' })}
          >
            Успех
          </Button>
          <Button
            variant="secondary"
            onClick={() => toast({ title: 'Не удалось сохранить', tone: 'danger' })}
          >
            Ошибка
          </Button>
          <Button
            variant="secondary"
            onClick={() =>
              toast({
                title: 'Игра убрана из списка',
                action: { label: 'Отменить', onClick: () => undefined }
              })
            }
          >
            С отменой
          </Button>
        </Row>
      </Block>

      <Block title="Слайдеры, переключатели, комбобокс">
        <div className="flex max-w-[420px] flex-col gap-4">
          <Slider min={1} max={3} step={0.01} value={zoom} onChange={setZoom} />
          <RangeSlider min={1990} max={2026} value={range} onChange={setRange} />
          <Row>
            <Switch checked={switched} onChange={setSwitched} label="Избранное" />
            <Checkbox checked={checked} onChange={setChecked} label="Показывать DLC" />
            <Checkbox checked={false} onChange={() => undefined} label="Отключён" disabled />
          </Row>
          <Combobox
            items={[
              { value: 'rpg', label: 'RPG' },
              { value: 'shooter', label: 'Шутер' },
              { value: 'strategy', label: 'Стратегия' }
            ]}
            value={combo}
            onChange={(value) => setCombo(Array.isArray(value) ? (value[0] ?? null) : value)}
            placeholder="Жанр"
          />
        </div>
      </Block>

      <Block title="Вкладки и сворачиваемые секции">
        <Tabs defaultValue="games">
          <TabsList>
            <TabsTrigger value="games">Игры</TabsTrigger>
            <TabsTrigger value="series">Серии</TabsTrigger>
            <TabsTrigger value="children">Дочерние</TabsTrigger>
          </TabsList>
          <TabsContent value="games">
            <p className="type-body pt-3" style={{ color: 'var(--text-2)' }}>
              Содержимое вкладки «Игры».
            </p>
          </TabsContent>
          <TabsContent value="series">
            <p className="type-body pt-3" style={{ color: 'var(--text-2)' }}>
              Содержимое вкладки «Серии».
            </p>
          </TabsContent>
          <TabsContent value="children">
            <p className="type-body pt-3" style={{ color: 'var(--text-2)' }}>
              Содержимое вкладки «Дочерние».
            </p>
          </TabsContent>
        </Tabs>
        <CollapsibleSection title="Жанры" count={8} defaultOpen>
          <Row>
            <Chip selected count={12}>
              RPG
            </Chip>
            <Chip count={4}>Шутер</Chip>
            <Chip count={2}>Стратегия</Chip>
          </Row>
        </CollapsibleSection>
      </Block>

      <Block title="Загрузка и пустые состояния">
        <Row>
          <div className="flex flex-col gap-2">
            <Skeleton className="h-[160px] w-[120px]" />
            <Skeleton className="h-3 w-[100px]" />
            <Skeleton className="h-3 w-[70px]" />
          </div>
          <EmptyState
            icon={<Inbox size={24} strokeWidth={1.75} />}
            title="Ничего не найдено под эти фильтры"
            description="Попробуйте убрать самый ограничивающий фильтр."
            action={{ label: 'Сбросить фильтры', onClick: () => undefined }}
          />
        </Row>
      </Block>

      <Block title="Прочее">
        <Row>
          <Kbd keys={['Ctrl', 'K']} />
          <Kbd keys={['Alt', '←']} />
          <Separator className="w-[200px]" />
        </Row>
      </Block>
    </div>
  )
}

function Block({ title, children }: { title: string; children: React.ReactNode }): React.ReactElement {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="type-caption">{title}</h2>
      {children}
    </section>
  )
}

function Row({ children }: { children: React.ReactNode }): React.ReactElement {
  return <div className="flex flex-wrap items-center gap-3">{children}</div>
}

/** Год «сессий» для витрины: детерминированная синусоида, чтобы видеть все пять ступеней. */
const DEMO_HEATMAP = (() => {
  const to = new Date()
  const from = new Date(to.getTime() - 364 * 24 * 3600 * 1000)
  const iso = (date: Date): string => date.toISOString().slice(0, 10)
  const days: HeatmapDay[] = []
  for (let i = 0; i < 365; i += 1) {
    const date = new Date(from.getTime() + i * 24 * 3600 * 1000)
    const wave = Math.sin(i / 9) + Math.sin(i / 31)
    if (wave < 0.2) continue
    days.push({ date: iso(date), minutes: Math.round(wave * 120), sessions: wave > 1.4 ? 2 : 1 })
  }
  return { from: iso(from), to: iso(to), days }
})()

const DEMO_HEATMAP_LABELS: HeatmapLabels = {
  weekdays: ['Пн', 'Ср', 'Пт'],
  months: ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'],
  less: 'меньше',
  more: 'больше',
  grid: 'Карта активности по дням',
  cell: (day) => `${day.date} · ${Math.round(day.minutes / 60)} ч · ${day.sessions} сессий`
}

const RU_STATUS: Record<GameStatus, string> = {
  wishlist: 'Хочу',
  backlog: 'Бэклог',
  playing: 'Играю',
  completed: 'Пройдена',
  shelved: 'Отложена',
  dropped: 'Брошена',
  played: 'Поиграл'
}

const RU_STATUS_DESC: Record<GameStatus, string> = {
  wishlist: 'Хочу поиграть, пока не владею',
  backlog: 'Есть у меня, ещё не начал',
  playing: 'Прохожу сейчас',
  completed: 'Прошёл основную цель',
  shelved: 'Отложена — вернусь позже',
  dropped: 'Брошена — не вернусь',
  played: 'Играл без цели «пройти»'
}

const RU_RATING: Record<string, string> = {
  'rating.awful': 'Ужасно',
  'rating.bad': 'Плохо',
  'rating.meh': 'Так себе',
  'rating.ok': 'Нормально',
  'rating.good': 'Хорошо',
  'rating.veryGood': 'Очень хорошо',
  'rating.great': 'Великолепно',
  'rating.masterpiece': 'Шедевр'
}
