/**
 * Сборка Markdown для экспорта списка (10 §1, итерация 2).
 *
 * Чистые функции без Node и DOM: живут в `shared`, чтобы renderer собирал текст
 * с уже локализованными подписями, а main только показывал диалог и писал файл.
 */

export interface ListMarkdownItem {
  title: string
  releaseYear: number | null
  /** Готовые локализованные части строки: статус, оценка, часы, платформа. */
  meta: string[]
  note: string | null
}

export interface ListMarkdownInput {
  name: string
  description: string | null
  /** Нумерованный список для ранжированных подборок (06 §3.2), иначе маркеры. */
  ranked: boolean
  /** Строка итогов под заголовком: «12 игр · пройдено 5 · 61 ч». */
  summary: string
  items: ListMarkdownItem[]
  /** Подпись внизу файла — дата экспорта и имя приложения. */
  footer: string | null
}

/**
 * Экранирует символы, которые Markdown иначе примет за разметку.
 * Названия игр — чужой текст: «S.T.A.L.K.E.R.», «[Prototype]», «*NSYNC»
 * иначе ломали бы жирное начертание и ссылки.
 */
export function escapeMarkdown(text: string): string {
  return text.replace(/([\\`*_{}[\]<>()#+\-.!|])/g, '\\$1')
}

/** Многострочная заметка становится цитатой, поэтому префикс нужен каждой строке. */
function quote(note: string, indent: string): string {
  return note
    .split(/\r?\n/)
    .map((line) => `${indent}> ${escapeMarkdown(line.trim())}`)
    .join('\n')
}

export function buildListMarkdown(input: ListMarkdownInput): string {
  const blocks: string[] = [`# ${escapeMarkdown(input.name)}`]

  if (input.description) blocks.push(escapeMarkdown(input.description.trim()))
  blocks.push(`_${input.summary}_`)

  if (input.items.length > 0) {
    const lines = input.items.map((item, index) => {
      const marker = input.ranked ? `${index + 1}.` : '-'
      // Отступ вложенной цитаты равен ширине маркера, иначе она выпадает из пункта.
      const indent = ' '.repeat(marker.length + 1)
      const year = item.releaseYear === null ? '' : ` (${item.releaseYear})`
      const meta = item.meta.length > 0 ? ` — ${item.meta.map(escapeMarkdown).join(' · ')}` : ''
      const head = `${marker} **${escapeMarkdown(item.title)}**${year}${meta}`
      return item.note ? `${head}\n${quote(item.note, indent)}` : head
    })
    blocks.push(lines.join('\n'))
  }

  if (input.footer) blocks.push(`---\n\n${escapeMarkdown(input.footer)}`)

  return `${blocks.join('\n\n')}\n`
}

/** Имя файла из названия списка: без разделителей пути и запрещённых в Windows символов. */
export function markdownFileName(name: string): string {
  const safe = [...name]
    // Управляющие коды в именах файлов недопустимы, а regexp с ними запрещён линтером.
    .map((char) => ((char.codePointAt(0) ?? 0) < 0x20 ? ' ' : char))
    .join('')
    // Запрещённые в именах файлов Windows символы.
    .replace(/[\\/:*?"<>|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    // Windows не хранит имена, заканчивающиеся точкой.
    .replace(/\.+$/, '')
    .slice(0, 80)
    .trim()
  return `${safe.length > 0 ? safe : 'list'}.md`
}
