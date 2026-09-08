import { handle } from './register'
import {
  addFromFilterService,
  addGamesToListService,
  deleteList,
  duplicateList,
  getList,
  getListsForGameService,
  listListsService,
  removeGamesFromListService,
  reorderListItems,
  reorderListsService,
  saveList,
  setItemNote
} from '../services/lists.service'

/** Пользовательские списки (ТЗ 06 §3). */
export function registerListsIpc(): void {
  handle('lists.list', (input) => listListsService(input ?? {}))
  handle('lists.get', ({ id }) => getList(id))
  handle('lists.save', (input) => saveList(input))
  handle('lists.delete', ({ id }) => {
    deleteList(id)
    return { ok: true as const }
  })
  handle('lists.duplicate', ({ id }) => duplicateList(id))
  handle('lists.addGames', ({ listId, gameIds }) => ({ added: addGamesToListService(listId, gameIds) }))
  handle('lists.addFromFilter', ({ listId, scope, filters }) => ({
    added: addFromFilterService(listId, scope, filters)
  }))
  handle('lists.removeGames', ({ listId, gameIds }) => {
    removeGamesFromListService(listId, gameIds)
    return { ok: true as const }
  })
  handle('lists.reorder', ({ listId, orderedGameIds }) => {
    reorderListItems(listId, orderedGameIds)
    return { ok: true as const }
  })
  handle('lists.setItemNote', ({ listId, gameId, note }) => {
    setItemNote(listId, gameId, note)
    return { ok: true as const }
  })
  handle('lists.reorderLists', ({ orderedIds }) => {
    reorderListsService(orderedIds)
    return { ok: true as const }
  })
  handle('lists.forGame', ({ gameId }) => getListsForGameService(gameId))
}
