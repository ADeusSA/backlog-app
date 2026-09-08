import { handle } from './register'
import { deleteImage, fetchImageFromUrl, gcImages, saveImage } from '../services/images.service'

/** Изображения (ТЗ 01 §7): renderer готовит пиксели, main пишет файлы. */
export function registerImagesIpc(): void {
  handle('images.save', (input) =>
    saveImage({
      bytes: input.bytes,
      kind: input.kind,
      mime: input.mime,
      width: input.width,
      height: input.height,
      ...(input.dominantColor !== undefined ? { dominantColor: input.dominantColor } : {}),
      ...(input.sourceUrl !== undefined ? { sourceUrl: input.sourceUrl } : {})
    })
  )

  handle('images.fetchUrl', async ({ url }) => fetchImageFromUrl(url))

  handle('images.delete', ({ id }) => {
    deleteImage(id)
    return { ok: true as const }
  })

  handle('images.gc', () => gcImages())
}
