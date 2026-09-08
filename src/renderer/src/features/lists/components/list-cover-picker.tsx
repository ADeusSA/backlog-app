import { useRef, useState, type ReactElement } from 'react'
import Cropper, { type Area } from 'react-easy-crop'
import { Trash2, Upload } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Slider } from '@/components/ui/slider'
import { toast } from '@/components/ui/toast'
import { bytesFromFile, saveImage } from '@/lib/image-pipeline'
import { imageUrl } from '@/lib/format'
import { cn } from '@/lib/utils'

export interface ListCoverPickerProps {
  label: string
  value: string | null | undefined
  fileName?: string | null
  onChange: (imageId: string | null, fileName: string | null) => void
}

/**
 * Загрузка обложки списка через `@/lib/image-pipeline` (06 §3.2, 3:4).
 * Своя минимальная реализация — не зависит от компонентов каталога (вне моей зоны).
 */
export function ListCoverPicker({ label, value, fileName, onChange }: ListCoverPickerProps): ReactElement {
  const { t } = useTranslation()
  const inputRef = useRef<HTMLInputElement>(null)
  const [source, setSource] = useState<{ bytes: Uint8Array; mime: string } | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [area, setArea] = useState<Area | null>(null)
  const [saving, setSaving] = useState(false)

  const pickFile = async (file: File | undefined): Promise<void> => {
    if (!file) return
    try {
      const next = await bytesFromFile(file)
      setSource(next)
      setPreviewUrl(URL.createObjectURL(new Blob([next.bytes.slice().buffer as ArrayBuffer], { type: next.mime })))
      setZoom(1)
      setCrop({ x: 0, y: 0 })
    } catch (err) {
      toast({ title: (err as Error).message, tone: 'danger' })
    }
  }

  const confirm = async (): Promise<void> => {
    if (!source) return
    setSaving(true)
    try {
      const saved = await saveImage(source, {
        kind: 'list_cover',
        ...(area
          ? {
              crop: {
                x: Math.round(area.x),
                y: Math.round(area.y),
                width: Math.round(area.width),
                height: Math.round(area.height)
              }
            }
          : {})
      })
      onChange(saved.id, saved.fileName)
      setSource(null)
      if (previewUrl) URL.revokeObjectURL(previewUrl)
      setPreviewUrl(null)
    } catch (err) {
      toast({ title: (err as Error).message, tone: 'danger' })
    } finally {
      setSaving(false)
    }
  }

  const current = imageUrl(fileName ?? null)

  return (
    <div className="flex flex-col gap-2">
      <span className="type-caption">{label}</span>
      <div
        className={cn('flex items-center gap-3 rounded-[var(--r-md)] p-3')}
        style={{ background: 'var(--surface-1)', border: '1px dashed var(--border-2)' }}
      >
        {current ? (
          <img src={current} alt="" className="rounded-[var(--r-sm)] object-cover" style={{ width: 60, height: 80 }} />
        ) : (
          <div
            className="flex items-center justify-center rounded-[var(--r-sm)]"
            style={{ width: 60, height: 80, background: 'var(--surface-2)' }}
          >
            <Upload size={16} strokeWidth={1.75} style={{ color: 'var(--text-3)' }} />
          </div>
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <p className="type-small" style={{ color: 'var(--text-3)' }}>
            {t('lists.form.coverHint')}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => inputRef.current?.click()}>
              <Upload size={14} strokeWidth={1.75} />
              {t('catalog.image.file')}
            </Button>
            {value && (
              <Button type="button" variant="danger" size="sm" onClick={() => onChange(null, null)}>
                <Trash2 size={14} strokeWidth={1.75} />
                {t('catalog.image.remove')}
              </Button>
            )}
          </div>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif,image/bmp,image/avif"
          hidden
          onChange={(event) => void pickFile(event.target.files?.[0])}
        />
      </div>

      <Dialog open={Boolean(source)} onOpenChange={(open) => !open && setSource(null)}>
        <DialogContent size={480}>
          <DialogHeader>
            <DialogTitle>{t('catalog.image.crop')}</DialogTitle>
          </DialogHeader>
          <div className="relative h-[320px] w-full overflow-hidden rounded-[var(--r-md)]" style={{ background: 'var(--bg-1)' }}>
            {previewUrl && (
              <Cropper
                image={previewUrl}
                crop={crop}
                zoom={zoom}
                aspect={0.75}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={(_area, pixels) => setArea(pixels)}
              />
            )}
          </div>
          <div className="flex items-center gap-3 pt-2">
            <span className="type-small" style={{ color: 'var(--text-2)' }}>
              {t('catalog.image.zoom')}
            </span>
            <Slider min={1} max={3} step={0.01} value={zoom} onChange={setZoom} />
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setSource(null)}>
              {t('action.cancel')}
            </Button>
            <Button type="button" variant="primary" loading={saving} onClick={() => void confirm()}>
              {t('action.apply')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
