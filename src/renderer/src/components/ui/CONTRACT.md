# Контракт компонентов Aurora

Нормативный список экспортов `@/components/ui/*`. Дизайн-система реализует ровно эти сигнатуры,
остальные модули на них опираются. Визуальные требования — ТЗ `docs/04-design-system.md` §3.
Расширять можно (новые пропсы с значением по умолчанию, новые компоненты), ломать — нельзя.

Общие правила: только токены из `tokens.css`; анимации — из `@/lib/motion`; иконки — `lucide-react`
(stroke 1.75); у каждого интерактивного элемента состояния default · hover · active · focus-visible ·
disabled · selected.

| Модуль | Экспорт | Ключевые пропсы |
|---|---|---|
| `button` | `Button` | `variant: 'primary' \| 'accent' \| 'secondary' \| 'ghost' \| 'danger' \| 'icon'`, `size: 'sm' \| 'md' \| 'lg'`, `asChild`, `loading`, `icon?: ReactNode` |
| `input` | `Input`, `Textarea` | `invalid?`, `iconLeft?`, `hint?`, `kbd?` |
| `chip` | `Chip` | `selected?`, `count?`, `onRemove?`, `icon?`, `color?` |
| `segmented` | `Segmented<T>` | `options: {value: T; label?: string; icon?: ReactNode; title?: string}[]`, `value`, `onChange`, `tone?: 'primary' \| 'accent'`, `size?` |
| `progress-ring` | `ProgressRing` | `done`, `total`, `size?: 24 \| 40 \| 56`, `tone?: 'accent' \| 'success'`, `showValue?`, `label?` |
| `status-badge` | `StatusBadge`, `StatusDot` | `status: GameStatus`, `size?: 'sm' \| 'md'` |
| `status-picker` | `StatusPicker` | `value: GameStatus \| null`, `onChange`, `disabled?`, `align?` |
| `rating-stars` | `RatingStars` | `value: number \| null` (1–10), `onChange?`, `readOnly?`, `size?: 16 \| 20 \| 24`, `showLabel?` |
| `metacritic-badge` | `MetacriticBadge` | `score`, `url?` |
| `dialog` | `Dialog`, `DialogTrigger`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`, `DialogFooter`, `DialogClose` | `size?: 480 \| 640 \| 800` на `DialogContent` |
| `popover` | `Popover`, `PopoverTrigger`, `PopoverContent`, `PopoverAnchor` | |
| `dropdown-menu` | `DropdownMenu`, `DropdownMenuTrigger`, `DropdownMenuContent`, `DropdownMenuItem`, `DropdownMenuSub*`, `DropdownMenuSeparator`, `DropdownMenuLabel`, `DropdownMenuCheckboxItem` | |
| `context-menu` | `ContextMenu`, `ContextMenuTrigger`, `ContextMenuContent`, `ContextMenuItem`, `ContextMenuSub*`, `ContextMenuSeparator` | |
| `tooltip` | `TooltipProvider`, `Tooltip`, `TooltipTrigger`, `TooltipContent` | задержка 400 мс по умолчанию |
| `toast` | `Toaster`, `toast(options)`, `useToastStore` | `toast({ title, description?, tone?: 'info' \| 'success' \| 'danger', action?: {label, onClick}, duration? })` |
| `slider` | `Slider`, `RangeSlider` | `Slider: { min, max, step?, value: number, onChange(v: number) }`; `RangeSlider: { min, max, value: [number, number], onChange, step?, formatValue? }` |
| `switch` | `Switch` | `checked`, `onChange`, `label?` |
| `checkbox` | `Checkbox` | `checked`, `onChange`, `indeterminate?`, `label?` |
| `tabs` | `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` | |
| `combobox` | `Combobox` | `items: Array<{ value: string \| number; label: string; icon?: ReactNode; count?: number }>`; одиночный режим — `value: string \| number \| null`, `onChange(v)`; `multiple` — `value: string[]`, `onChange(v: string[])`; ещё `placeholder?`, `onCreate?(query)` (пункт «Создать …»), `onSearch?(query)` (внешний поиск — компонент не фильтрует сам), `disabled?` |
| `select` | `Select`, `SelectItem` | тонкая обёртка Radix Select под токены |
| `skeleton` | `Skeleton` | `className` |
| `empty-state` | `EmptyState` | `icon`, `title`, `description?`, `action?` |
| `scroll-area` | `ScrollArea` | overlay-скроллбар 8 px |
| `separator` | `Separator` | |
| `avatar` | `Avatar` | `src?`, `name`, `size?` |
| `badge` | `Badge` | `tone?: 'neutral' \| 'accent' \| 'success' \| 'warning' \| 'danger'` |
| `collapsible-section` | `CollapsibleSection` | `title`, `count?`, `defaultOpen?`, `storageKey?` |
| `image` | `CoverImage` | `fileName`, `title`, `dominantColor?`, `ratio?: '3/4' \| '16/9'`, `size?` — плейсхолдер + lazy + fade |
| `kbd` | `Kbd` | `keys: string[]` |
| `bloom` | `BloomBackdrop` | `colorA?`, `colorB?` — два свечения сцены (не более двух на экран) |

Кнопки статуса, звёзды и кольцо — единственные места с цветами статуса/успеха
(правила 1–3 из ТЗ 04 §1).
