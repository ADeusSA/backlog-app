import { handle } from './register'
import {
  addGamesToSeriesService,
  autoNumberSeriesService,
  getSeries,
  getSeriesChildrenService,
  getTimeline,
  listSeriesService,
  removeGamesFromSeriesService,
  reorderSeries,
  setSeriesLabel,
  setSeriesPosition
} from '../services/series.service'

/** Серии и франшизы (ТЗ 06 §4). */
export function registerSeriesIpc(): void {
  handle('series.list', (input) =>
    listSeriesService({ sort: input?.sort ?? 'name', ...(input?.q ? { q: input.q } : {}) })
  )
  handle('series.get', ({ id }) => getSeries(id))
  handle('series.children', ({ id }) => getSeriesChildrenService(id))
  handle('series.reorder', ({ seriesId, orderedGameIds }) => {
    reorderSeries(seriesId, orderedGameIds)
    return { ok: true as const }
  })
  handle('series.setPosition', ({ seriesId, gameId, position }) => {
    setSeriesPosition(seriesId, gameId, position)
    return { ok: true as const }
  })
  handle('series.addGames', ({ seriesId, gameIds }) => ({
    added: addGamesToSeriesService(seriesId, gameIds)
  }))
  handle('series.removeGames', ({ seriesId, gameIds }) => {
    removeGamesFromSeriesService(seriesId, gameIds)
    return { ok: true as const }
  })
  handle('series.autoNumber', ({ seriesId }) => {
    autoNumberSeriesService(seriesId)
    return { ok: true as const }
  })
  handle('series.setLabel', ({ seriesId, gameId, label }) => {
    setSeriesLabel(seriesId, gameId, label)
    return { ok: true as const }
  })
  handle('series.timeline', ({ seriesId }) => getTimeline(seriesId))
}
