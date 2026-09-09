import type { ReactElement } from 'react'
import { Outlet, useNavigate, useRouterState } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Pencil, Trophy } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { call } from '@/platform/api'
import { imageUrl } from '@/lib/format'
import { useSettings } from '@/stores/settings-store'
import { useUiStore } from '@/stores/ui-store'
import { ProfileEditDialog } from './profile-edit-dialog'

type Tab = 'overview' | 'activity' | 'stats' | 'achievements'

const PATHS: Record<Tab, string> = {
  overview: '/profile',
  activity: '/profile/activity',
  stats: '/profile/stats',
  achievements: '/profile/achievements'
}

function tabOf(pathname: string): Tab {
  if (pathname.startsWith('/profile/activity')) return 'activity'
  if (pathname.startsWith('/profile/stats')) return 'stats'
  if (pathname.startsWith('/profile/achievements')) return 'achievements'
  return 'overview'
}

/**
 * Шапка профиля и вкладки (06 §1): «Обзор» — виджеты, остальные три — отдельные
 * маршруты. Шапка живёт в макете, поэтому при переключении вкладки не перерисовывается.
 */
export function ProfileLayout(): ReactElement {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const settings = useSettings()
  const editing = useUiStore((state) => state.profileEditOpen)
  const setEditing = useUiStore((state) => state.setProfileEditOpen)

  const { data: profile } = useQuery({ queryKey: ['profile'], queryFn: () => call('profile.get') })

  const tab = tabOf(pathname)

  if (!profile) {
    return (
      <div className="flex flex-col gap-4 p-6">
        <Skeleton className="h-[160px] w-full" />
        <Skeleton className="h-6 w-1/3" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 pb-10">
      <header className="relative">
        <div
          className="h-[160px] w-full"
          style={{
            background: profile.bannerFile
              ? `center/cover no-repeat url(${imageUrl(profile.bannerFile)})`
              : 'linear-gradient(120deg, var(--bloom-a), var(--bloom-b))',
            opacity: profile.bannerFile ? 1 : 0.5
          }}
        />
        <div className="flex items-end gap-4 px-6" style={{ marginTop: -40 }}>
          <Avatar name={profile.displayName} src={profile.avatarFile ?? undefined} size={96} />
          <div className="min-w-0 flex-1 pb-1">
            <h1 className="type-h1 truncate">{profile.displayName}</h1>
            {profile.bio && (
              <p className="type-body line-clamp-2" style={{ color: 'var(--text-2)' }}>
                {profile.bio}
              </p>
            )}
            <p className="type-small" style={{ color: 'var(--text-3)' }}>
              {profile.memberSinceYear
                ? t('profile.memberSince', { year: profile.memberSinceYear })
                : ''}
            </p>
          </div>
          {settings.showAchievements && (
            <button
              type="button"
              className="flex items-center gap-2 rounded-[var(--r-pill)] px-3 py-1.5 type-small"
              style={{ background: 'var(--accent-soft)', color: 'var(--text-1)' }}
              onClick={() => void navigate({ to: PATHS.achievements })}
            >
              <Trophy size={14} strokeWidth={1.75} style={{ color: 'var(--accent)' }} />
              {t('profile.levelBadge', { level: profile.level, title: t(profile.levelTitleKey) })}
            </button>
          )}
          <Button variant="secondary" onClick={() => setEditing(true)}>
            <Pencil size={16} strokeWidth={1.75} />
            {t('profile.editButton')}
          </Button>
        </div>
      </header>

      <div className="px-6">
        <Tabs value={tab} onValueChange={(value) => void navigate({ to: PATHS[value as Tab] })}>
          <TabsList>
            <TabsTrigger value="overview">{t('profile.tabs.overview')}</TabsTrigger>
            <TabsTrigger value="activity">{t('profile.tabs.activity')}</TabsTrigger>
            <TabsTrigger value="stats">{t('profile.tabs.stats')}</TabsTrigger>
            {settings.showAchievements && (
              <TabsTrigger value="achievements">{t('profile.tabs.achievements')}</TabsTrigger>
            )}
          </TabsList>
        </Tabs>
      </div>

      <Outlet />

      <ProfileEditDialog open={editing} onOpenChange={setEditing} profile={profile} />
    </div>
  )
}
