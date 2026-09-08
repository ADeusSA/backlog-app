import {
  createHashHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  redirect
} from '@tanstack/react-router'
import { z } from 'zod'
import { GAME_STATUSES } from '@shared/constants'
import { AppShell } from './shell/app-shell'
import { ProfileScreen } from '@/features/profile/profile-screen'
import { RecapScreen } from '@/features/recap/recap-screen'
import { LibraryScreen } from '@/features/library/library-screen'
import { ListsScreen } from '@/features/lists/lists-screen'
import { ListScreen } from '@/features/lists/list-screen'
import { SeriesIndexScreen } from '@/features/series/series-index-screen'
import { SeriesScreen } from '@/features/series/series-screen'
import { CompaniesScreen } from '@/features/companies/companies-screen'
import { CompanyScreen } from '@/features/companies/company-screen'
import { GameScreen } from '@/features/game/game-screen'
import { CatalogHubScreen } from '@/features/catalog/catalog-hub-screen'
import { CatalogEntityScreen } from '@/features/catalog/catalog-entity-screen'
import { CatalogFormScreen } from '@/features/catalog/catalog-form-screen'
import { SettingsScreen } from '@/features/settings/settings-screen'
import { SearchScreen } from '@/features/search/search-screen'
import { WelcomeScreen } from '@/features/welcome/welcome-screen'
import { UiShowcase } from '@/components/dev/ui-showcase'

/** Состояние коллекции в URL (07 §7.1): `f` — base64url JSON. */
const collectionSearch = z.object({ f: z.string().optional() })

/** Контекст перехода для крошек: откуда пришли на страницу игры (05 §4.2). */
const fromSearch = z.object({
  from: z.string().optional(),
  fromId: z.string().optional(),
  fromTitle: z.string().optional()
})

const rootRoute = createRootRoute({
  component: () => <Outlet />
})

/** Мастер первого запуска — вне оболочки, на весь экран (05 §8). */
const welcomeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/welcome',
  component: WelcomeScreen
})

const shellRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'shell',
  component: AppShell
})

const indexRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/',
  beforeLoad: () => {
    throw redirect({ to: '/profile' })
  }
})

const profileRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/profile',
  component: ProfileScreen
})

const recapRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/recap/$year',
  component: RecapScreen
})

const libraryRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/library',
  validateSearch: collectionSearch.extend({
    status: z.enum([...GAME_STATUSES, 'all']).optional()
  }),
  component: LibraryScreen
})

const listsRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/lists',
  component: ListsScreen
})

const listRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/lists/$listId',
  validateSearch: collectionSearch,
  component: ListScreen
})

const seriesIndexRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/series',
  component: SeriesIndexScreen
})

const seriesRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/series/$seriesId',
  validateSearch: collectionSearch.extend({ dlc: z.boolean().optional() }),
  component: SeriesScreen
})

const companiesRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/companies',
  validateSearch: z.object({ role: z.enum(['all', 'developer', 'publisher']).optional() }),
  component: CompaniesScreen
})

const companyRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/companies/$companyId',
  validateSearch: collectionSearch.extend({
    tab: z.enum(['games', 'series', 'children']).optional()
  }),
  component: CompanyScreen
})

const gameRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/games/$gameId',
  validateSearch: fromSearch,
  component: GameScreen
})

const catalogRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/catalog',
  component: CatalogHubScreen
})

const catalogEntityRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/catalog/$entity',
  validateSearch: z.object({ q: z.string().optional() }),
  component: CatalogEntityScreen
})

const catalogNewRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/catalog/$entity/new',
  component: CatalogFormScreen
})

const catalogEditRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/catalog/$entity/$id/edit',
  component: CatalogFormScreen
})

const settingsRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/settings/$section',
  component: SettingsScreen
})

const settingsIndexRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/settings',
  beforeLoad: () => {
    throw redirect({ to: '/settings/$section', params: { section: 'general' } })
  }
})

const searchRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/search',
  validateSearch: z.object({ q: z.string().default('') }),
  component: SearchScreen
})

const devUiRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/dev/ui',
  component: UiShowcase
})

const routeTree = rootRoute.addChildren([
  welcomeRoute,
  shellRoute.addChildren([
    indexRoute,
    profileRoute,
    recapRoute,
    libraryRoute,
    listsRoute,
    listRoute,
    seriesIndexRoute,
    seriesRoute,
    companiesRoute,
    companyRoute,
    gameRoute,
    catalogRoute,
    catalogEntityRoute,
    catalogNewRoute,
    catalogEditRoute,
    settingsIndexRoute,
    settingsRoute,
    searchRoute,
    devUiRoute
  ])
])

/** Hash-история: renderer грузится с file:// внутри asar (01 §9). */
export const router = createRouter({
  routeTree,
  history: createHashHistory(),
  defaultPreload: 'intent',
  scrollRestoration: true
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

export const routes = {
  welcome: welcomeRoute,
  profile: profileRoute,
  library: libraryRoute,
  lists: listsRoute,
  list: listRoute,
  seriesIndex: seriesIndexRoute,
  series: seriesRoute,
  companies: companiesRoute,
  company: companyRoute,
  game: gameRoute,
  catalog: catalogRoute,
  catalogEntity: catalogEntityRoute,
  settings: settingsRoute,
  search: searchRoute
}
