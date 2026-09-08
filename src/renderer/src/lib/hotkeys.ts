/**
 * Единая таблица горячих клавиш (ТЗ 05 §5). Значения по умолчанию — здесь,
 * пользовательские переопределения хранятся в `settings.hotkeys` (id → комбинация).
 */

export interface Hotkey {
  id: string
  /** Комбинация в нормализованном виде: 'ctrl+k', 'alt+arrowleft', 'shift+?' */
  combo: string
  /** Ключ i18n с описанием действия */
  i18nKey: string
  /** Группа для шпаргалки */
  group: 'global' | 'library' | 'game' | 'collection'
  /** Работает ли, когда фокус в поле ввода */
  allowInInput?: boolean
}

export const HOTKEYS: Hotkey[] = [
  { id: 'palette', combo: 'ctrl+k', i18nKey: 'hotkey.palette', group: 'global', allowInInput: true },
  { id: 'sidebar', combo: 'ctrl+b', i18nKey: 'hotkey.sidebar', group: 'global' },
  { id: 'newGame', combo: 'ctrl+n', i18nKey: 'hotkey.newGame', group: 'global' },
  { id: 'newList', combo: 'ctrl+shift+n', i18nKey: 'hotkey.newList', group: 'global' },
  { id: 'findInCollection', combo: 'ctrl+f', i18nKey: 'hotkey.findInCollection', group: 'collection' },
  { id: 'toggleFilters', combo: 'ctrl+shift+f', i18nKey: 'hotkey.toggleFilters', group: 'collection' },
  { id: 'settings', combo: 'ctrl+,', i18nKey: 'hotkey.settings', group: 'global' },
  { id: 'syncNow', combo: 'ctrl+shift+s', i18nKey: 'hotkey.syncNow', group: 'global' },
  { id: 'back', combo: 'alt+arrowleft', i18nKey: 'hotkey.back', group: 'global', allowInInput: true },
  { id: 'forward', combo: 'alt+arrowright', i18nKey: 'hotkey.forward', group: 'global', allowInInput: true },
  { id: 'up', combo: 'alt+arrowup', i18nKey: 'hotkey.up', group: 'global' },
  { id: 'help', combo: 'shift+?', i18nKey: 'hotkey.help', group: 'global' },
  { id: 'library.all', combo: 'ctrl+1', i18nKey: 'hotkey.libraryAll', group: 'library' },
  { id: 'library.playing', combo: 'ctrl+2', i18nKey: 'hotkey.libraryPlaying', group: 'library' },
  { id: 'library.backlog', combo: 'ctrl+3', i18nKey: 'hotkey.libraryBacklog', group: 'library' },
  { id: 'library.completed', combo: 'ctrl+4', i18nKey: 'hotkey.libraryCompleted', group: 'library' },
  { id: 'library.shelved', combo: 'ctrl+5', i18nKey: 'hotkey.libraryShelved', group: 'library' },
  { id: 'library.dropped', combo: 'ctrl+6', i18nKey: 'hotkey.libraryDropped', group: 'library' },
  { id: 'library.wishlist', combo: 'ctrl+7', i18nKey: 'hotkey.libraryWishlist', group: 'library' },
  { id: 'game.status', combo: 's', i18nKey: 'hotkey.gameStatus', group: 'game' },
  { id: 'game.rate', combo: 'r', i18nKey: 'hotkey.gameRate', group: 'game' },
  { id: 'game.time', combo: 't', i18nKey: 'hotkey.gameTime', group: 'game' },
  { id: 'game.list', combo: 'l', i18nKey: 'hotkey.gameList', group: 'game' },
  { id: 'game.favorite', combo: 'f', i18nKey: 'hotkey.gameFavorite', group: 'game' },
  { id: 'game.edit', combo: 'e', i18nKey: 'hotkey.gameEdit', group: 'game' },
  { id: 'save', combo: 'ctrl+s', i18nKey: 'hotkey.save', group: 'global', allowInInput: true }
]

export const HOTKEY_BY_ID: Record<string, Hotkey> = Object.fromEntries(
  HOTKEYS.map((h) => [h.id, h])
)

/** Сочетания «из коробки»: id действия → комбинация. */
export const DEFAULT_COMBOS: Record<string, string> = Object.fromEntries(
  HOTKEYS.map((h) => [h.id, h.combo])
)

export type ComboMap = Record<string, string>

/** Значения по умолчанию, перекрытые настройками пользователя. Незнакомые id игнорируются. */
export function resolveCombos(overrides: Record<string, string> | undefined): ComboMap {
  const map: ComboMap = { ...DEFAULT_COMBOS }
  for (const [id, combo] of Object.entries(overrides ?? {})) {
    if (map[id] !== undefined && combo) map[id] = combo
  }
  return map
}

/** Действие, которому назначено нажатое сочетание; `allowed` сужает поиск до нужной группы. */
export function idByCombo(combos: ComboMap, combo: string, allowed?: Set<string>): string | null {
  for (const [id, value] of Object.entries(combos)) {
    if (value === combo && (!allowed || allowed.has(id))) return id
  }
  return null
}

/**
 * Клавиши, которые нельзя назначать: ими закрывают диалоги и ходят по интерфейсу,
 * а `Escape` вдобавок отменяет саму запись сочетания.
 */
const RESERVED_KEYS = new Set(['escape', 'enter', 'tab', ' ', 'dead', 'unidentified'])

/** Годится ли записанное сочетание: не голый модификатор и не служебная клавиша. */
export function isAssignableCombo(combo: string): boolean {
  const parts = combo.split('+')
  const key = parts[parts.length - 1] ?? ''
  if (!key || ['ctrl', 'alt', 'shift'].includes(key)) return false
  return !RESERVED_KEYS.has(key)
}

/** id действия, которое уже занимает это сочетание (кроме самого `id`), либо null. */
export function comboConflict(combos: ComboMap, id: string, combo: string): string | null {
  for (const [other, value] of Object.entries(combos)) {
    if (other !== id && value === combo) return other
  }
  return null
}

/** Нормализует событие клавиатуры в строку вида 'ctrl+shift+f'. */
export function comboFromEvent(event: KeyboardEvent): string {
  const parts: string[] = []
  if (event.ctrlKey || event.metaKey) parts.push('ctrl')
  if (event.altKey) parts.push('alt')
  if (event.shiftKey) parts.push('shift')
  const key = event.key.toLowerCase()
  if (!['control', 'alt', 'shift', 'meta'].includes(key)) parts.push(key)
  return parts.join('+')
}

/** Находится ли фокус в поле ввода. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName.toLowerCase()
  return tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable
}

/** Человекочитаемая запись комбинации для шпаргалки и tooltip. */
export function formatCombo(combo: string): string {
  return combo
    .split('+')
    .map((part) => {
      switch (part) {
        case 'ctrl':
          return 'Ctrl'
        case 'alt':
          return 'Alt'
        case 'shift':
          return 'Shift'
        case 'arrowleft':
          return '←'
        case 'arrowright':
          return '→'
        case 'arrowup':
          return '↑'
        case 'arrowdown':
          return '↓'
        default:
          return part.length === 1 ? part.toUpperCase() : part
      }
    })
    .join(' + ')
}
