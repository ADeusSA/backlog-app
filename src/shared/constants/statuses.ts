/** Семь взаимоисключающих статусов игры (ТЗ 02 §3.8). */
export const GAME_STATUSES = [
  'wishlist',
  'backlog',
  'playing',
  'completed',
  'shelved',
  'dropped',
  'played'
] as const

export type GameStatus = (typeof GAME_STATUSES)[number]

export interface StatusMeta {
  /** Ключ статуса */
  key: GameStatus
  /** Ключ в словаре i18n: status.<key> */
  i18nKey: string
  /** CSS-переменная цвета статуса (04 §2.3) */
  colorVar: string
  /** Имя иконки lucide */
  icon: string
  /** Горячая клавиша 1..7 на странице игры (05 §5) */
  hotkey: number
}

export const STATUS_META: Record<GameStatus, StatusMeta> = {
  wishlist: { key: 'wishlist', i18nKey: 'status.wishlist', colorVar: '--st-wishlist', icon: 'heart', hotkey: 1 },
  backlog: { key: 'backlog', i18nKey: 'status.backlog', colorVar: '--st-backlog', icon: 'library', hotkey: 2 },
  playing: { key: 'playing', i18nKey: 'status.playing', colorVar: '--st-playing', icon: 'play', hotkey: 3 },
  completed: { key: 'completed', i18nKey: 'status.completed', colorVar: '--st-completed', icon: 'circle-check-big', hotkey: 4 },
  shelved: { key: 'shelved', i18nKey: 'status.shelved', colorVar: '--st-shelved', icon: 'circle-pause', hotkey: 5 },
  dropped: { key: 'dropped', i18nKey: 'status.dropped', colorVar: '--st-dropped', icon: 'circle-x', hotkey: 6 },
  played: { key: 'played', i18nKey: 'status.played', colorVar: '--st-played', icon: 'gamepad-2', hotkey: 7 }
}

/** Порядок статусов в UI (сайдбар, фильтры, stacked-bar профиля). */
export const STATUS_ORDER: GameStatus[] = [
  'playing',
  'backlog',
  'completed',
  'shelved',
  'dropped',
  'wishlist',
  'played'
]

/** Статусы, при которых разрешена оценка (02 §4). */
export const RATEABLE_STATUSES: GameStatus[] = ['playing', 'completed', 'shelved', 'dropped', 'played']

/** Статусы, при которых разрешён флаг «100 %» (02 §4). */
export const MASTERABLE_STATUSES: GameStatus[] = ['completed', 'played']
