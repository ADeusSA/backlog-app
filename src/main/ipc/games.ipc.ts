import { handle } from './register'
import { getDb } from '../db/connection'
import { getGameDetail } from '../db/repositories/games.repo'
import { quickSearch } from '../services/catalog-games.service'

/** Страница игры и быстрый поиск по каталогу (ТЗ 06 §6). */
export function registerGamesIpc(): void {
  handle('games.getDetail', ({ id }) => getGameDetail(getDb(), id))

  handle('games.quickSearch', ({ q, limit, onlyLibrary, excludeIds }) =>
    quickSearch(q, {
      limit,
      ...(onlyLibrary !== undefined ? { onlyLibrary } : {}),
      ...(excludeIds !== undefined ? { excludeIds } : {})
    })
  )
}
