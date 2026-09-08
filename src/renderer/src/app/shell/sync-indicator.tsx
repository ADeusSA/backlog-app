import { useNavigate } from '@tanstack/react-router'
import { Cloud, CloudAlert, CloudCheck, CloudOff, RefreshCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { useSyncStore } from '@/stores/sync-store'
import { formatRelative } from '@/lib/format'
import { call } from '@/platform/api'
import { toast } from '@/components/ui/toast'

/** Индикатор синхронизации в заголовке окна (ТЗ 05 §2 п.6, 03 §8). */
export function SyncIndicator(): React.ReactElement {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const state = useSyncStore((s) => s.state)

  const { Icon, color, spin } = iconFor(state.status)

  const syncNow = (): void => {
    void call('sync.now')
      .then((next) => useSyncStore.getState().set(next))
      .catch((err: Error) => toast({ title: err.message, tone: 'danger' }))
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="icon" size="sm" aria-label={t(`sync.status.${state.status}`)} className="no-drag">
          <Icon
            size={16}
            strokeWidth={1.75}
            style={{ color }}
            className={spin ? 'animate-spin' : undefined}
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[280px]">
        <div className="flex flex-col gap-2">
          <p className="type-h3">{t(`sync.status.${state.status}`)}</p>
          {state.accountEmail && (
            <p className="type-small" style={{ color: 'var(--text-2)' }}>
              {state.accountEmail}
            </p>
          )}
          <dl className="grid grid-cols-2 gap-1 type-small" style={{ color: 'var(--text-2)' }}>
            <dt>{t('sync.lastPush')}</dt>
            <dd className="text-right">{state.lastPushAt ? formatRelative(state.lastPushAt) : t('common.never')}</dd>
            <dt>{t('sync.lastPull')}</dt>
            <dd className="text-right">{state.lastPullAt ? formatRelative(state.lastPullAt) : t('common.never')}</dd>
          </dl>
          {state.lastError && (
            <p className="type-small" style={{ color: 'var(--danger)' }}>
              {state.lastError}
            </p>
          )}
          <div className="flex gap-2 pt-1">
            <Button variant="secondary" size="sm" onClick={syncNow} disabled={state.status === 'syncing'}>
              <RefreshCw size={14} strokeWidth={1.75} />
              {t('sync.now')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void navigate({ to: '/settings/$section', params: { section: 'data' } })}
            >
              {t('nav.settings')}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

function iconFor(status: string): { Icon: typeof Cloud; color: string; spin: boolean } {
  switch (status) {
    case 'idle':
      return { Icon: CloudCheck, color: 'var(--success)', spin: false }
    case 'syncing':
      return { Icon: RefreshCw, color: 'var(--accent)', spin: true }
    case 'pending':
      return { Icon: Cloud, color: 'var(--accent)', spin: false }
    case 'offline':
      return { Icon: CloudOff, color: 'var(--text-3)', spin: false }
    case 'error':
    case 'conflict':
      return { Icon: CloudAlert, color: 'var(--danger)', spin: false }
    default:
      return { Icon: CloudOff, color: 'var(--text-3)', spin: false }
  }
}
