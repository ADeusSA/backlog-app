import type { ReactElement } from 'react'
import { useRef, useState } from 'react'
import { useNavigate, useParams } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { CalendarRange, Download } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Chip } from '@/components/ui/chip'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/components/ui/toast'
import { call } from '@/platform/api'
import { RecapCard } from './recap-card'

/** Целые CSS-пиксели: capturePage ждёт прямоугольник в них, дробные даёт размытый край. */
function rectOf(node: HTMLElement): { x: number; y: number; width: number; height: number } {
  const box = node.getBoundingClientRect()
  return {
    x: Math.floor(box.left),
    y: Math.floor(box.top),
    width: Math.ceil(box.width),
    height: Math.ceil(box.height)
  }
}

/** Итоги года (00-TZ §6 п.10): карточка со сводкой и её экспорт в PNG. */
export function RecapScreen(): ReactElement {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { year } = useParams({ strict: false }) as { year: string }
  const cardRef = useRef<HTMLDivElement>(null)
  const [saving, setSaving] = useState(false)

  const selected = Number(year)
  const { data: recap, isPending } = useQuery({
    queryKey: ['stats', 'recap', selected],
    queryFn: () => call('stats.recap', { year: selected }),
    enabled: Number.isFinite(selected)
  })

  async function savePng(): Promise<void> {
    const node = cardRef.current
    if (!node) return
    node.scrollIntoView({ block: 'center', behavior: 'instant' })
    const rect = rectOf(node)
    // capturePage умеет снимать только видимую часть страницы: в маленьком окне
    // карточка не помещается целиком, и снимок вышел бы обрезанным.
    if (rect.y < 0 || rect.x < 0 || rect.y + rect.height > window.innerHeight || rect.x + rect.width > window.innerWidth) {
      toast({ title: t('recap.tooSmall') })
      return
    }
    setSaving(true)
    try {
      const saved = await call('app.capturePng', { rect, fileName: `Backlog-${selected}.png` })
      if (saved) toast({ title: t('recap.saved'), description: saved.path, tone: 'success' })
    } catch (err) {
      toast({ title: (err as Error).message, tone: 'danger' })
    } finally {
      setSaving(false)
    }
  }

  if (isPending || !recap) {
    return (
      <div className="p-6">
        <Skeleton className="h-[420px] w-full max-w-[860px]" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="type-h1">{t('recap.heading')}</h1>
        <span className="flex-1" />
        {recap.years.slice(0, 6).map((value) => (
          <Chip
            key={value}
            selected={value === selected}
            onClick={() => void navigate({ to: '/recap/$year', params: { year: String(value) } })}
          >
            {value}
          </Chip>
        ))}
        <Button variant="secondary" loading={saving} onClick={() => void savePng()}>
          <Download size={16} strokeWidth={1.75} />
          {t('recap.savePng')}
        </Button>
      </div>

      {recap.hasData ? (
        <RecapCard recap={recap} ref={cardRef} />
      ) : (
        <EmptyState
          icon={<CalendarRange strokeWidth={1.5} />}
          title={t('recap.empty')}
          description={t('recap.emptyHint')}
        />
      )}
    </div>
  )
}
