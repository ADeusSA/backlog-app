/**
 * Проверка правила ТЗ 01 §14 и 04 §8: цвета и длительности в компонентах берутся только из токенов.
 * Ищет литеральные цвета (#rrggbb, rgb(), hsl()) и «магические» длительности в мс за пределами
 * файлов, где им место (tokens.css, lib/color.ts, lib/motion.ts, витрина, статические карты).
 *
 * Запуск: npx tsx scripts/check-tokens.ts   (или npm run check:tokens)
 * Возвращает код 1, если есть нарушения — годится для CI.
 */
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname ?? __dirname, '..')
const SCAN_DIRS = [path.join(ROOT, 'src', 'renderer', 'src')]

/**
 * Файлы, где литеральные цвета допустимы по смыслу: сами токены, цветовые утилиты,
 * витрина и палитры-данные (цвет списка/жанра хранится в БД строкой `#RRGGBB`, 02 §3.10).
 */
const ALLOWED = [
  path.join('styles', 'tokens.css'),
  path.join('lib', 'color.ts'),
  path.join('lib', 'motion.ts'),
  path.join('components', 'dev', 'ui-showcase.tsx'),
  path.join('lists', 'components', 'list-icons.ts')
]

/** Тесты используют фикстуры с цветами — это данные, а не оформление. */
const ALLOWED_PATTERN = /\.test\.(ts|tsx)$/

const HEX = /#[0-9a-fA-F]{3,8}\b/g
const FUNC = /\b(?:rgba?|hsla?)\(/g
const DURATION = /\b(?:duration|transition)\s*:\s*['"`]?\d+m?s/gi

interface Violation {
  file: string
  line: number
  text: string
  rule: string
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full, out)
    else if (/\.(tsx?|css)$/.test(entry.name)) out.push(full)
  }
  return out
}

function isAllowed(file: string): boolean {
  return ALLOWED.some((allowed) => file.endsWith(allowed)) || ALLOWED_PATTERN.test(file)
}

function check(file: string): Violation[] {
  const rel = path.relative(ROOT, file)
  const violations: Violation[] = []
  const lines = fs.readFileSync(file, 'utf8').split('\n')

  lines.forEach((line, index) => {
    if (line.trimStart().startsWith('//') || line.trimStart().startsWith('*')) return
    for (const [rule, regex] of [
      ['литеральный цвет', HEX],
      ['цветовая функция', FUNC],
      ['длительность вне словаря движения', DURATION]
    ] as const) {
      regex.lastIndex = 0
      if (regex.test(line)) {
        violations.push({ file: rel, line: index + 1, text: line.trim().slice(0, 120), rule })
      }
    }
  })

  return violations
}

const files = SCAN_DIRS.flatMap((dir) => (fs.existsSync(dir) ? walk(dir) : []))
const violations = files.filter((file) => !isAllowed(file)).flatMap(check)

if (violations.length === 0) {
  console.log(`check-tokens: чисто, проверено файлов: ${files.length}`)
  process.exit(0)
}

console.log(`check-tokens: нарушений ${violations.length} (проверено файлов: ${files.length})\n`)
for (const violation of violations) {
  console.log(`${violation.file}:${violation.line}  ${violation.rule}`)
  console.log(`    ${violation.text}`)
}
console.log('\nИспользуйте переменные из src/renderer/src/styles/tokens.css и словарь @/lib/motion.')
process.exit(1)
