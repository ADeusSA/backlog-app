/**
 * Статическая карта стран (ТЗ 02 §3.5): ISO 3166-1 alpha-2 + numeric (так отдаёт IGDB),
 * русское и английское название. Флаги рисуются набором `flag-icons` по коду в нижнем регистре.
 */

export interface Country {
  code: string
  numeric: number
  ru: string
  en: string
}

export const COUNTRIES: Country[] = [
  { code: 'JP', numeric: 392, ru: 'Япония', en: 'Japan' },
  { code: 'US', numeric: 840, ru: 'США', en: 'United States' },
  { code: 'GB', numeric: 826, ru: 'Великобритания', en: 'United Kingdom' },
  { code: 'PL', numeric: 616, ru: 'Польша', en: 'Poland' },
  { code: 'FR', numeric: 250, ru: 'Франция', en: 'France' },
  { code: 'DE', numeric: 276, ru: 'Германия', en: 'Germany' },
  { code: 'CA', numeric: 124, ru: 'Канада', en: 'Canada' },
  { code: 'SE', numeric: 752, ru: 'Швеция', en: 'Sweden' },
  { code: 'FI', numeric: 246, ru: 'Финляндия', en: 'Finland' },
  { code: 'NO', numeric: 578, ru: 'Норвегия', en: 'Norway' },
  { code: 'DK', numeric: 208, ru: 'Дания', en: 'Denmark' },
  { code: 'NL', numeric: 528, ru: 'Нидерланды', en: 'Netherlands' },
  { code: 'BE', numeric: 56, ru: 'Бельгия', en: 'Belgium' },
  { code: 'ES', numeric: 724, ru: 'Испания', en: 'Spain' },
  { code: 'IT', numeric: 380, ru: 'Италия', en: 'Italy' },
  { code: 'PT', numeric: 620, ru: 'Португалия', en: 'Portugal' },
  { code: 'CH', numeric: 756, ru: 'Швейцария', en: 'Switzerland' },
  { code: 'AT', numeric: 40, ru: 'Австрия', en: 'Austria' },
  { code: 'CZ', numeric: 203, ru: 'Чехия', en: 'Czechia' },
  { code: 'SK', numeric: 703, ru: 'Словакия', en: 'Slovakia' },
  { code: 'HU', numeric: 348, ru: 'Венгрия', en: 'Hungary' },
  { code: 'RO', numeric: 642, ru: 'Румыния', en: 'Romania' },
  { code: 'UA', numeric: 804, ru: 'Украина', en: 'Ukraine' },
  { code: 'RU', numeric: 643, ru: 'Россия', en: 'Russia' },
  { code: 'BY', numeric: 112, ru: 'Беларусь', en: 'Belarus' },
  { code: 'KZ', numeric: 398, ru: 'Казахстан', en: 'Kazakhstan' },
  { code: 'CN', numeric: 156, ru: 'Китай', en: 'China' },
  { code: 'KR', numeric: 410, ru: 'Южная Корея', en: 'South Korea' },
  { code: 'TW', numeric: 158, ru: 'Тайвань', en: 'Taiwan' },
  { code: 'SG', numeric: 702, ru: 'Сингапур', en: 'Singapore' },
  { code: 'AU', numeric: 36, ru: 'Австралия', en: 'Australia' },
  { code: 'NZ', numeric: 554, ru: 'Новая Зеландия', en: 'New Zealand' },
  { code: 'BR', numeric: 76, ru: 'Бразилия', en: 'Brazil' },
  { code: 'AR', numeric: 32, ru: 'Аргентина', en: 'Argentina' },
  { code: 'MX', numeric: 484, ru: 'Мексика', en: 'Mexico' },
  { code: 'IL', numeric: 376, ru: 'Израиль', en: 'Israel' },
  { code: 'TR', numeric: 792, ru: 'Турция', en: 'Türkiye' },
  { code: 'IN', numeric: 356, ru: 'Индия', en: 'India' },
  { code: 'IE', numeric: 372, ru: 'Ирландия', en: 'Ireland' },
  { code: 'IS', numeric: 352, ru: 'Исландия', en: 'Iceland' },
  { code: 'EE', numeric: 233, ru: 'Эстония', en: 'Estonia' },
  { code: 'LV', numeric: 428, ru: 'Латвия', en: 'Latvia' },
  { code: 'LT', numeric: 440, ru: 'Литва', en: 'Lithuania' },
  { code: 'HR', numeric: 191, ru: 'Хорватия', en: 'Croatia' },
  { code: 'SI', numeric: 705, ru: 'Словения', en: 'Slovenia' },
  { code: 'RS', numeric: 688, ru: 'Сербия', en: 'Serbia' },
  { code: 'BG', numeric: 100, ru: 'Болгария', en: 'Bulgaria' },
  { code: 'GR', numeric: 300, ru: 'Греция', en: 'Greece' },
  { code: 'ZA', numeric: 710, ru: 'ЮАР', en: 'South Africa' },
  { code: 'TH', numeric: 764, ru: 'Таиланд', en: 'Thailand' },
  { code: 'VN', numeric: 704, ru: 'Вьетнам', en: 'Vietnam' },
  { code: 'MY', numeric: 458, ru: 'Малайзия', en: 'Malaysia' },
  { code: 'ID', numeric: 360, ru: 'Индонезия', en: 'Indonesia' },
  { code: 'PH', numeric: 608, ru: 'Филиппины', en: 'Philippines' },
  { code: 'CL', numeric: 152, ru: 'Чили', en: 'Chile' },
  { code: 'UY', numeric: 858, ru: 'Уругвай', en: 'Uruguay' },
  { code: 'AE', numeric: 784, ru: 'ОАЭ', en: 'United Arab Emirates' },
  { code: 'SA', numeric: 682, ru: 'Саудовская Аравия', en: 'Saudi Arabia' },
  { code: 'LU', numeric: 442, ru: 'Люксембург', en: 'Luxembourg' },
  { code: 'MT', numeric: 470, ru: 'Мальта', en: 'Malta' },
  { code: 'CY', numeric: 196, ru: 'Кипр', en: 'Cyprus' }
]

export const COUNTRY_BY_CODE = new Map(COUNTRIES.map((country) => [country.code, country]))

export function countryName(code: string | null | undefined, locale: 'ru' | 'en' = 'ru'): string {
  if (!code) return ''
  const country = COUNTRY_BY_CODE.get(code.toUpperCase())
  return country ? country[locale] : code
}

/** CSS-класс набора `flag-icons` для флага 16×12. */
export function flagClass(code: string | null | undefined): string {
  return code ? `fi fi-${code.toLowerCase()}` : ''
}
