import { z } from 'zod'
import { dateSchema, idSchema } from './common'

/**
 * «Итоги года» (00-TZ §6 п.10, 10 §1) — сводка за календарный год для отдельной
 * страницы и её экспорта в PNG. Считается из `user_game` (пройдено, добавлено,
 * оценки) и `play_sessions` (часы, сессии, дни, стрик).
 */

export const recapGameSchema = z.object({
  id: idSchema,
  title: z.string(),
  coverFile: z.string().nullable(),
  /** Минуты за этот год либо оценка — в зависимости от списка. */
  minutes: z.number().int().nullable(),
  rating: z.number().int().nullable()
})
export type RecapGame = z.infer<typeof recapGameSchema>

export const recapSchema = z.object({
  year: z.number().int(),
  /** Годы, по которым вообще есть данные, — для переключателя над итогами. */
  years: z.array(z.number().int()),
  /** Есть ли хоть что-то за этот год: иначе страница показывает пустое состояние. */
  hasData: z.boolean(),
  completed: z.number().int(),
  added: z.number().int(),
  mastered: z.number().int(),
  minutes: z.number().int(),
  sessions: z.number().int(),
  days: z.number().int(),
  bestStreak: z.number().int(),
  /** Месяц с наибольшим числом минут: 1–12. */
  bestMonth: z.object({ month: z.number().int(), minutes: z.number().int() }).nullable(),
  avgRating: z.number().nullable(),
  ratedCount: z.number().int(),
  topByHours: z.array(recapGameSchema),
  topRated: z.array(recapGameSchema),
  genres: z.array(z.object({ name: z.string(), count: z.number().int() })),
  firstCompleted: z.object({ title: z.string(), date: dateSchema }).nullable(),
  lastCompleted: z.object({ title: z.string(), date: dateSchema }).nullable()
})
export type Recap = z.infer<typeof recapSchema>
