import { useState } from 'react'
import { useNavigate, useParams } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Database,
  ExternalLink,
  FolderOpen,
  Info,
  Keyboard,
  Palette,
  Plug,
  RefreshCw,
  Settings2,
  Trash2,
  type LucideIcon
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { ImportProvider, Locale } from '@shared/constants'
import type { ProviderStatus } from '@shared/schema/providers'
import { Button } from '@/components/ui/button'
import { Segmented } from '@/components/ui/segmented'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Kbd } from '@/components/ui/kbd'
import { toast } from '@/components/ui/toast'
import { useSettingsStore } from '@/stores/settings-store'
import { useSyncStore } from '@/stores/sync-store'
import { call } from '@/platform/api'
import { changeLocale } from '@/i18n'
import { formatBytes, formatDateTime } from '@/lib/format'
import { HOTKEYS, formatCombo } from '@/lib/hotkeys'
import { cn } from '@/lib/utils'

const SECTIONS: Array<{ id: string; icon: LucideIcon }> = [
  { id: 'general', icon: Settings2 },
  { id: 'appearance', icon: Palette },
  { id: 'data', icon: Database },
  { id: 'sources', icon: Plug },
  { id: 'hotkeys', icon: Keyboard },
  { id: 'about', icon: Info }
]

/** Настройки (ТЗ 06 §8). */
export function SettingsScreen(): React.ReactElement {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { section } = useParams({ strict: false }) as { section?: string }
  const active = section ?? 'general'

  return (
    <div className="flex h-full min-h-0">
      {/* 248 px: «Данные и синхронизация» — самый длинный пункт, в 220 px он переносился. */}
      <nav className="flex w-[248px] shrink-0 flex-col gap-1 p-4">
        <h1 className="type-h1 px-2 pb-3">{t('nav.settings')}</h1>
        {SECTIONS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => void navigate({ to: '/settings/$section', params: { section: item.id } })}
            // Пункты из двух строк («Данные и синхронизация») выравниваем по левому краю
            // и по верху иконки, иначе строка съезжает и ломает ритм списка.
            className={cn(
              'flex min-h-[36px] items-start gap-2 rounded-[var(--r-sm)] px-2.5 py-2 text-left type-body'
            )}
            style={{
              background: active === item.id ? 'var(--accent-soft)' : 'transparent',
              color: active === item.id ? 'var(--text-1)' : 'var(--text-2)'
            }}
          >
            <item.icon size={16} strokeWidth={1.75} className="mt-0.5 shrink-0" />
            <span className="min-w-0 flex-1">{t(`settings.section.${item.id}`)}</span>
          </button>
        ))}
      </nav>
      <div className="min-w-0 flex-1 overflow-y-auto p-6">
        {active === 'general' && <GeneralSection />}
        {active === 'appearance' && <AppearanceSection />}
        {active === 'data' && <DataSection />}
        {active === 'sources' && <SourcesSection />}
        {active === 'hotkeys' && <HotkeysSection />}
        {active === 'about' && <AboutSection />}
      </div>
    </div>
  )
}

function Row({
  title,
  description,
  children
}: {
  title: string
  description?: string
  children?: React.ReactNode
}): React.ReactElement {
  return (
    <div className="flex items-center justify-between gap-6 py-3">
      <div className="min-w-0">
        <p className="type-body">{title}</p>
        {description && (
          <p className="type-small" style={{ color: 'var(--text-2)' }}>
            {description}
          </p>
        )}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

function GeneralSection(): React.ReactElement {
  const { t } = useTranslation()
  const settings = useSettingsStore((s) => s.settings)
  const patch = useSettingsStore((s) => s.patch)
  const { data: paths } = useQuery({ queryKey: ['paths'], queryFn: () => call('app.getPaths') })

  return (
    <section className="flex max-w-[720px] flex-col">
      <h2 className="type-h2 pb-2">{t('settings.section.general')}</h2>
      <Row title={t('settings.locale')}>
        <Segmented<Locale>
          value={settings.locale}
          onChange={(locale) => {
            void patch({ locale })
            void changeLocale(locale)
          }}
          options={[
            { value: 'ru', label: 'Русский' },
            { value: 'en', label: 'English' }
          ]}
        />
      </Row>
      <Separator />
      <Row title={t('settings.dataDir')} description={paths?.dataDir}>
        <Button variant="secondary" size="sm" onClick={() => void call('app.openPath', { target: 'data' })}>
          <FolderOpen size={14} strokeWidth={1.75} />
          {t('settings.openFolder')}
        </Button>
      </Row>
      <Separator />
      <Row title={t('settings.showAchievements')} description={t('settings.showAchievements.hint')}>
        <Switch
          checked={settings.showAchievements}
          onChange={(showAchievements) => void patch({ showAchievements })}
        />
      </Row>
    </section>
  )
}

function AppearanceSection(): React.ReactElement {
  const { t } = useTranslation()
  const settings = useSettingsStore((s) => s.settings)
  const patch = useSettingsStore((s) => s.patch)

  return (
    <section className="flex max-w-[720px] flex-col">
      <h2 className="type-h2 pb-2">{t('settings.section.appearance')}</h2>
      <Row title={t('settings.theme')} description={t('settings.theme.hint')}>
        <Segmented
          value="dark"
          onChange={() => undefined}
          options={[{ value: 'dark', label: t('settings.theme.dark') }]}
        />
      </Row>
      <Separator />
      <Row title={t('settings.cardSize')}>
        <Segmented
          value={settings.defaultCardSize}
          onChange={(defaultCardSize) => void patch({ defaultCardSize })}
          options={[
            { value: 's', label: 'S' },
            { value: 'm', label: 'M' },
            { value: 'l', label: 'L' }
          ]}
        />
      </Row>
      <Separator />
      <Row title={t('settings.density')}>
        <Segmented
          value={settings.density}
          onChange={(density) => void patch({ density })}
          options={[
            { value: 'normal', label: t('settings.density.normal') },
            { value: 'compact', label: t('settings.density.compact') }
          ]}
        />
      </Row>
      <Separator />
      <Row title={t('settings.animations')} description={t('settings.animations.hint')}>
        <Segmented
          value={settings.animations}
          onChange={(animations) => void patch({ animations })}
          options={[
            { value: 'full', label: t('settings.animations.full') },
            { value: 'reduced', label: t('settings.animations.reduced') },
            { value: 'off', label: t('settings.animations.off') }
          ]}
        />
      </Row>
      <Separator />
      <Row title={t('settings.gameBackdrop')}>
        <Switch
          checked={settings.showGameBackdrop}
          onChange={(showGameBackdrop) => void patch({ showGameBackdrop })}
        />
      </Row>
    </section>
  )
}

function DataSection(): React.ReactElement {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const settings = useSettingsStore((s) => s.settings)
  const patch = useSettingsStore((s) => s.patch)
  const syncState = useSyncStore((s) => s.state)
  const [wipeOpen, setWipeOpen] = useState(false)
  const [wipeWord, setWipeWord] = useState('')

  const { data: backups } = useQuery({ queryKey: ['backups'], queryFn: () => call('backups.list') })
  const { data: syncLog } = useQuery({ queryKey: ['syncLog'], queryFn: () => call('sync.getLog') })

  const run = (promise: Promise<unknown>, success: string): void => {
    promise
      .then(() => {
        toast({ title: success, tone: 'success' })
        void queryClient.invalidateQueries()
      })
      .catch((err: Error) => toast({ title: err.message, tone: 'danger' }))
  }

  return (
    <section className="flex max-w-[720px] flex-col">
      <h2 className="type-h2 pb-2">{t('settings.section.data')}</h2>

      <Row title="Google Диск" description={syncState.accountEmail ?? t(`sync.status.${syncState.status}`)}>
        {syncState.status === 'disabled' ? (
          <Button variant="primary" size="sm" onClick={() => run(call('sync.signIn'), t('welcome.signedIn'))}>
            {t('sync.signIn')}
          </Button>
        ) : (
          <Button variant="secondary" size="sm" onClick={() => run(call('sync.signOut'), t('sync.signOut'))}>
            {t('sync.signOut')}
          </Button>
        )}
      </Row>
      <Separator />
      <Row title={t('settings.syncMode')}>
        <Segmented
          value={settings.sync.mode}
          onChange={(mode) => void patch({ sync: { ...settings.sync, mode } })}
          options={[
            { value: 'auto', label: t('settings.syncMode.auto') },
            { value: 'manual', label: t('settings.syncMode.manual') }
          ]}
        />
      </Row>
      <Separator />
      <Row title={t('settings.syncInterval')}>
        <Segmented
          value={String(settings.sync.intervalMinutes)}
          onChange={(value) =>
            void patch({
              sync: { ...settings.sync, intervalMinutes: Number(value) as 5 | 15 | 30 }
            })
          }
          options={[
            { value: '5', label: '5' },
            { value: '15', label: '15' },
            { value: '30', label: '30' }
          ]}
        />
      </Row>
      <Separator />
      <Row title={t('sync.now')}>
        <Button variant="secondary" size="sm" onClick={() => run(call('sync.now'), t('sync.status.idle'))}>
          <RefreshCw size={14} strokeWidth={1.75} />
          {t('sync.now')}
        </Button>
      </Row>

      <h3 className="type-caption pt-6">{t('settings.backups')}</h3>
      <div className="flex flex-col gap-1 py-2">
        {(backups ?? []).map((backup) => (
          <div
            key={backup.fileName}
            className="flex items-center justify-between gap-3 rounded-[var(--r-sm)] px-3 py-2"
            style={{ background: 'var(--surface-1)' }}
          >
            <span className="min-w-0 truncate type-small tabular">
              {formatDateTime(backup.createdAt)} · {formatBytes(backup.sizeBytes)} · {backup.kind}
            </span>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => run(call('backups.restore', { fileName: backup.fileName }), t('settings.restored'))}
              >
                {t('settings.restore')}
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() => run(call('backups.delete', { fileName: backup.fileName }), t('action.delete'))}
              >
                <Trash2 size={14} strokeWidth={1.75} />
              </Button>
            </div>
          </div>
        ))}
        {(backups?.length ?? 0) === 0 && (
          <p className="type-small" style={{ color: 'var(--text-3)' }}>
            {t('settings.noBackups')}
          </p>
        )}
      </div>
      <Row title={t('settings.createBackup')}>
        <Button variant="secondary" size="sm" onClick={() => run(call('backups.create'), t('settings.backupCreated'))}>
          {t('action.add')}
        </Button>
      </Row>

      <h3 className="type-caption pt-6">{t('settings.exportImport')}</h3>
      <Row title={t('settings.export')} description={t('settings.export.hint')}>
        <Button variant="secondary" size="sm" onClick={() => run(call('exportImport.export'), t('settings.exported'))}>
          {t('settings.export')}
        </Button>
      </Row>
      <Separator />
      <Row title={t('settings.import')} description={t('settings.import.hint')}>
        <Button variant="secondary" size="sm" onClick={() => run(call('exportImport.import'), t('settings.imported'))}>
          {t('settings.import')}
        </Button>
      </Row>

      {(syncLog?.length ?? 0) > 0 && (
        <>
          <h3 className="type-caption pt-6">{t('settings.syncLog')}</h3>
          <ul className="flex flex-col gap-1 py-2">
            {syncLog?.slice(0, 20).map((entry, index) => (
              <li key={`${entry.at}-${index}`} className="type-small tabular" style={{ color: 'var(--text-2)' }}>
                {formatDateTime(entry.at)} · {entry.kind} · {entry.message}
              </li>
            ))}
          </ul>
        </>
      )}

      <h3 className="type-caption pt-6" style={{ color: 'var(--danger)' }}>
        {t('settings.dangerZone')}
      </h3>
      <Row title={t('settings.wipe')} description={t('settings.wipe.hint')}>
        <Button variant="danger" size="sm" onClick={() => setWipeOpen(true)}>
          {t('settings.wipe')}
        </Button>
      </Row>

      <Dialog open={wipeOpen} onOpenChange={setWipeOpen}>
        <DialogContent size={480}>
          <DialogHeader>
            <DialogTitle>{t('settings.wipe')}</DialogTitle>
          </DialogHeader>
          <p className="type-body" style={{ color: 'var(--text-2)' }}>
            {t('settings.wipe.confirm')}
          </p>
          <Input value={wipeWord} onChange={(event) => setWipeWord(event.target.value)} placeholder="УДАЛИТЬ" />
          <DialogFooter>
            <Button variant="secondary" onClick={() => setWipeOpen(false)}>
              {t('action.cancel')}
            </Button>
            <Button
              variant="danger"
              disabled={wipeWord !== 'УДАЛИТЬ'}
              onClick={() => run(call('data.wipe', { confirm: 'УДАЛИТЬ' }), t('settings.wiped'))}
            >
              {t('action.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}

/** Источники данных (ТЗ 06 §8, 08 §4): статус провайдеров, их ключи, кеш ответов. */
function SourcesSection(): React.ReactElement {
  const { t } = useTranslation()
  const { data: statuses } = useQuery({ queryKey: ['providers', 'status'], queryFn: () => call('providers.status') })

  const statusOf = (provider: ImportProvider): ProviderStatus | undefined =>
    statuses?.find((item) => item.provider === provider)

  return (
    <section className="flex max-w-[720px] flex-col gap-4">
      <h2 className="type-h2">{t('settings.section.sources')}</h2>
      <p className="type-small" style={{ color: 'var(--text-2)' }}>
        {t('settings.sources.intro')}
      </p>

      <ProviderCard
        name="Steam"
        description={t('settings.sources.steamDesc')}
        state={t('settings.sources.noKeyNeeded')}
        tone="success"
      />

      {/*
        У RAWG ключ вшит в сборку (`.env` → src/main/providers/rawg.config.ts), поэтому
        полей для ввода здесь нет: приложение раздаётся уже готовым к работе.
      */}
      <ProviderCard
        name="RAWG"
        description={t('settings.sources.rawgDesc')}
        state={
          statusOf('rawg')?.ready
            ? t('settings.sources.bundledKey')
            : t('settings.sources.noBundledKey')
        }
        tone={statusOf('rawg')?.ready ? 'success' : 'warning'}
      >
        {!statusOf('rawg')?.ready && (
          <p className="type-small" style={{ color: 'var(--text-2)' }}>
            {t('settings.sources.noBundledKeyHint')}
          </p>
        )}
      </ProviderCard>

      <KeyedProviderCard
        provider="igdb"
        name="IGDB"
        description={t('settings.sources.igdbDesc')}
        status={statusOf('igdb')}
        steps={['settings.sources.step1', 'settings.sources.step2', 'settings.sources.step3']}
        signupUrl="https://dev.twitch.tv/console/apps/create"
        signupLabel={t('settings.sources.openTwitch')}
        secondField
        note={t('settings.sources.igdbTwitchNote')}
      />

      <Separator />
      <Row title={t('settings.sources.cache')} description={t('settings.sources.cacheHint')}>
        <Button
          variant="secondary"
          onClick={() =>
            void call('providers.clearCache').then((result) =>
              toast({ title: t('settings.sources.cacheCleared', { count: result.removed }) })
            )
          }
        >
          <RefreshCw size={16} strokeWidth={1.75} />
          {t('action.reset')}
        </Button>
      </Row>

      {/*
        Ссылки, а не просто упоминание: бесплатный тариф RAWG требует видимую ссылку
        на источник. type-small, потому что `type-caption` — верхний регистр.
      */}
      <p className="type-small" style={{ color: 'var(--text-3)' }}>
        {t('settings.sources.attribution')}{' '}
        {[
          { label: 'Steam', url: 'https://store.steampowered.com' },
          { label: 'RAWG.io', url: 'https://rawg.io' },
          { label: 'IGDB.com', url: 'https://www.igdb.com' }
        ].map((source, index) => (
          <span key={source.label}>
            {index > 0 && ', '}
            <button
              type="button"
              className="underline underline-offset-2 hover:text-text-2"
              onClick={() => void call('app.openExternal', { url: source.url })}
            >
              {source.label}
            </button>
          </span>
        ))}
        .
      </p>
    </section>
  )
}

/**
 * Карточка источника с ключами: инструкция, поля ввода, проверка и удаление.
 * `secondField` — нужен ли Client Secret (только IGDB; у RAWG ключ один).
 */
function KeyedProviderCard({
  provider,
  name,
  description,
  status,
  steps,
  signupUrl,
  signupLabel,
  secondField,
  note
}: {
  provider: ImportProvider
  name: string
  description: string
  status: ProviderStatus | undefined
  steps: string[]
  signupUrl: string
  signupLabel: string
  secondField: boolean
  note?: string
}): React.ReactElement {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [testing, setTesting] = useState(false)

  const refresh = async (): Promise<void> => {
    await queryClient.invalidateQueries({ queryKey: ['providers'] })
  }

  const save = async (): Promise<void> => {
    try {
      await call('providers.setCredentials', {
        provider,
        clientId: clientId.trim(),
        ...(secondField ? { clientSecret: clientSecret.trim() } : {})
      })
      setClientId('')
      setClientSecret('')
      await refresh()
      toast({ title: t('common.saved'), tone: 'success' })
    } catch (err) {
      toast({ title: (err as Error).message, tone: 'danger' })
    }
  }

  const check = async (): Promise<void> => {
    setTesting(true)
    try {
      const result = await call('providers.test', { provider })
      toast({ title: result.message, tone: result.ok ? 'success' : 'danger' })
    } finally {
      setTesting(false)
    }
  }

  const canSave = clientId.trim().length > 0 && (!secondField || clientSecret.trim().length > 0)

  return (
    <ProviderCard
      name={name}
      description={description}
      state={status?.ready ? t('settings.sources.keysSet') : t('settings.sources.keysMissing')}
      tone={status?.ready ? 'success' : 'warning'}
    >
      {status?.reason === 'noEncryption' ? (
        <p className="type-small" style={{ color: 'var(--danger)' }}>
          {t('settings.sources.noEncryption')}
        </p>
      ) : (
        <div className="flex flex-col gap-2 pt-1">
          {note && (
            <p className="type-small" style={{ color: 'var(--warning)' }}>
              {note}
            </p>
          )}
          <ol className="flex list-decimal flex-col gap-0.5 pl-4 type-small" style={{ color: 'var(--text-2)' }}>
            {steps.map((key) => (
              <li key={key}>{t(key)}</li>
            ))}
          </ol>
          <Button
            variant="ghost"
            size="sm"
            className="self-start"
            onClick={() => void call('app.openExternal', { url: signupUrl })}
          >
            <ExternalLink size={14} strokeWidth={1.75} />
            {signupLabel}
          </Button>
          <div className="flex flex-wrap items-end gap-2 pt-1">
            <label className="flex flex-col gap-1">
              <span className="type-caption">{secondField ? 'Client ID' : 'API key'}</span>
              <Input
                type="password"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="w-[240px]"
              />
            </label>
            {secondField && (
              <label className="flex flex-col gap-1">
                <span className="type-caption">Client Secret</span>
                <Input
                  type="password"
                  value={clientSecret}
                  onChange={(e) => setClientSecret(e.target.value)}
                  className="w-[240px]"
                />
              </label>
            )}
            <Button variant="primary" disabled={!canSave} onClick={() => void save()}>
              {t('action.save')}
            </Button>
          </div>
          <div className="flex gap-2 pt-1">
            <Button variant="secondary" size="sm" loading={testing} disabled={!status?.hasCredentials} onClick={() => void check()}>
              {t('settings.sources.test')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={!status?.hasCredentials}
              onClick={() => void call('providers.clearCredentials', { provider }).then(refresh)}
            >
              <Trash2 size={14} strokeWidth={1.75} />
              {t('settings.sources.clearKeys')}
            </Button>
          </div>
        </div>
      )}
    </ProviderCard>
  )
}

/** Карточка одного источника: имя, что даёт, состояние ключей. */
function ProviderCard({
  name,
  description,
  state,
  tone,
  children
}: {
  name: string
  description: string
  state: string
  tone: 'success' | 'warning'
  children?: React.ReactNode
}): React.ReactElement {
  return (
    <div
      className="flex flex-col gap-1 rounded-[var(--r-md)] p-4"
      style={{ background: 'var(--surface-1)', border: '1px solid var(--border-1)' }}
    >
      <div className="flex items-center gap-2">
        <span className="type-h3">{name}</span>
        <span
          className="rounded-pill px-2 py-0.5 type-caption"
          style={{
            background: `color-mix(in srgb, var(--${tone}) 18%, transparent)`,
            color: `var(--${tone})`
          }}
        >
          {state}
        </span>
      </div>
      <p className="type-small" style={{ color: 'var(--text-2)' }}>
        {description}
      </p>
      {children}
    </div>
  )
}

function HotkeysSection(): React.ReactElement {
  const { t } = useTranslation()
  return (
    <section className="flex max-w-[720px] flex-col">
      <h2 className="type-h2 pb-2">{t('settings.section.hotkeys')}</h2>
      <p className="type-small pb-3" style={{ color: 'var(--text-3)' }}>
        {t('settings.hotkeys.hint')}
      </p>
      {HOTKEYS.map((hotkey) => (
        <div key={hotkey.id} className="flex items-center justify-between gap-4 py-1.5">
          <span className="type-body" style={{ color: 'var(--text-2)' }}>
            {t(hotkey.i18nKey)}
          </span>
          <Kbd keys={formatCombo(hotkey.combo).split(' + ')} />
        </div>
      ))}
    </section>
  )
}

function AboutSection(): React.ReactElement {
  const { t } = useTranslation()
  const { data } = useQuery({ queryKey: ['version'], queryFn: () => call('app.getVersion') })
  const { data: paths } = useQuery({ queryKey: ['paths'], queryFn: () => call('app.getPaths') })

  return (
    <section className="flex max-w-[720px] flex-col gap-2">
      <h2 className="type-h2 pb-2">{t('settings.section.about')}</h2>
      <dl className="grid grid-cols-[200px_1fr] gap-y-2 type-body">
        <dt style={{ color: 'var(--text-2)' }}>{t('settings.version')}</dt>
        <dd className="tabular">{data?.app ?? '—'}</dd>
        <dt style={{ color: 'var(--text-2)' }}>Electron</dt>
        <dd className="tabular">{data?.electron ?? '—'}</dd>
        <dt style={{ color: 'var(--text-2)' }}>Chromium</dt>
        <dd className="tabular">{data?.chrome ?? '—'}</dd>
        <dt style={{ color: 'var(--text-2)' }}>SQLite</dt>
        <dd className="tabular">
          {data?.sqlite ?? '—'} {data?.fts5 ? '· FTS5' : ''}
        </dd>
        <dt style={{ color: 'var(--text-2)' }}>{t('settings.dataDir')}</dt>
        <dd className="type-mono truncate">{paths?.dataDir ?? '—'}</dd>
      </dl>
      <div className="flex gap-2 pt-3">
        <Button variant="secondary" size="sm" onClick={() => void call('app.openPath', { target: 'logs' })}>
          <FolderOpen size={14} strokeWidth={1.75} />
          {t('settings.openLogs')}
        </Button>
      </div>
    </section>
  )
}
