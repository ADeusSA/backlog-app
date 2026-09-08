import { handle } from './register'
import { getDb } from '../db/connection'
import { getCatalogCounts, getRecentCatalogEntities } from '../db/repositories/catalog.repo'
import {
  bulkAssign,
  deleteGames,
  getGameForEdit,
  saveGame,
  similarTitles
} from '../services/catalog-games.service'
import {
  deleteCompany,
  getCompanyForEdit,
  mergeCompanies,
  saveCompany
} from '../services/companies.service'
import { deleteSeries, getSeriesForEdit, saveSeries } from '../services/series.service'
import {
  deleteGenreService,
  deletePlatformService,
  deleteTagService,
  listGenresService,
  listModesService,
  listPlatformsService,
  listTagsService,
  mergeGenreService,
  mergePlatformService,
  mergeTagService,
  saveGenreService,
  savePlatformService,
  saveTagService
} from '../services/taxonomy.service'

/** Модерация каталога (ТЗ 06 §7). */
export function registerCatalogIpc(): void {
  handle('catalog.counts', () => getCatalogCounts(getDb()))
  handle('catalog.recent', (input) => getRecentCatalogEntities(getDb(), input?.limit ?? 10))

  handle('catalog.games.get', ({ id }) => getGameForEdit(id))
  handle('catalog.games.save', (input) => ({ id: saveGame(input) }))
  handle('catalog.games.delete', ({ ids }) => {
    deleteGames(ids)
    return { ok: true as const }
  })
  handle('catalog.games.similar', ({ title, excludeId }) => similarTitles(title, excludeId))
  handle('catalog.games.bulkAssign', ({ gameIds, genreIds, platformIds, seriesId }) => {
    bulkAssign(gameIds, genreIds, platformIds, seriesId)
    return { ok: true as const }
  })

  handle('catalog.companies.get', ({ id }) => getCompanyForEdit(id))
  handle('catalog.companies.save', (input) => ({ id: saveCompany(input) }))
  handle('catalog.companies.delete', ({ id }) => {
    deleteCompany(id)
    return { ok: true as const }
  })
  handle('catalog.companies.merge', ({ fromId, intoId }) => {
    mergeCompanies(fromId, intoId)
    return { ok: true as const }
  })

  handle('catalog.series.get', ({ id }) => getSeriesForEdit(id))
  handle('catalog.series.save', (input) => ({ id: saveSeries(input) }))
  handle('catalog.series.delete', ({ id }) => {
    deleteSeries(id)
    return { ok: true as const }
  })

  handle('catalog.genres.list', () => listGenresService())
  handle('catalog.genres.save', (input) => ({ id: saveGenreService(input) }))
  handle('catalog.genres.delete', ({ id }) => {
    deleteGenreService(id)
    return { ok: true as const }
  })
  handle('catalog.genres.merge', ({ fromId, intoId }) => {
    mergeGenreService(fromId, intoId)
    return { ok: true as const }
  })

  handle('catalog.platforms.list', () => listPlatformsService())
  handle('catalog.platforms.save', (input) => ({ id: savePlatformService(input) }))
  handle('catalog.platforms.delete', ({ id }) => {
    deletePlatformService(id)
    return { ok: true as const }
  })
  handle('catalog.platforms.merge', ({ fromId, intoId }) => {
    mergePlatformService(fromId, intoId)
    return { ok: true as const }
  })

  handle('catalog.modes.list', () => listModesService())

  handle('catalog.tags.list', () => listTagsService())
  handle('catalog.tags.save', (input) => ({ id: saveTagService(input) }))
  handle('catalog.tags.delete', ({ id }) => {
    deleteTagService(id)
    return { ok: true as const }
  })
  handle('catalog.tags.merge', ({ fromId, intoId }) => {
    mergeTagService(fromId, intoId)
    return { ok: true as const }
  })
}
