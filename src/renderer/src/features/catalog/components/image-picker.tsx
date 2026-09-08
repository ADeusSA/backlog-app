import { useCallback, useRef, useState } from 'react'
import Cropper, { type Area } from 'react-easy-crop'
import { Clipboard, Link2, Trash2, Upload } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { ImageKind } from '@shared/constants'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Slider } from '@/components/ui/slider'
import { toast } from '@/components/ui/toast'
import { bytesFromClipboard, bytesFromFile, bytesFromUrl, saveImage } from '@/lib/image-pipeline'
import { formatBytes, imageUrl } from '@/lib/format'
import { cn } from '@/lib/utils'

interface Props {
  kind: ImageKind
  /** Соотношение сторон кроппера; 0 — без обрезки (логотип). */
  aspect: number
  value: string | null
  /** Имя файла для предпросмотра уже сохранённой картинки. */
  fileName?: string | null
  onChange: (imageId: string | null, fileName: string | null, dominantColor: string | null) => void
  label: string
}

/**
 * Выбор изображения: файл, буфер обмена, URL; затем кроппер и конвертация в WebP
 * (ТЗ 06 §7.3, 01 §7). В сеть ходит main, renderer только готовит пиксели.
 */
export function ImagePicker({ kind, aspect, value, fileName, onChange, label }: Props): React.ReactElement {
  const { t } = useTranslation()
  const inputRef = useRef<HTMLInputElement>(null)
  const [source, setSource] = useState<{ bytes: Uint8Array; mime: string } | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [urlValue, setUrlValue] = useState('')
  const [urlOpen, setUrlOpen] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [area, setArea] = useState<Area | null>(null)
  const [saving, setSaving] = useState(false)
  const [savedInfo, setSavedInfo] = useState<string | null>(null)

  const openSource = useCallback((next: { bytes: Uint8Array; mime: string }) => {
    setSource(next)
    setPreviewUrl(URL.createObjectURL(new Blob([next.bytes.slice().buffer as ArrayBuffer], { type: next.mime })))
    setZoom(1)
    setCrop({ x: 0, y: 0 })
  }, [])

  const pickFile = async (file: File | undefined): Promise<void> => {
    if (!file) return
    try {
      openSource(await bytesFromFile(file))
    } catch (err) {
      toast({ title: (err as Error).message, tone: 'danger' })
    }
  }

  const pasteFromClipboard = async (): Promise<void> => {
    try {
      const result = await bytesFromClipboard()
      if (!result) {
        toast({ title: t('catalog.image.noClipboard') })
        return
      }
      openSource(result)
    } catch (err) {
      toast({ title: (err as Error).message, tone: 'danger' })
    }
  }

  const loadUrl = async (): Promise<void> => {
    try {
      openSource(await bytesFromUrl(urlValue.trim()))
      setUrlOpen(false)
      setUrlValue('')
    } catch (err) {
      toast({ title: (err as Error).message, tone: 'danger' })
    }
  }

  const confirm = async (): Promise<void> => {
    if (!source) return
    setSaving(true)
    try {
      const saved = await saveImage(source, {
        kind,
        keepAlpha: kind === 'logo' && source.mime === 'image/png',
        ...(area && aspect > 0
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
      onChange(saved.id, saved.fileName, saved.dominantColor)
      setSavedInfo(t('catalog.image.saved'))
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
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault()
          void pickFile(event.dataTransfer.files[0])
        }}
      >
        {current ? (
          <img
            src={current}
            alt=""
            className="rounded-[var(--r-sm)] object-cover"
            style={{ width: 72, height: aspect === 0.75 ? 96 : 48 }}
          />
        ) : (
          <div
            className="flex items-center justify-center rounded-[var(--r-sm)]"
            style={{ width: 72, height: aspect === 0.75 ? 96 : 48, background: 'var(--surface-2)' }}
          >
            <Upload size={18} strokeWidth={1.75} style={{ color: 'var(--text-3)' }} />
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <p className="type-small" style={{ color: 'var(--text-3)' }}>
            {savedInfo ?? t('catalog.image.hint')}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={() => inputRef.current?.click()}>
              <Upload size={14} strokeWidth={1.75} />
              {t('catalog.image.file')}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => void pasteFromClipboard()}>
              <Clipboard size={14} strokeWidth={1.75} />
              {t('catalog.image.clipboard')}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setUrlOpen(true)}>
              <Link2 size={14} strokeWidth={1.75} />
              {t('catalog.image.url')}
            </Button>
            {value && (
              <Button variant="danger" size="sm" onClick={() => onChange(null, null, null)}>
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
        <DialogContent size={640}>
          <DialogHeader>
            <DialogTitle>{t('catalog.image.crop')}</DialogTitle>
          </DialogHeader>
          <div className="relative h-[360px] w-full overflow-hidden rounded-[var(--r-md)]" style={{ background: 'var(--bg-1)' }}>
            {previewUrl && aspect > 0 && (
              <Cropper
                image={previewUrl}
                crop={crop}
                zoom={zoom}
                aspect={aspect}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={(_area, pixels) => setArea(pixels)}
              />
            )}
            {previewUrl && aspect === 0 && (
              <img src={previewUrl} alt="" className="h-full w-full object-contain" />
            )}
          </div>
          {aspect > 0 && (
            <div className="flex items-center gap-3 pt-2">
              <span className="type-small" style={{ color: 'var(--text-2)' }}>
                {t('catalog.image.zoom')}
              </span>
              <Slider min={1} max={3} step={0.01} value={zoom} onChange={setZoom} />
            </div>
          )}
          {source && (
            <p className="type-small" style={{ color: 'var(--text-3)' }}>
              {formatBytes(source.bytes.byteLength)} → WebP q85
            </p>
          )}
          <DialogFooter>
            <Button variant="secondary" onClick={() => setSource(null)}>
              {t('action.cancel')}
            </Button>
            <Button variant="primary" loading={saving} onClick={() => void confirm()}>
              {t('action.apply')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={urlOpen} onOpenChange={setUrlOpen}>
        <DialogContent size={480}>
          <DialogHeader>
            <DialogTitle>{t('catalog.image.url')}</DialogTitle>
          </DialogHeader>
          <Input
            value={urlValue}
            onChange={(event) => setUrlValue(event.target.value)}
            placeholder="https://…"
            autoFocus
          />
          <DialogFooter>
            <Button variant="secondary" onClick={() => setUrlOpen(false)}>
              {t('action.cancel')}
            </Button>
            <Button variant="primary" disabled={!urlValue.trim()} onClick={() => void loadUrl()}>
              {t('action.add')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
