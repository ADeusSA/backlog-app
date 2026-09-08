/**
 * Проверка полноты словарей (ТЗ 09 §7): каждый литеральный ключ `t('…')`,
 * `labelKey: '…'` и `titleKey: '…'` должен существовать в ru и en.
 * Дополнительно сверяет наборы ключей между языками — с поправкой на то, что
 * у русского есть формы `_few`/`_many`, которых в английском не бывает.
 *
 * Запуск: npx tsx scripts/check-i18n.ts   (или npm run check:i18n)
 * Возвращает код 1, если есть пропуски — годится для CI.
 */
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname ?? __dirname, '..')
const SRC = path.join(ROOT, 'src', 'renderer', 'src')
const I18N = path.join(SRC, 'i18n')

/** Формы множественного числа, которых нет в английском (у него только one/other). */
const RU_ONLY_SUFFIXES = ['_few', '_many']

const KEY_PATTERNS = [
  /\bt\(\s*'([a-zA-Z0-9_.-]+)'/g,
  /labelKey:\s*'([a-zA-Z0-9_.-]+)'/g,
  /titleKey:\s*'([a-zA-Z0-9_.-]+)'/g
]

function loadLocale(lang: string): Set<string> {
  const dir = path.join(I18N, lang)
  const keys = new Set<string>()
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith('.json')) continue
    const json = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8')) as Record<string, string>
    for (const key of Object.keys(json)) keys.add(key)
  }
  return keys
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name !== 'i18n') walk(full, out)
    } else if (/\.tsx?$/.test(entry.name)) {
      out.push(full)
    }
  }
  return out
}

const ru = loadLocale('ru')
const en = loadLocale('en')

const used = new Map<string, string>()
for (const file of walk(SRC)) {
  const text = fs.readFileSync(file, 'utf8')
  for (const pattern of KEY_PATTERNS) {
    pattern.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = pattern.exec(text))) {
      const key = match[1]!
      // Ключи без точки — это не идентификаторы словаря (например, `t(label)`).
      if (key.includes('.') && !used.has(key)) used.set(key, path.relative(ROOT, file))
    }
  }
}

const problems: string[] = []
for (const [key, file] of used) {
  if (!ru.has(key)) problems.push(`нет в ru: ${key}  (${file})`)
  if (!en.has(key)) problems.push(`нет в en: ${key}  (${file})`)
}
for (const key of ru) {
  if (RU_ONLY_SUFFIXES.some((suffix) => key.endsWith(suffix))) continue
  if (!en.has(key)) problems.push(`есть в ru, нет в en: ${key}`)
}
for (const key of en) {
  if (!ru.has(key)) problems.push(`есть в en, нет в ru: ${key}`)
}

if (problems.length > 0) {
  console.error(`Найдено расхождений в словарях: ${problems.length}`)
  for (const line of problems.sort()) console.error('  ' + line)
  process.exit(1)
}

console.log(`Словари в порядке: ${used.size} ключей из кода, ru ${ru.size} / en ${en.size}.`)
