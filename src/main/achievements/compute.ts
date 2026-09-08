import type { Database } from 'better-sqlite3'
import { MAIN_LINE_CATEGORIES } from '@shared/constants'
import { longestStreak } from '../services/sessions-stats'
import { ACHIEVEMENTS, type AchievementDefinition } from './definitions'

/**
 * Детерминированный расчёт прогресса достижений из данных (ТЗ 09 §1).
 * Чистая функция над соединением — тестируется на in-memory SQLite без Electron.
 */

export interface AchievementProgress {
  /** Полный ключ: `backlog_minus` либо `genre_gourmet:<genre_id>` */
  key: string
  baseKey: string
  definition: AchievementDefinition
  /** Текущее значение счётчика */
  progress: number
  /** Подстановки для локализации (имя серии/жанра) */
  params: Record<string, string | number>
}

const one = (db: Database, sql: string, ...params: unknown[]): number => {
  const row = db.prepare(sql).get(...params) as { v: number | null } | undefined
  return Number(row?.v ?? 0)
}

export function computeAchievements(db: Database): AchievementProgress[] {
  const mainLine = MAIN_LINE_CATEGORIES.map((c) => `'${c}'`).join(', ')
  const result: AchievementProgress[] = []

  const push = (
    definition: AchievementDefinition,
    progress: number,
    suffix?: string,
    params: Record<string, string | number> = {}
  ): void => {
    result.push({
      key: suffix ? `${definition.key}:${suffix}` : definition.key,
      baseKey: definition.key,
      definition,
      progress,
      params
    })
  }

  const byKey = (key: string): AchievementDefinition =>
    ACHIEVEMENTS.find((a) => a.key === key) as AchievementDefinition

  const completed = one(db, "SELECT COUNT(*) AS v FROM user_game WHERE status = 'completed'")
  push(byKey('first_blood'), completed > 0 ? 1 : 0)
  push(byKey('backlog_minus'), completed)

  push(
    byKey('platinum'),
    one(db, 'SELECT COUNT(*) AS v FROM user_game WHERE is_mastered = 1')
  )

  push(
    byKey('marathon'),
    Math.floor(one(db, 'SELECT COALESCE(SUM(playtime_minutes), 0) AS v FROM user_game') / 60)
  )

  push(
    byKey('retro'),
    one(
      db,
      `SELECT COUNT(*) AS v FROM user_game ug
         JOIN games g ON g.id = ug.game_id
        WHERE ug.status = 'completed' AND g.release_year IS NOT NULL AND g.release_year < 2000`
    )
  )

  push(
    byKey('speedrunner'),
    one(
      db,
      `SELECT COUNT(*) AS v FROM user_game ug
         JOIN games g ON g.id = ug.game_id
        WHERE ug.status = 'completed' AND g.hltb_main_min > 0
          AND ug.playtime_minutes > 0 AND ug.playtime_minutes < g.hltb_main_min`
    )
  )

  push(
    byKey('multiplatform'),
    one(
      db,
      `SELECT COUNT(DISTINCT platform_id) AS v FROM user_game
        WHERE status = 'completed' AND platform_id IS NOT NULL`
    )
  )

  push(
    byKey('critic'),
    one(db, "SELECT COUNT(*) AS v FROM user_game WHERE review IS NOT NULL AND length(trim(review)) > 0")
  )

  // Куратор: пять списков или один список из 50+ игр
  const listCount = one(db, 'SELECT COUNT(*) AS v FROM lists')
  const biggestList = one(
    db,
    'SELECT COALESCE(MAX(cnt), 0) AS v FROM (SELECT COUNT(*) AS cnt FROM list_items GROUP BY list_id)'
  )
  push(byKey('curator'), listCount >= 5 || biggestList >= 50 ? 1 : 0)

  // Честный судья: 100 оценок и ≥ 6 разных значений шкалы
  const ratedCount = one(db, 'SELECT COUNT(*) AS v FROM user_game WHERE rating IS NOT NULL')
  const distinctRatings = one(db, 'SELECT COUNT(DISTINCT rating) AS v FROM user_game WHERE rating IS NOT NULL')
  push(byKey('fair_judge'), ratedCount >= 100 && distinctRatings >= 6 ? 1 : 0)

  // Годовой баланс: за календарный год пройдено ≥ добавлено
  const year = String(new Date().getFullYear())
  const finishedThisYear = one(
    db,
    "SELECT COUNT(*) AS v FROM user_game WHERE finished_at IS NOT NULL AND substr(finished_at, 1, 4) = ?",
    year
  )
  const addedThisYear = one(
    db,
    'SELECT COUNT(*) AS v FROM user_game WHERE substr(added_at, 1, 4) = ?',
    year
  )
  push(byKey('year_balance'), addedThisYear > 0 && finishedThisYear >= addedThisYear ? 1 : 0)

  // Разгребатель: игра пролежала в бэклоге больше двух лет до прохождения
  push(
    byKey('excavator'),
    one(
      db,
      `SELECT COUNT(*) AS v FROM user_game
        WHERE finished_at IS NOT NULL
          AND julianday(finished_at) - julianday(substr(added_at, 1, 10)) > 730`
    ) > 0
      ? 1
      : 0
  )

  // Возвращение: пройдена игра, побывавшая в «Отложена»
  push(
    byKey('comeback'),
    one(
      db,
      `SELECT COUNT(*) AS v FROM user_game ug
        WHERE ug.status = 'completed' AND EXISTS (
          SELECT 1 FROM activity_log al
           WHERE al.game_id = ug.game_id AND al.type = 'status_changed'
             AND json_extract(al.payload_json, '$.to') = 'shelved')`
    ) > 0
      ? 1
      : 0
  )

  // Стрик: самая длинная серия дней подряд с сессией. Берём именно лучшую за всю историю —
  // достижения не отбираются, когда серия прервалась (09 §1).
  const playedDays = (
    db.prepare('SELECT DISTINCT played_on AS d FROM play_sessions ORDER BY d ASC').all() as Array<{
      d: string
    }>
  ).map((row) => row.d)
  push(byKey('streak'), longestStreak(playedDays))

  // Сова: сессии, начатые после 23:00. Сессии без указанного времени не считаются —
  // время начала необязательное (09 §3: «если время сессий ведётся»).
  push(
    byKey('night_owl'),
    one(db, "SELECT COUNT(*) AS v FROM play_sessions WHERE started_at_time >= '23:00'")
  )

  // Серийный: пройдены все основные игры серии (≥ 3 игр)
  const seriesRows = db
    .prepare(
      `SELECT s.id, s.name,
              COUNT(*) AS total,
              SUM(CASE WHEN ug.status = 'completed' THEN 1 ELSE 0 END) AS done
         FROM series s
         JOIN series_games sg ON sg.series_id = s.id
         JOIN games g ON g.id = sg.game_id AND g.category IN (${mainLine})
         LEFT JOIN user_game ug ON ug.game_id = g.id
        GROUP BY s.id
       HAVING total >= 3`
    )
    .all() as Array<{ id: string; name: string; total: number; done: number }>
  const seriesDef = byKey('series_complete')
  for (const row of seriesRows) {
    push(seriesDef, row.done >= row.total ? 1 : 0, row.id, { name: row.name, done: row.done, total: row.total })
  }

  // Жанровый гурман: пройдено в жанре
  const genreRows = db
    .prepare(
      `SELECT ge.id, ge.name, COUNT(*) AS done
         FROM game_genres gg
         JOIN genres ge ON ge.id = gg.genre_id
         JOIN user_game ug ON ug.game_id = gg.game_id AND ug.status = 'completed'
        GROUP BY ge.id
       HAVING done >= 5`
    )
    .all() as Array<{ id: string; name: string; done: number }>
  const genreDef = byKey('genre_gourmet')
  for (const row of genreRows) {
    push(genreDef, row.done, row.id, { name: row.name })
  }

  return result
}

/**
 * XP по формуле ТЗ 09 §2. Уровни достижений передаются отдельно,
 * потому что считаются после прогресса.
 */
export function computeXp(db: Database, unlockedLevels: number): number {
  const completed = one(db, "SELECT COUNT(*) AS v FROM user_game WHERE status = 'completed'")
  const mastered = one(db, 'SELECT COUNT(*) AS v FROM user_game WHERE is_mastered = 1')
  // Кап 100 XP на игру: min(часы_по_игре, 100)
  const hoursXp = one(
    db,
    'SELECT COALESCE(SUM(MIN(playtime_minutes / 60, 100)), 0) AS v FROM user_game'
  )
  const reviews = one(
    db,
    'SELECT COUNT(*) AS v FROM user_game WHERE review IS NOT NULL AND length(review) >= 200'
  )
  return 10 * completed + 15 * mastered + Math.floor(hoursXp) + 3 * reviews + 20 * unlockedLevels
}
