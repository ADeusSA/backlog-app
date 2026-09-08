import type { Settings } from '@shared/schema/settings'

/** Тема интерфейса (04 §8). «Системная» разворачивается в одну из двух. */
export type ThemeSetting = Settings['theme']
export type ResolvedTheme = 'dark' | 'light'

const SYSTEM_QUERY = '(prefers-color-scheme: dark)'

export function systemTheme(): ResolvedTheme {
  return window.matchMedia(SYSTEM_QUERY).matches ? 'dark' : 'light'
}

export function resolveTheme(setting: ThemeSetting): ResolvedTheme {
  return setting === 'system' ? systemTheme() : setting
}

/**
 * Ставит `data-theme` на `<html>` — по нему переключается блок токенов светлой темы.
 * Тёмная остаётся значением по умолчанию, поэтому атрибут для неё тоже проставляется явно:
 * так selector `:root[data-theme='light']` никогда не срабатывает по ошибке.
 */
export function applyTheme(setting: ThemeSetting): ResolvedTheme {
  const resolved = resolveTheme(setting)
  document.documentElement.dataset['theme'] = resolved
  return resolved
}

/**
 * Подписка на смену системной темы: нужна только в режиме «Системная».
 * Возвращает функцию отписки.
 */
export function watchSystemTheme(onChange: () => void): () => void {
  const media = window.matchMedia(SYSTEM_QUERY)
  media.addEventListener('change', onChange)
  return () => media.removeEventListener('change', onChange)
}
