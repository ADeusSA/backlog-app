import { app } from 'electron'
import { assertAllChannelsRegistered } from './register'
import { registerAppIpc } from './app.ipc'
import { registerSettingsIpc } from './settings.ipc'
import { registerOnboardingIpc } from './onboarding.ipc'
import { registerCollectionIpc } from './collection.ipc'
import { registerGamesIpc } from './games.ipc'
import { registerUserGameIpc } from './user-game.ipc'
import { registerListsIpc } from './lists.ipc'
import { registerSeriesIpc } from './series.ipc'
import { registerCompaniesIpc } from './companies.ipc'
import { registerCatalogIpc } from './catalog.ipc'
import { registerImagesIpc } from './images.ipc'
import { registerProvidersIpc } from './providers.ipc'
import { registerProfileIpc } from './profile.ipc'
import { registerAchievementsIpc } from './achievements.ipc'
import { registerSearchIpc } from './search.ipc'
import { registerPresetsIpc } from './presets.ipc'
import { registerBackupsIpc } from './backups.ipc'
import { registerSyncIpc } from './sync.ipc'

/** Регистрация всех доменов IPC (01 §5). */
export function registerAllIpc(): void {
  registerAppIpc()
  registerSettingsIpc()
  registerOnboardingIpc()
  registerCollectionIpc()
  registerGamesIpc()
  registerUserGameIpc()
  registerListsIpc()
  registerSeriesIpc()
  registerCompaniesIpc()
  registerCatalogIpc()
  registerImagesIpc()
  registerProvidersIpc()
  registerProfileIpc()
  registerAchievementsIpc()
  registerSearchIpc()
  registerPresetsIpc()
  registerBackupsIpc()
  registerSyncIpc()

  if (!app.isPackaged) assertAllChannelsRegistered()
}
