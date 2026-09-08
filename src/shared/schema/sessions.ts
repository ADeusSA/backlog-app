import { z } from 'zod'
import { PLAYTHROUGH_STATUSES } from '../constants'
import { dateSchema, idSchema, timestampSchema } from './common'

/**
 * Журнал сессий и прохождения (02 §3.9, 10 §1 итерация 2).
 * Вынесено из `entities.ts` отдельным файлом: домен самостоятельный и на него
 * не ссылаются карточки/каталог.
 */

/** Время начала сессии — необязательное, местное, 'HH:MM' (ADR 0008). */
export const clockTimeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)

/** Максимум суток на одну сессию: больше — это уже не сессия, а ошибка ввода. */
export const SESSION_MAX_MINUTES = 24 * 60

export const playSessionDtoSchema = z.object({
  id: idSchema,
  gameId: idSchema,
  gameTitle: z.string(),
  coverFile: z.string().nullable(),
  playthroughId: idSchema.nullable(),
  playthroughTitle: z.string().nullable(),
  playedOn: dateSchema,
  startedAtTime: clockTimeSchema.nullable(),
  minutes: z.number().int().positive(),
  note: z.string().nullable(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema
})
export type PlaySessionDto = z.infer<typeof playSessionDtoSchema>

export const sessionInputSchema = z.object({
  id: idSchema.optional(),
  gameId: idSchema,
  playthroughId: idSchema.nullish(),
  playedOn: dateSchema,
  startedAtTime: clockTimeSchema.nullish(),
  minutes: z.number().int().min(1).max(SESSION_MAX_MINUTES),
  note: z.string().max(500).nullish()
})
export type SessionInput = z.infer<typeof sessionInputSchema>

export const playthroughDtoSchema = z.object({
  id: idSchema,
  gameId: idSchema,
  number: z.number().int().positive(),
  title: z.string().nullable(),
  platformId: idSchema.nullable(),
  platformName: z.string().nullable(),
  status: z.enum(PLAYTHROUGH_STATUSES),
  isReplay: z.boolean(),
  isMastered: z.boolean(),
  rating: z.number().int().min(1).max(10).nullable(),
  playtimeMinutes: z.number().int(),
  startedAt: dateSchema.nullable(),
  finishedAt: dateSchema.nullable(),
  notes: z.string().nullable(),
  /** Сколько сессий привязано: если > 0, время считается по ним, а не руками. */
  sessionCount: z.number().int(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema
})
export type PlaythroughDto = z.infer<typeof playthroughDtoSchema>

export const playthroughInputSchema = z.object({
  id: idSchema.optional(),
  gameId: idSchema,
  title: z.string().max(120).nullish(),
  platformId: idSchema.nullish(),
  status: z.enum(PLAYTHROUGH_STATUSES).default('in_progress'),
  isReplay: z.boolean().default(false),
  isMastered: z.boolean().default(false),
  rating: z.number().int().min(1).max(10).nullish(),
  playtimeMinutes: z.number().int().min(0).max(100000 * 60).default(0),
  startedAt: dateSchema.nullish(),
  finishedAt: dateSchema.nullish(),
  notes: z.string().max(4000).nullish()
})
export type PlaythroughInput = z.infer<typeof playthroughInputSchema>

/** Один день карты активности (06 §1.9). */
export const activityDaySchema = z.object({
  date: dateSchema,
  minutes: z.number().int(),
  sessions: z.number().int()
})
export type ActivityDay = z.infer<typeof activityDaySchema>

export const activitySummarySchema = z.object({
  from: dateSchema,
  to: dateSchema,
  /** Только дни, в которых что-то было: пустые ячейки рисует UI. */
  days: z.array(activityDaySchema),
  streak: z.object({
    /** Дни подряд, заканчивающиеся сегодня или вчера. */
    current: z.number().int(),
    longest: z.number().int()
  }),
  totals: z.object({
    minutes: z.number().int(),
    sessions: z.number().int(),
    days: z.number().int(),
    games: z.number().int()
  }),
  /** Годы, в которых есть хотя бы одна сессия — для переключателя периода. */
  years: z.array(z.number().int())
})
export type ActivitySummary = z.infer<typeof activitySummarySchema>
