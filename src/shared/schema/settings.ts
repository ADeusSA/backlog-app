import { z } from 'zod'
import { ANIMATION_MODES, CARD_SIZES, LOCALES, VIEW_MODES } from '../constants'

/** Локальные настройки этого ПК — файл `<dataDir>/settings.json` (02 §7). */
export const settingsSchema = z.object({
  version: z.number().int().default(1),
  deviceId: z.string().default(''),
  locale: z.enum(LOCALES).default('ru'),
  theme: z.enum(['dark', 'light', 'system']).default('dark'),
  animations: z.enum(ANIMATION_MODES).default('full'),
  showAchievements: z.boolean().default(true),
  showGameBackdrop: z.boolean().default(true),
  defaultCardSize: z.enum(CARD_SIZES).default('m'),
  density: z.enum(['normal', 'compact']).default('normal'),
  sidebarCollapsed: z.boolean().default(true),
  /** Вид коллекции, запомненный на каждый scope (07 §11.1). */
  viewByScope: z.record(z.string(), z.enum(VIEW_MODES)).default({}),
  /** Состояние панели фильтров на каждый scope. */
  filterPanelByScope: z.record(z.string(), z.boolean()).default({}),
  /** Настраиваемое второе поле подписи карточки (07 §3). */
  cardSecondaryField: z
    .enum(['year_playtime', 'developer', 'genre', 'rating', 'metacritic', 'platform', 'added_at'])
    .default('year_playtime'),
  window: z
    .object({
      width: z.number().int().default(1440),
      height: z.number().int().default(900),
      x: z.number().int().nullable().default(null),
      y: z.number().int().nullable().default(null),
      maximized: z.boolean().default(false)
    })
    .default({ width: 1440, height: 900, x: null, y: null, maximized: false }),
  sync: z
    .object({
      enabled: z.boolean().default(false),
      mode: z.enum(['auto', 'manual']).default('auto'),
      intervalMinutes: z.union([z.literal(5), z.literal(15), z.literal(30)]).default(15),
      accountEmail: z.string().nullable().default(null)
    })
    .default({ enabled: false, mode: 'auto', intervalMinutes: 15, accountEmail: null }),
  backups: z
    .object({ keep: z.number().int().min(1).max(50).default(10), daily: z.boolean().default(true) })
    .default({ keep: 10, daily: true }),
  onboardingDone: z.boolean().default(false),
  /**
   * Недавно открытые сущности командной палитры (05 §6) — до 8, самая свежая первая.
   * Локальное состояние этого ПК (как view/filter state), поэтому хранится в settings.json,
   * а не в БД: не участвует в синхронизации между устройствами.
   */
  recentSearch: z
    .array(z.object({ entityType: z.string(), id: z.string() }))
    .max(8)
    .default([])
})

export type Settings = z.infer<typeof settingsSchema>

/**
 * Схема частичного обновления настроек.
 *
 * ВАЖНО: нельзя писать `settingsSchema.partial()` — `.partial()` делает поля
 * необязательными, но НЕ снимает `.default()`, поэтому разбор `{ locale: 'en' }`
 * возвращал бы объект со ВСЕМИ полями, заполненными значениями по умолчанию, и
 * любое сохранение настройки сбрасывало бы `onboardingDone`, язык и остальное
 * (из-за этого после смены языка снова показывался мастер первого запуска).
 * Поэтому перед `.optional()` снимаем `.default()`, а вложенные объекты
 * дополнительно делаем частичными — main сливает их по ключам.
 */
function stripDefault(schema: z.ZodTypeAny): z.ZodTypeAny {
  return schema instanceof z.ZodDefault ? (schema.unwrap() as z.ZodTypeAny) : schema
}

function toPatchField(schema: z.ZodTypeAny): z.ZodTypeAny {
  const bare = stripDefault(schema)
  if (bare instanceof z.ZodObject) {
    const innerShape = Object.fromEntries(
      Object.entries(bare.shape as Record<string, z.ZodTypeAny>).map(([key, value]) => [
        key,
        stripDefault(value).optional()
      ])
    )
    return z.object(innerShape).optional()
  }
  return bare.optional()
}

export const settingsPatchSchema = z.object(
  Object.fromEntries(
    Object.entries(settingsSchema.shape as Record<string, z.ZodTypeAny>).map(([key, value]) => [
      key,
      toPatchField(value)
    ])
  )
) as unknown as z.ZodType<Partial<Settings>>

export type SettingsPatch = Partial<Settings>

export const DEFAULT_SETTINGS: Settings = settingsSchema.parse({})

/** Состояние синхронизации, показываемое в UI (03). */
export const syncStateSchema = z.object({
  status: z.enum(['disabled', 'offline', 'idle', 'syncing', 'pending', 'error', 'conflict']),
  accountEmail: z.string().nullable(),
  lastPushAt: z.string().nullable(),
  lastPullAt: z.string().nullable(),
  lastError: z.string().nullable(),
  pendingChanges: z.boolean(),
  progress: z.number().min(0).max(1).nullable()
})
export type SyncState = z.infer<typeof syncStateSchema>

export const appPathsSchema = z.object({
  dataDir: z.string(),
  imagesDir: z.string(),
  dbPath: z.string(),
  backupsDir: z.string(),
  logsDir: z.string(),
  portable: z.boolean(),
  version: z.string()
})
export type AppPaths = z.infer<typeof appPathsSchema>

export const backupDtoSchema = z.object({
  fileName: z.string(),
  createdAt: z.string(),
  sizeBytes: z.number().int(),
  kind: z.enum(['auto', 'manual', 'pre-migrate', 'pre-restore'])
})
export type BackupDto = z.infer<typeof backupDtoSchema>
