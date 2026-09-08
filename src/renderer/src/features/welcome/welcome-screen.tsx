import { useEffect, useRef, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Check, CloudOff, FolderOpen, LogIn } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { BloomBackdrop } from '@/components/ui/bloom'
import { toast } from '@/components/ui/toast'
import { call } from '@/platform/api'
import { useSettingsStore } from '@/stores/settings-store'
import { useSyncStore } from '@/stores/sync-store'
import { formatDateTime } from '@/lib/format'
import { cn } from '@/lib/utils'

type Step = 0 | 1 | 2

/** Имя профиля по умолчанию: подставляется в поле и используется при «Пропустить». */
const DEFAULT_NAME = 'Игрок'

/** Мастер первого запуска (ТЗ 05 §8): папка данных → профиль → Google. */
export function WelcomeScreen(): React.ReactElement {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>(0)
  const [displayName, setDisplayName] = useState('')
  const [withDemo, setWithDemo] = useState(false)
  const [busy, setBusy] = useState(false)
  const patchSettings = useSettingsStore((s) => s.patch)

  const { data: paths } = useQuery({ queryKey: ['paths'], queryFn: () => call('app.getPaths') })
  const { data: state } = useQuery({
    queryKey: ['onboarding'],
    queryFn: () => call('onboarding.getState')
  })
  const syncState = useSyncStore((s) => s.state)

  // Имя подставляется один раз при открытии мастера. Раньше эффект зависел от самого
  // поля и возвращал «Игрок» сразу после того, как пользователь стирал текст.
  const nameInitialized = useRef(false)
  useEffect(() => {
    if (!state || nameInitialized.current) return
    nameInitialized.current = true
    setDisplayName(DEFAULT_NAME)
  }, [state])

  const finish = async (): Promise<void> => {
    setBusy(true)
    try {
      await call('onboarding.complete', {
        // Пустое имя допустимо в поле, но в профиль уходит значение по умолчанию.
        displayName: displayName.trim() || DEFAULT_NAME,
        withDemoData: withDemo
      })
      await patchSettings({ onboardingDone: true })
      await navigate({ to: '/profile' })
    } catch (err) {
      toast({ title: (err as Error).message, tone: 'danger' })
    } finally {
      setBusy(false)
    }
  }

  const signIn = async (): Promise<void> => {
    setBusy(true)
    try {
      const next = await call('sync.signIn')
      useSyncStore.getState().set(next)
      toast({ title: t('welcome.signedIn'), tone: 'success' })
    } catch (err) {
      toast({ title: (err as Error).message, tone: 'danger' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden">
      <BloomBackdrop />
      <div className="drag-region h-[var(--h-titlebar)] shrink-0" />
      <div className="relative flex flex-1 items-center justify-center p-8">
        <div
          className="glass flex w-[560px] flex-col gap-6 rounded-[var(--r-lg)] p-8"
          style={{ border: '1px solid var(--border-1)', boxShadow: 'var(--shadow-3)' }}
        >
          <Steps current={step} />

          {step === 0 && (
            <section className="flex flex-col gap-3">
              <h1 className="type-h1">{t('welcome.step1.title')}</h1>
              <p className="type-body" style={{ color: 'var(--text-2)' }}>
                {t('welcome.step1.text')}
              </p>
              <div
                className="flex items-center gap-2 rounded-[var(--r-sm)] px-3 py-2 type-mono"
                style={{ background: 'var(--surface-1)', border: '1px solid var(--border-1)' }}
              >
                <FolderOpen size={16} strokeWidth={1.75} style={{ color: 'var(--text-3)' }} />
                <span className="truncate" style={{ color: 'var(--text-2)' }}>
                  {paths?.dataDir ?? '…'}
                </span>
              </div>
              {state?.hasDb && !state.isEmpty && (
                <p className="type-small" style={{ color: 'var(--warning)' }}>
                  {t('welcome.step1.existing', { date: formatDateTime(state.dbDate) })}
                </p>
              )}
            </section>
          )}

          {step === 1 && (
            <section className="flex flex-col gap-3">
              <h1 className="type-h1">{t('welcome.step2.title')}</h1>
              <Input
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder={t('welcome.step2.name')}
                autoFocus
              />
              <p className="type-small" style={{ color: 'var(--text-3)' }}>
                {t('welcome.step2.hint')}
              </p>
            </section>
          )}

          {step === 2 && (
            <section className="flex flex-col gap-4">
              <h1 className="type-h1">{t('welcome.step3.title')}</h1>
              <p className="type-body" style={{ color: 'var(--text-2)' }}>
                {t('welcome.step3.text')}
              </p>
              {syncState.status === 'disabled' || syncState.status === 'offline' ? (
                <Button variant="primary" size="lg" onClick={() => void signIn()} loading={busy}>
                  <LogIn size={18} strokeWidth={1.75} />
                  {t('sync.signIn')}
                </Button>
              ) : (
                <p className="flex items-center gap-2 type-body" style={{ color: 'var(--success)' }}>
                  <Check size={16} strokeWidth={1.75} />
                  {syncState.accountEmail ?? t('welcome.signedIn')}
                </p>
              )}
              <button
                type="button"
                className="flex items-center gap-2 self-start type-small"
                style={{ color: 'var(--text-3)' }}
                onClick={() => void finish()}
              >
                <CloudOff size={14} strokeWidth={1.75} />
                {t('welcome.step3.later')}
              </button>
              <Checkbox
                checked={withDemo}
                onChange={setWithDemo}
                label={t('welcome.demo')}
              />
            </section>
          )}

          <footer className="flex items-center justify-between gap-3">
            <button
              type="button"
              className="type-small"
              style={{ color: 'var(--text-3)' }}
              onClick={() => void finish()}
            >
              {t('welcome.skip')}
            </button>
            <div className="flex gap-2">
              {step > 0 && (
                <Button variant="secondary" onClick={() => setStep((s) => (s - 1) as Step)}>
                  {t('welcome.back')}
                </Button>
              )}
              {step < 2 ? (
                <Button
                  variant="primary"
                  // На шаге с именем пустое поле не пускает дальше (при «Пропустить»
                  // подставится имя по умолчанию).
                  disabled={step === 1 && displayName.trim().length === 0}
                  onClick={() => setStep((s) => (s + 1) as Step)}
                >
                  {t('welcome.next')}
                </Button>
              ) : (
                <Button variant="primary" onClick={() => void finish()} loading={busy}>
                  {t('welcome.start')}
                </Button>
              )}
            </div>
          </footer>
        </div>
      </div>
    </div>
  )
}

function Steps({ current }: { current: number }): React.ReactElement {
  return (
    <div className="flex items-center gap-2" aria-hidden>
      {[0, 1, 2].map((index) => (
        <span
          key={index}
          className={cn('h-1 flex-1 rounded-[var(--r-pill)]')}
          style={{
            background: index <= current ? 'var(--accent)' : 'var(--surface-2)',
            transition: 'background var(--d-enter) var(--ease-standard)'
          }}
        />
      ))}
    </div>
  )
}
