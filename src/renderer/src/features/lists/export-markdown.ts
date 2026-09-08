import type { TFunction } from 'i18next'
import type { ListDto } from '@shared/schema/entities'
import type { Sort } from '@shared/schema/filters'
import { buildListMarkdown, markdownFileName, type ListMarkdownItem } from '@shared/markdown'
import { call } from '@/platform/api'
import { formatDate, formatPlaytime } from '@/lib/format'

/**
 * Экспорт списка в Markdown (10 §1, итерация 2).
 *
 * Текст собирается здесь, а не в main: только у renderer есть словари i18n и
 * `Intl` с локалью интерфейса. main получает готовую строку, показывает диалог
 * сохранения и пишет файл.
 */
export async function exportListToMarkdown(
  list: ListDto,
  sort: Sort,
  t: TFunction
): Promise<string | null> {
  const result = await call('collection.query', {
    scope: { kind: 'list', listId: list.id },
    filters: {},
    sort
  })

  const items: ListMarkdownItem[] = result.items.map((game) => {
    const meta: string[] = []
    if (game.status) meta.push(t(`status.${game.status}`))
    if (game.isMastered) meta.push(t('collection.card.mastered'))
    if (game.rating !== null) meta.push(`★ ${game.rating}/10`)
    if (game.playtimeMinutes) meta.push(formatPlaytime(game.playtimeMinutes))
    return {
      title: game.title,
      releaseYear: game.releaseYear,
      meta,
      note: game.positionNote
    }
  })

  const markdown = buildListMarkdown({
    name: list.name,
    description: list.description,
    ranked: list.isRanked,
    summary: t('lists.export.summary', {
      games: t('common.games', { count: result.total }),
      done: result.progress.done,
      playtime: formatPlaytime(result.playtimeMinutes, true)
    }),
    items,
    footer: t('lists.export.footer', { date: formatDate(new Date().toISOString()) })
  })

  const saved = await call('lists.exportMarkdown', {
    fileName: markdownFileName(list.name),
    markdown
  })
  return saved?.path ?? null
}
