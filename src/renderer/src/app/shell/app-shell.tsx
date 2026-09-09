import { useEffect, useRef } from 'react'
import { Outlet, useRouterState } from '@tanstack/react-router'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from '@/components/ui/toast'
import { BloomBackdrop } from '@/components/ui/bloom'
import { toast } from '@/components/ui/toast'
import { onAppEvent } from '@/platform/events'
import { Titlebar } from './titlebar'
import { Sidebar } from './sidebar'
import { CommandPalette } from './command-palette'
import { HotkeysHelp } from './hotkeys-help'
import { useGlobalHotkeys } from './use-global-hotkeys'
import { useHistoryTracker } from './use-history-tracker'
import { useSettings } from '@/stores/settings-store'
import { call } from '@/platform/api'
import { router } from '../router'

/**
 * Оболочка приложения (ТЗ 05): сцена с двумя свечениями, собственный заголовок окна,
 * рельса-сайдбар, контентная область с переходом между экранами.
 */
export function AppShell(): React.ReactElement {
  const location = useRouterState({ select: (s) => s.location })
  const pageKey = location.pathname.startsWith('/profile') ? '/profile' : location.pathname
  const settings = useSettings()
  useGlobalHotkeys()
  useHistoryTracker()

  // Мастер первого запуска показывается ровно один раз за сеанс (05 §8):
  // без этого флага любое изменение настроек снова уводило бы на /welcome.
  const welcomeChecked = useRef(false)
  useEffect(() => {
    if (welcomeChecked.current || settings.onboardingDone) return
    welcomeChecked.current = true
    void call('onboarding.getState')
      .then((state) => {
        if (!state.done) void router.navigate({ to: '/welcome' })
      })
      .catch(() => undefined)
  }, [settings.onboardingDone])

  // Тост открытия достижения (ТЗ 09 §4).
  useEffect(
    () =>
      onAppEvent((event) => {
        if (event.type !== 'achievementUnlocked') return
        toast({ title: `Достижение открыто: ${event.title}`, tone: 'success' })
      }),
    []
  )

  return (
    <TooltipProvider>
      <div className="relative flex h-full w-full flex-col overflow-hidden">
        <BloomBackdrop />
        <Titlebar />
        <div className="relative flex min-h-0 flex-1">
          <Sidebar />
          <main className="relative min-w-0 flex-1 overflow-hidden">
            {/*
              key по маршруту перезапускает CSS-анимацию появления экрана (05 §4.4).
              Вкладки профиля — один экран с общей шапкой, поэтому у них общий ключ:
              иначе при переключении вкладки заново «въезжали» баннер и аватар.
            */}
            <div key={pageKey} className="page-enter h-full overflow-y-auto">
              <Outlet />
            </div>
          </main>
        </div>
        <Toaster />
        <CommandPalette />
        <HotkeysHelp />
      </div>
    </TooltipProvider>
  )
}
