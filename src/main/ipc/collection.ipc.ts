import { handle } from './register'
import { getFacets, getScopeProgressOnly, pickRandomCard, queryCollection } from '../services/collection.service'

/** Каналы коллекции игр (07). */
export function registerCollectionIpc(): void {
  handle('collection.query', (input) => queryCollection(input))
  handle('collection.facets', (input) => getFacets(input.scope, input.filters))
  handle('collection.random', (input) => pickRandomCard(input.scope, input.filters, input.excludeIds))
  handle('collection.progress', (input) => getScopeProgressOnly(input.scope))
}
