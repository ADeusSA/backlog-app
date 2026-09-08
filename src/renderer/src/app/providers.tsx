import { useEffect, useState, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { I18nextProvider } from 'react-i18next'
import { RouterProvider } from '@tanstack/react-router'
import { bindQueryInvalidation } from '@/platform/events'
import { bindSyncEvents, useSyncStore } from '@/stores/sync-store'
import { useSettingsStore } from '@/stores/settings-store'
import { useUiStore } from '@/stores/ui-store'
import { initI18n, i18next } from '@/i18n'
import { router } from './router'
import { AppErrorBoundary } from './shell/error-boundary'

/** staleTime: Infinity — данные инвалидируются событиями из main (01 §9). */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: Infinity, retry: 1, refetchOnWindowFocus: false }
  }
})

export function AppProviders(): ReactNode {
  const [ready, setReady] = useState(false)
  const loadSettings = useSettingsStore((s) => s.load)

  useEffect(() => {
    let cancelled = false
    const boot = async (): Promise<void> => {
      await loadSettings()
      const settings = useSettingsStore.getState().settings
      useUiStore.setState({ sidebarCollapsed: settings.sidebarCollapsed })
      await initI18n(settings.locale)
      await useSyncStore.getState().refresh()
      if (!cancelled) setReady(true)
    }
    void boot()
    const unbindQueries = bindQueryInvalidation(queryClient)
    const unbindSync = bindSyncEvents()
    return () => {
      cancelled = true
      unbindQueries()
      unbindSync()
    }
  }, [loadSettings])

  if (!ready) return <BootSplash />

  return (
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18next}>
        <AppErrorBoundary>
          <RouterProvider router={router} />
        </AppErrorBoundary>
      </I18nextProvider>
    </QueryClientProvider>
  )
}

/** Экран до готовности настроек и словарей — без вспышки светлого фона (05 §1). */
function BootSplash(): ReactNode {
  return (
    <div className="flex h-full w-full items-center justify-center" style={{ background: 'var(--bg-0)' }}>
      <div className="skeleton h-3 w-40" />
    </div>
  )
}
