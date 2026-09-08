import { useEffect } from 'react'
import { useRouterState } from '@tanstack/react-router'
import i18n from 'i18next'
import { useUiStore } from '@/stores/ui-store'

/**
 * Ведёт стек посещённых экранов — для выпадающих списков у кнопок «назад/вперёд»
 * (05 §2). Сам переход выполняет история роутера.
 *
 * Шаг назад/вперёд не добавляет запись, а сдвигает указатель: иначе стек рос
 * дубликатами и «вперёд» никогда не был доступен.
 */
export function useHistoryTracker(): void {
  const location = useRouterState({ select: (s) => s.location })

  useEffect(() => {
    const store = useUiStore.getState()
    const { history, historyIndex } = store
    const href = location.href

    if (history[historyIndex]?.href === href) return
    if (historyIndex > 0 && history[historyIndex - 1]?.href === href) {
      store.setHistoryIndex(historyIndex - 1)
      return
    }
    if (history[historyIndex + 1]?.href === href) {
      store.setHistoryIndex(historyIndex + 1)
      return
    }

    store.pushHistory({ href, title: titleForPath(location.pathname), at: Date.now() })
  }, [location.href, location.pathname])
}

/**
 * Заголовок по маршруту. Для страниц сущностей возвращает родовое название —
 * конкретное имя подставляет `resolveHistoryTitle` в момент отрисовки списка,
 * когда данные уже в кеше.
 */
function titleForPath(pathname: string): string {
  const t = i18n.t.bind(i18n)
  if (pathname.startsWith('/games/')) return t('nav.game')
  if (pathname.startsWith('/lists/')) return t('nav.list')
  if (pathname.startsWith('/series/')) return t('nav.seriesOne')
  if (pathname.startsWith('/companies/')) return t('nav.company')
  if (pathname.startsWith('/catalog')) return t('nav.catalog')
  if (pathname.startsWith('/settings')) return t('nav.settings')
  if (pathname.startsWith('/library')) return t('nav.library')
  if (pathname.startsWith('/lists')) return t('nav.lists')
  if (pathname.startsWith('/series')) return t('nav.series')
  if (pathname.startsWith('/companies')) return t('nav.companies')
  if (pathname.startsWith('/search')) return t('nav.searchResults')
  if (pathname.startsWith('/achievements')) return t('nav.achievements')
  return t('nav.profile')
}
