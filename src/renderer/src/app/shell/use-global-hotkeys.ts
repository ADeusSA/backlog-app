import { useEffect } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { comboFromEvent, isTypingTarget, HOTKEYS } from '@/lib/hotkeys'
import { useUiStore } from '@/stores/ui-store'
import { call } from '@/platform/api'
import { router } from '../router'

const LIBRARY_HOTKEYS: Record<string, string> = {
  'library.all': 'all',
  'library.playing': 'playing',
  'library.backlog': 'backlog',
  'library.completed': 'completed',
  'library.shelved': 'shelved',
  'library.dropped': 'dropped',
  'library.wishlist': 'wishlist'
}

/** Глобальные горячие клавиши (ТЗ 05 §5). Таблица — в `@/lib/hotkeys`. */
export function useGlobalHotkeys(): void {
  const navigate = useNavigate()

  useEffect(() => {
    const globalIds = new Set(
      HOTKEYS.filter((h) => h.group === 'global' || h.group === 'library').map((h) => h.id)
    )

    const onKeyDown = (event: KeyboardEvent): void => {
      const combo = comboFromEvent(event)
      const hotkey = HOTKEYS.find((h) => h.combo === combo && globalIds.has(h.id))
      if (!hotkey) return
      if (isTypingTarget(event.target) && !hotkey.allowInInput) return

      const ui = useUiStore.getState()

      switch (hotkey.id) {
        case 'palette':
          event.preventDefault()
          ui.setCommandPaletteOpen(!ui.commandPaletteOpen)
          return
        case 'sidebar':
          event.preventDefault()
          ui.toggleSidebar()
          return
        case 'newGame':
          event.preventDefault()
          void navigate({ to: '/catalog/$entity/new', params: { entity: 'games' } })
          return
        case 'newList':
          event.preventDefault()
          void navigate({ to: '/lists', search: { create: true } as never })
          return
        case 'settings':
          event.preventDefault()
          void navigate({ to: '/settings/$section', params: { section: 'general' } })
          return
        case 'syncNow':
          event.preventDefault()
          void call('sync.now').catch(() => undefined)
          return
        case 'back':
          event.preventDefault()
          router.history.back()
          return
        case 'forward':
          event.preventDefault()
          router.history.forward()
          return
        case 'help':
          event.preventDefault()
          ui.setHotkeysHelpOpen(!ui.hotkeysHelpOpen)
          return
        default:
          break
      }

      const status = LIBRARY_HOTKEYS[hotkey.id]
      if (status) {
        event.preventDefault()
        void navigate({ to: '/library', search: { status: status as never } })
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [navigate])

  // Кнопки мыши «назад/вперёд» (XButton1/XButton2) — 05 §4.1
  useEffect(() => {
    const onMouseUp = (event: MouseEvent): void => {
      if (event.button === 3) {
        event.preventDefault()
        router.history.back()
      } else if (event.button === 4) {
        event.preventDefault()
        router.history.forward()
      }
    }
    window.addEventListener('mouseup', onMouseUp)
    return () => window.removeEventListener('mouseup', onMouseUp)
  }, [])
}
