import { z } from 'zod'

/** UUID v7 в нижнем регистре (02 §1). */
export const idSchema = z.string().uuid()
/** Дата без времени: YYYY | YYYY-MM | YYYY-MM-DD (02 §1). */
export const partialDateSchema = z.string().regex(/^\d{4}(-\d{2}(-\d{2})?)?$/)
/** Полная дата YYYY-MM-DD. */
export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
/** Момент времени ISO 8601 UTC с миллисекундами. */
export const timestampSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
export const hexColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/)

export const okSchema = z.object({ ok: z.literal(true) })

export type Id = z.infer<typeof idSchema>
