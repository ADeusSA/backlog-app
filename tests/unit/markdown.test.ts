import { describe, expect, it } from 'vitest'
import { buildListMarkdown, escapeMarkdown, markdownFileName } from '../../src/shared/markdown'

const base = {
  name: 'Cozy',
  description: null,
  ranked: false,
  summary: '2 игры · пройдено 1 · 12 ч',
  footer: null
}

describe('экспорт списка в Markdown (10 §1)', () => {
  it('собирает заголовок, итоги и пункты', () => {
    const md = buildListMarkdown({
      ...base,
      items: [
        { title: 'Stardew Valley', releaseYear: 2016, meta: ['Пройдена', '61 ч'], note: null },
        { title: 'Spiritfarer', releaseYear: null, meta: [], note: null }
      ]
    })
    expect(md).toBe(
      '# Cozy\n\n' +
        '_2 игры · пройдено 1 · 12 ч_\n\n' +
        '- **Stardew Valley** (2016) — Пройдена · 61 ч\n' +
        '- **Spiritfarer**\n'
    )
  })

  it('нумерует ранжированный список', () => {
    const md = buildListMarkdown({
      ...base,
      ranked: true,
      items: [
        { title: 'A', releaseYear: null, meta: [], note: null },
        { title: 'B', releaseYear: null, meta: [], note: null }
      ]
    })
    expect(md).toContain('1. **A**')
    expect(md).toContain('2. **B**')
  })

  it('экранирует разметку в названиях', () => {
    expect(escapeMarkdown('[Prototype] *NSYNC')).toBe('\\[Prototype\\] \\*NSYNC')
    const md = buildListMarkdown({
      ...base,
      items: [{ title: 'S.T.A.L.K.E.R.', releaseYear: 2007, meta: [], note: null }]
    })
    expect(md).toContain('**S\\.T\\.A\\.L\\.K\\.E\\.R\\.** (2007)')
  })

  it('переносит многострочную заметку в цитату с отступом пункта', () => {
    const md = buildListMarkdown({
      ...base,
      ranked: true,
      items: [{ title: 'A', releaseYear: null, meta: [], note: 'первая\nвторая' }]
    })
    expect(md).toContain('1. **A**\n   > первая\n   > вторая')
  })

  it('пустой список даёт файл без пунктов', () => {
    const md = buildListMarkdown({ ...base, items: [] })
    expect(md).toBe('# Cozy\n\n_2 игры · пройдено 1 · 12 ч_\n')
  })

  it('чистит имя файла от запрещённых символов', () => {
    expect(markdownFileName('Топ 10: RPG/JRPG?')).toBe('Топ 10 RPG JRPG.md')
    expect(markdownFileName('  Cozy  ')).toBe('Cozy.md')
    expect(markdownFileName('///')).toBe('list.md')
    expect(markdownFileName('name.')).toBe('name.md')
  })
})
