import type { ReactElement } from 'react'
import { useNavigate } from '@tanstack/react-router'
import {
  Award,
  Clock3,
  Database,
  ListMinus,
  ListPlus,
  NotebookPen,
  PenLine,
  Pencil,
  Plus,
  RefreshCw,
  Star,
  Trophy,
  type LucideIcon
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { ActivityType } from '@shared/constants'
import type { ActivityDto } from '@shared/schema/entities'
import { CoverImage } from '@/components/ui/image'
import { formatActivityText } from '@/features/game/activity-text'
import { formatRelative, formatTime } from '@/lib/format'
import { cn } from '@/lib/utils'

const ICONS: Record<ActivityType, LucideIcon> = {
  game_added: Plus,
  status_changed: RefreshCw,
  rating_set: Star,
  playtime_set: Clock3,
  session_logged: NotebookPen,
  list_created: ListPlus,
  list_item_added: ListPlus,
  list_item_removed: ListMinus,
  review_written: PenLine,
  mastered_set: Award,
  catalog_created: Database,
  catalog_edited: Pencil,
  achievement_unlocked: Trophy
}

export interface ActivityEntryProps {
  entry: ActivityDto
  /** `rail` — узкая колонка обзора, `full` — экран «Активность» с обложками и временем суток. */
  variant: 'rail' | 'full'
}

/** Одна запись ленты активности (06 §1.7) — общий вид для рельса и экрана. */
export function ActivityEntry({ entry, variant }: ActivityEntryProps): ReactElement {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const Icon = ICONS[entry.type]
  const text = formatActivityText(t, entry.type, entry.payload)
  const clickable = Boolean(entry.gameId)

  const open = (): void => {
    if (entry.gameId) void navigate({ to: '/games/$gameId', params: { gameId: entry.gameId } })
  }

  return (
    <li>
      <div
        {...(clickable ? { role: 'link', tabIndex: 0, onClick: open } : {})}
        onKeyDown={(event) => {
          if (!clickable || (event.key !== 'Enter' && event.key !== ' ')) return
          event.preventDefault()
          open()
        }}
        className={cn(
          'flex w-full items-center gap-2.5 rounded-[var(--r-sm)] px-2 py-1.5 text-left outline-none',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)]',
          clickable && 'cursor-pointer hover:bg-[var(--surface-2)]'
        )}
        style={{ transitionDuration: 'var(--d-hover)' }}
      >
        <span
          className="flex size-[26px] shrink-0 items-center justify-center rounded-full"
          style={{ background: 'var(--surface-2)' }}
        >
          <Icon size={13} strokeWidth={1.75} style={{ color: 'var(--text-2)' }} />
        </span>

        {/* У событий каталога игры нет — пустая заглушка обложки только мешала бы. */}
        {variant === 'full' && entry.gameTitle && (
          <CoverImage
            fileName={entry.coverFile}
            title={entry.gameTitle}
            size={28}
            className="shrink-0"
          />
        )}

        <span className="flex min-w-0 flex-1 flex-col">
          {entry.gameTitle && (
            <span className="truncate type-small" style={{ color: 'var(--text-1)' }}>
              {entry.gameTitle}
            </span>
          )}
          <span
            className={cn('type-small', variant === 'rail' ? 'line-clamp-2' : 'truncate')}
            style={{ color: 'var(--text-2)' }}
          >
            {text}
          </span>
          {/* В рельсе относительное время не помещается справа — уводим его под текст. */}
          {variant === 'rail' && (
            <span className="type-small" style={{ color: 'var(--text-3)' }}>
              {formatRelative(entry.happenedAt)}
            </span>
          )}
        </span>

        {variant === 'full' && (
          <span className="shrink-0 type-small tabular" style={{ color: 'var(--text-3)' }}>
            {formatTime(entry.happenedAt)}
          </span>
        )}
      </div>
    </li>
  )
}
