import { IMAGE_MAX_SIZE, type ImageKind } from '@shared/constants'
import { AppError } from '@shared/errors'
import { dominantColor } from './color'
import { call } from '@/platform/api'

/**
 * Конвейер изображений в renderer (ТЗ 01 §7):
 * источник → createImageBitmap → OffscreenCanvas (вписать в размер) → WebP q85 →
 * dominant_color → `images.save` в main. Нативных зависимостей нет.
 */

const MAX_INPUT_BYTES = 25 * 1024 * 1024
const ACCEPTED = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/bmp', 'image/avif']

export interface PreparedImage {
  bytes: Uint8Array<ArrayBuffer>
  mime: string
  width: number
  height: number
  dominantColor: string | null
  /** Data URL для предпросмотра до сохранения. */
  previewUrl: string
}

export async function bytesFromFile(file: File): Promise<{ bytes: Uint8Array; mime: string }> {
  if (file.size > MAX_INPUT_BYTES) throw new AppError('image_too_large', 'Файл больше 25 МБ')
  if (file.type && !ACCEPTED.includes(file.type)) {
    throw new AppError('image_unsupported', `Формат ${file.type} не поддерживается`)
  }
  return { bytes: new Uint8Array(await file.arrayBuffer()), mime: file.type || 'image/png' }
}

/** Чтение картинки из буфера обмена (Ctrl+V в форме каталога, 06 §7.3). */
export async function bytesFromClipboard(): Promise<{ bytes: Uint8Array; mime: string } | null> {
  if (!navigator.clipboard?.read) return null
  const items = await navigator.clipboard.read()
  for (const item of items) {
    const type = item.types.find((candidate) => candidate.startsWith('image/'))
    if (!type) continue
    const blob = await item.getType(type)
    return { bytes: new Uint8Array(await blob.arrayBuffer()), mime: type }
  }
  return null
}

/** Скачивание по URL выполняет main — renderer в сеть не ходит (10 §3 п.9). */
export async function bytesFromUrl(url: string): Promise<{ bytes: Uint8Array; mime: string }> {
  const result = await call('images.fetchUrl', { url })
  return { bytes: new Uint8Array(result.bytes), mime: result.mime }
}

interface PrepareOptions {
  kind: ImageKind
  /** Прямоугольник обрезки в координатах исходника (из кроппера). */
  crop?: { x: number; y: number; width: number; height: number }
  /** Логотипы с прозрачностью сохраняем в PNG (01 §7). */
  keepAlpha?: boolean
}

export async function prepareImage(
  source: { bytes: Uint8Array; mime: string },
  options: PrepareOptions
): Promise<PreparedImage> {
  const blob = new Blob([source.bytes.slice().buffer as ArrayBuffer], { type: source.mime })
  const bitmap = await createImageBitmap(blob)

  const cropRect = options.crop ?? { x: 0, y: 0, width: bitmap.width, height: bitmap.height }
  const limit = IMAGE_MAX_SIZE[options.kind]
  const scale = Math.min(1, limit.width / cropRect.width, limit.height / cropRect.height)
  const width = Math.max(1, Math.round(cropRect.width * scale))
  const height = Math.max(1, Math.round(cropRect.height * scale))

  const canvas = new OffscreenCanvas(width, height)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new AppError('unknown', 'OffscreenCanvas недоступен')
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(
    bitmap,
    cropRect.x,
    cropRect.y,
    cropRect.width,
    cropRect.height,
    0,
    0,
    width,
    height
  )

  const color = pickDominantColor(ctx, width, height)
  const useAlpha = options.keepAlpha === true
  const mime = useAlpha ? 'image/png' : 'image/webp'
  const outBlob = await canvas.convertToBlob(
    useAlpha ? { type: 'image/png' } : { type: 'image/webp', quality: 0.85 }
  )
  bitmap.close()

  const bytes = new Uint8Array(await outBlob.arrayBuffer())
  return {
    bytes,
    mime,
    width,
    height,
    dominantColor: color,
    previewUrl: URL.createObjectURL(outBlob)
  }
}

/** Доминирующий цвет по даунсэмплу 8×8 (01 §7). */
function pickDominantColor(
  ctx: OffscreenCanvasRenderingContext2D,
  width: number,
  height: number
): string | null {
  try {
    const small = new OffscreenCanvas(8, 8)
    const smallCtx = small.getContext('2d')
    if (!smallCtx) return null
    smallCtx.drawImage(ctx.canvas, 0, 0, width, height, 0, 0, 8, 8)
    return dominantColor(smallCtx.getImageData(0, 0, 8, 8).data)
  } catch {
    return null
  }
}

/** Полный цикл: подготовить и сохранить, вернуть DTO сохранённого изображения. */
export async function saveImage(
  source: { bytes: Uint8Array; mime: string },
  options: PrepareOptions & { sourceUrl?: string }
): Promise<{ id: string; fileName: string; dominantColor: string | null }> {
  const prepared = await prepareImage(source, options)
  const saved = await call('images.save', {
    bytes: prepared.bytes,
    kind: options.kind,
    mime: prepared.mime,
    width: prepared.width,
    height: prepared.height,
    dominantColor: prepared.dominantColor,
    sourceUrl: options.sourceUrl ?? null
  })
  URL.revokeObjectURL(prepared.previewUrl)
  return { id: saved.id, fileName: saved.fileName, dominantColor: saved.dominantColor }
}
