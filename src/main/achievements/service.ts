import type { Database } from 'better-sqlite3'
import type { AchievementDto, AchievementsSummary } from '@shared/schema/entities'
import { getDb, write } from '../db/connection'
import { newId, now } from '../db/utils'
import { emitAppEvent } from '../events'
import { ACHIEVEMENTS, levelFromXp, levelTitle, XP_PER_LEVEL_STEP } from './definitions'
import { computeAchievements, computeXp, type AchievementProgress } from './compute'

interface StoredRow {
  achievement_key: string
  level: number
  progress_json: string
  unlocked_at: string | null
}

interface Unlocked {
  key: string
  level: number
  title: string
  icon: string
}

/**
 * Инкрементальный пересчёт достижений после записи в БД (ТЗ 09 §5).
 * Возвращает список открытых в этот раз уровней — по ним показываются тосты.
 */
export function recomputeAchievements(): Unlocked[] {
  const unlockedNow: Unlocked[] = []

  write(['user_achievements', 'profile', 'activity_log'], (db) => {
    const progress = computeAchievements(db)
    const stored = new Map<string, StoredRow>()
    for (const row of db.prepare('SELECT * FROM user_achievements').all() as StoredRow[]) {
      stored.set(`${row.achievement_key}|${row.level}`, row)
    }

    const upsert = db.prepare(
      `INSERT INTO user_achievements(achievement_key, level, progress_json, unlocked_at)
       VALUES(?, ?, ?, ?)
       ON CONFLICT(achievement_key, level) DO UPDATE SET
         progress_json = excluded.progress_json,
         unlocked_at = COALESCE(user_achievements.unlocked_at, excluded.unlocked_at)`
    )
    const logActivity = db.prepare(
      `INSERT INTO activity_log(id, happened_at, type, entity_type, entity_id, payload_json)
       VALUES(?, ?, 'achievement_unlocked', 'achievement', ?, ?)`
    )

    let unlockedLevels = 0
    const timestamp = now()

    for (const item of progress) {
      const definition = item.definition
      item.definition.levels.forEach((levelDef, index) => {
        const level = index + 1
        const reached = !definition.comingSoon && item.progress >= levelDef.threshold
        const key = `${item.key}|${level}`
        const existing = stored.get(key)
        const wasUnlocked = Boolean(existing?.unlocked_at)
        const unlockedAt = wasUnlocked ? existing!.unlocked_at : reached ? timestamp : null

        upsert.run(
          item.key,
          level,
          JSON.stringify({ progress: item.progress, threshold: levelDef.threshold, params: item.params }),
          unlockedAt
        )

        if (unlockedAt) unlockedLevels += 1
        if (reached && !wasUnlocked) {
          const title = titleFor(item, level)
          unlockedNow.push({ key: item.key, level, title, icon: definition.icon })
          logActivity.run(newId(), timestamp, `${item.key}:${level}`, JSON.stringify({ title, level }))
        }
      })
    }

    const xp = computeXp(db, unlockedLevels)
    db.prepare('UPDATE profile SET xp = ?, updated_at = ? WHERE id = 1').run(xp, timestamp)
  })

  for (const item of unlockedNow) {
    emitAppEvent({
      type: 'achievementUnlocked',
      key: item.key,
      title: item.title,
      level: item.level,
      icon: item.icon
    })
  }

  return unlockedNow
}

function titleFor(item: AchievementProgress, level: number): string {
  const name = item.params['name']
  const base = item.definition.title
  const roman = ['', 'I', 'II', 'III', 'IV', 'V', 'VI'][level] ?? String(level)
  const withName = typeof name === 'string' ? `${base} · ${name}` : base
  return item.definition.levels.length > 1 ? `${withName} ${roman}` : withName
}

/** Сводка для профиля и модального окна `/achievements` (06 §1.8, §10). */
export function getAchievementsSummary(db: Database = getDb()): AchievementsSummary {
  const progress = computeAchievements(db)
  const stored = new Map<string, StoredRow>()
  for (const row of db.prepare('SELECT * FROM user_achievements').all() as StoredRow[]) {
    stored.set(`${row.achievement_key}|${row.level}`, row)
  }

  const all: AchievementDto[] = []
  for (const item of progress) {
    item.definition.levels.forEach((levelDef, index) => {
      const level = index + 1
      const row = stored.get(`${item.key}|${level}`)
      all.push({
        key: `${item.key}:${level}`,
        baseKey: item.baseKey,
        titleKey: item.definition.titleKey,
        descriptionKey: item.definition.descriptionKey,
        params: { ...item.params, threshold: levelDef.threshold, level },
        title: titleFor(item, level),
        description: item.definition.description
          .replace('{{threshold}}', String(levelDef.threshold))
          .replace('{{name}}', String(item.params['name'] ?? '')),
        icon: item.definition.icon,
        level,
        maxLevel: item.definition.levels.length,
        progress: Math.min(item.progress, levelDef.threshold),
        threshold: levelDef.threshold,
        unlockedAt: row?.unlocked_at ?? null,
        xp: levelDef.xp,
        comingSoon: Boolean(item.definition.comingSoon)
      })
    })
  }

  const profileRow = db.prepare('SELECT xp FROM profile WHERE id = 1').get() as { xp: number } | undefined
  const xp = profileRow?.xp ?? 0
  const level = levelFromXp(xp)
  const { key: levelTitleKey } = levelTitle(level)
  const xpIntoLevel = xp % XP_PER_LEVEL_STEP

  const unlocked = all.filter((a) => a.unlockedAt)
  const recent = [...unlocked]
    .sort((a, b) => (b.unlockedAt ?? '').localeCompare(a.unlockedAt ?? ''))
    .slice(0, 6)
  const closest = all
    .filter((a) => !a.unlockedAt && !a.comingSoon && a.progress > 0)
    .sort((a, b) => b.progress / b.threshold - a.progress / a.threshold)
    .slice(0, 3)

  return {
    xp,
    level,
    levelTitleKey,
    xpToNextLevel: XP_PER_LEVEL_STEP - xpIntoLevel,
    levelProgress: xpIntoLevel / XP_PER_LEVEL_STEP,
    unlockedCount: unlocked.length,
    totalCount: all.length,
    recent,
    closest,
    all
  }
}

/**
 * Таблицы, запись в которые может изменить достижения.
 * `activity_log`, `user_achievements` и `profile` сюда НЕ входят: их пишет сам пересчёт,
 * и они вызвали бы бесконечный цикл.
 */
const WATCHED_TABLES = new Set([
  'user_game',
  'games',
  'game_genres',
  'series_games',
  'lists',
  'list_items'
])

export function shouldRecompute(tables: string[]): boolean {
  return tables.some((table) => WATCHED_TABLES.has(table))
}

/** Полный список определений — нужен UI, чтобы показать «скоро» и нулевые достижения. */
export function achievementDefinitions(): typeof ACHIEVEMENTS {
  return ACHIEVEMENTS
}
