/**
 * Чистые текстовые утилиты, общие для main и renderer (02 §4, 05 §6).
 * Никаких зависимостей от Node или DOM.
 */

const CYR_TO_LAT: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y',
  к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f',
  х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya'
}

/** Обратная таблица: латинские сочетания → кириллица (длинные раньше коротких). */
const LAT_TO_CYR: Array<[string, string]> = [
  ['sch', 'щ'], ['sh', 'ш'], ['ch', 'ч'], ['zh', 'ж'], ['yu', 'ю'], ['ya', 'я'], ['yo', 'ё'],
  ['kh', 'х'], ['ts', 'ц'], ['ee', 'и'], ['oo', 'у'], ['ck', 'к'], ['th', 'т'], ['ph', 'ф'],
  ['a', 'а'], ['b', 'б'], ['c', 'к'], ['d', 'д'], ['e', 'е'], ['f', 'ф'], ['g', 'г'], ['h', 'х'],
  ['i', 'и'], ['j', 'дж'], ['k', 'к'], ['l', 'л'], ['m', 'м'], ['n', 'н'], ['o', 'о'], ['p', 'п'],
  ['q', 'к'], ['r', 'р'], ['s', 'с'], ['t', 'т'], ['u', 'у'], ['v', 'в'], ['w', 'в'], ['x', 'кс'],
  ['y', 'й'], ['z', 'з']
]

/** Кириллица → латиница («елден» → «elden»). */
export function translitToLatin(input: string): string {
  let out = ''
  for (const ch of input.toLowerCase()) {
    out += CYR_TO_LAT[ch] ?? ch
  }
  return out
}

/** Латиница → кириллица («elden» → «елден»); приблизительно, для поискового индекса. */
export function translitToCyrillic(input: string): string {
  let rest = input.toLowerCase()
  let out = ''
  outer: while (rest.length > 0) {
    for (const [lat, cyr] of LAT_TO_CYR) {
      if (rest.startsWith(lat)) {
        out += cyr
        rest = rest.slice(lat.length)
        continue outer
      }
    }
    out += rest[0]
    rest = rest.slice(1)
  }
  return out
}

/** Есть ли в строке кириллица. */
export function hasCyrillic(input: string): boolean {
  return /[Ѐ-ӿ]/.test(input)
}

/**
 * Варианты запроса для поиска: исходный + транслитерированный в другую письменность.
 * Используется командной палитрой и полнотекстовым поиском (05 §6).
 */
export function searchVariants(query: string): string[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  const variants = new Set<string>([q])
  if (hasCyrillic(q)) variants.add(translitToLatin(q))
  else variants.add(translitToCyrillic(q))
  return [...variants].filter((v) => v.length > 0)
}

const LEADING_ARTICLES = ['the', 'a', 'an']

/**
 * Название для сортировки: убирает ведущий артикль и переносит его в конец через запятую.
 * «The Witcher 3» → «Witcher 3, The». Для кириллицы — без изменений (02 §4).
 */
export function makeSortTitle(title: string): string {
  const trimmed = title.trim().replace(/^[«"'`]+/, '')
  const match = /^(\S+)\s+(.+)$/.exec(trimmed)
  if (!match) return trimmed
  const [, first, rest] = match
  if (first && rest && LEADING_ARTICLES.includes(first.toLowerCase())) {
    return `${rest}, ${first}`
  }
  return trimmed
}

/**
 * Slug: транслит в латиницу, lower-kebab. Уникальность обеспечивается вызывающим кодом
 * через suffix -2, -3 (см. ensureUniqueSlug).
 */
export function makeSlug(input: string): string {
  const base = translitToLatin(input.trim().toLowerCase())
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return base || 'item'
}

/**
 * Возвращает slug, которого нет среди занятых: base, base-2, base-3…
 * `taken` — предикат «такой slug уже занят».
 */
export function ensureUniqueSlug(base: string, taken: (slug: string) => boolean): string {
  if (!taken(base)) return base
  for (let i = 2; i < 10_000; i += 1) {
    const candidate = `${base}-${i}`
    if (!taken(candidate)) return candidate
  }
  return `${base}-${Date.now()}`
}

/** Первые буквы названия для плейсхолдера обложки. */
export function initials(title: string, max = 2): string {
  const words = title.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  return words
    .slice(0, max)
    .map((w) => [...w][0]?.toUpperCase() ?? '')
    .join('')
}

/** Год из даты формата YYYY | YYYY-MM | YYYY-MM-DD. */
export function yearFromDate(date: string | null | undefined): number | null {
  if (!date) return null
  const m = /^(\d{4})/.exec(date)
  return m?.[1] ? Number(m[1]) : null
}

/** Нормализация hex-цвета к виду #RRGGBB (или null). */
export function normalizeHex(value: string | null | undefined): string | null {
  if (!value) return null
  const v = value.trim().toLowerCase()
  const short = /^#([0-9a-f]{3})$/.exec(v)
  if (short?.[1]) {
    const [r, g, b] = short[1]
    return `#${r}${r}${g}${g}${b}${b}`
  }
  return /^#[0-9a-f]{6}$/.test(v) ? v : null
}
