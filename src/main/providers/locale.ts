/**
 * Язык, на котором просим данные у провайдеров.
 *
 * Берётся из языка интерфейса (`settings.locale`): при русском интерфейсе описания и
 * названия приходят по-русски, если у источника они есть, иначе — по-английски.
 *
 * Важно: **структурные** поля (жанры, категории, дата релиза) мы всегда читаем из
 * английского ответа. Их значения сопоставляются со справочниками по slug
 * (`taxonomy-map.ts`), а локализованные «Экшены» и «Для одного игрока» такого
 * сопоставления не переживают; дата в русской локали приходит как «18 апр. 2011 г.».
 */
import type { Locale } from '@shared/constants'
import { getSettings } from '../services/settings.service'
import { log } from '../log'

export function uiLanguage(): Locale {
  try {
    return getSettings().locale
  } catch (err) {
    log.warn('[providers] не удалось прочитать язык интерфейса, берём английский', err)
    return 'en'
  }
}

/** Код языка Steam для параметра `l=` (`https://partner.steamgames.com/doc/store/localization`). */
export function steamLanguage(locale: Locale): string {
  return locale === 'ru' ? 'russian' : 'english'
}

/**
 * Название с витрины: у русских изданий Steam оборачивает его в кавычки-ёлочки —
 * «Ведьмак 3: Дикая Охота — Полное издание». В каталоге они не нужны.
 */
export function unquote(title: string | undefined): string | null {
  const value = (title ?? '').trim()
  if (!value) return null
  const stripped = value
    .replace(/^[«„"']+/u, '')
    .replace(/[»“"']+$/u, '')
    .trim()
  return stripped || null
}
