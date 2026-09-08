import i18next from 'i18next'
import { initReactI18next } from 'react-i18next'
import { setFormatLocale } from '@/lib/format'
import type { Locale } from '@shared/constants'

/**
 * Словари собираются автоматически из `./ru/*.json` и `./en/*.json` (05 §7).
 * Каждый экран добавляет свой файл — правки в этом модуле не нужны.
 * Всё сливается в один namespace `translation`, поэтому ключи плоские: `status.playing`.
 */
type Dict = Record<string, unknown>

function collect(modules: Record<string, unknown>): Dict {
  const result: Dict = {}
  for (const value of Object.values(modules)) {
    const dict = (value as { default?: Dict }).default ?? (value as Dict)
    Object.assign(result, dict)
  }
  return result
}

const ru = collect(import.meta.glob('./ru/*.json', { eager: true }))
const en = collect(import.meta.glob('./en/*.json', { eager: true }))

export async function initI18n(locale: Locale): Promise<typeof i18next> {
  await i18next.use(initReactI18next).init({
    lng: locale,
    fallbackLng: 'ru',
    resources: {
      ru: { translation: ru },
      en: { translation: en }
    },
    interpolation: { escapeValue: false },
    returnNull: false
  })
  setFormatLocale(locale)
  return i18next
}

export async function changeLocale(locale: Locale): Promise<void> {
  await i18next.changeLanguage(locale)
  setFormatLocale(locale)
  document.documentElement.lang = locale
}

export { i18next }
