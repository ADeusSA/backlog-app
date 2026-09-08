import { handle } from './register'
import { fetchGame, search, statuses, test } from '../providers'
import { clearCredentials, setCredentials } from '../providers/credentials'
import { clearCache } from '../providers/cache'

/**
 * Внешние источники (ТЗ 08). Наружу отдаются только данные — ключи остаются в main
 * и в зашифрованном файле, renderer видит лишь флаг «ключи заданы» (08 §4).
 */
export function registerProvidersIpc(): void {
  handle('providers.status', () => statuses())

  handle('providers.search', ({ provider, query, limit }) => search(provider, query, limit))

  handle('providers.fetch', ({ provider, externalId }) => fetchGame(provider, externalId))

  handle('providers.setCredentials', ({ provider, clientId, clientSecret }) => {
    setCredentials(provider, { clientId, ...(clientSecret ? { clientSecret } : {}) })
    return statuses()
  })

  handle('providers.clearCredentials', ({ provider }) => {
    clearCredentials(provider)
    return statuses()
  })

  handle('providers.test', ({ provider }) => test(provider))

  handle('providers.clearCache', () => ({ removed: clearCache() }))
}
