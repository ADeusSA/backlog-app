import type { TFunction } from 'i18next'
import type { ActivityType, GameStatus } from '@shared/constants'
import { formatPlaytime } from '@/lib/format'

/** Достаёт строковое/числовое поле из payload без исключений (форма payload_json — 02 §3.13). */
function pick(payload: Record<string, unknown>, key: string): string | number | undefined {
  const value = payload[key]
  return typeof value === 'string' || typeof value === 'number' ? value : undefined
}

function statusLabel(t: TFunction, value: string | number | undefined): string {
  if (typeof value !== 'string') return String(value ?? '—')
  return t(`status.${value}`, { defaultValue: value })
}

/**
 * Человекочитаемая строка события ленты активности (06 §6.3.6, 06 §1.7) —
 * общая для истории на странице игры и ленты активности профиля.
 */
export function formatActivityText(
  t: TFunction,
  type: ActivityType,
  payload: Record<string, unknown>
): string {
  switch (type) {
    case 'game_added':
      return t('game.activity.game_added')
    case 'status_changed':
      return t('game.activity.status_changed', {
        from: statusLabel(t, pick(payload, 'from') as GameStatus | undefined),
        to: statusLabel(t, pick(payload, 'to') as GameStatus | undefined)
      })
    case 'rating_set':
      return t('game.activity.rating_set', { rating: pick(payload, 'rating') ?? '—' })
    case 'playtime_set': {
      const minutes = pick(payload, 'minutes') ?? pick(payload, 'delta')
      return t('game.activity.playtime_set', {
        hours: typeof minutes === 'number' ? formatPlaytime(minutes) : '—'
      })
    }
    case 'session_logged':
      return t('game.activity.session_logged')
    case 'list_created':
      return t('game.activity.list_created', { name: pick(payload, 'name') ?? '' })
    case 'list_item_added':
      return t('game.activity.list_item_added', { name: pick(payload, 'listName') ?? pick(payload, 'name') ?? '' })
    case 'list_item_removed':
      return t('game.activity.list_item_removed', { name: pick(payload, 'listName') ?? pick(payload, 'name') ?? '' })
    case 'review_written':
      return t('game.activity.review_written')
    case 'mastered_set':
      return t('game.activity.mastered_set')
    case 'catalog_created':
      return t('game.activity.catalog_created')
    case 'catalog_edited':
      return t('game.activity.catalog_edited')
    case 'achievement_unlocked':
      return t('game.activity.achievement_unlocked', { title: pick(payload, 'title') ?? '' })
    default:
      return t('game.activity.fallback')
  }
}
