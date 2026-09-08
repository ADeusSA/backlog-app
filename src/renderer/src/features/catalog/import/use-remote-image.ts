import { useEffect, useState } from 'react'
import { call } from '@/platform/api'

/**
 * Показ картинки с сайта провайдера. Renderer в сеть не ходит (CSP запрещает внешние
 * `img-src`, а приёмка 08 §7 п. 4 требует, чтобы внешних запросов из WebView не было),
 * поэтому байты приносит main, а здесь из них делается blob-ссылка.
 *
 * Результаты кешируются на время сессии: одна и та же обложка встречается и в списке
 * совпадений, и в диалоге предпросмотра.
 */
const cache = new Map<string, string>()
const failed = new Set<string>()

export function useRemoteImage(url: string | null | undefined): string | null {
  const [src, setSrc] = useState<string | null>(() => (url ? (cache.get(url) ?? null) : null))

  useEffect(() => {
    if (!url) {
      setSrc(null)
      return
    }
    const hit = cache.get(url)
    if (hit) {
      setSrc(hit)
      return
    }
    if (failed.has(url)) {
      setSrc(null)
      return
    }

    let alive = true
    void (async () => {
      try {
        const { bytes, mime } = await call('images.fetchUrl', { url })
        const objectUrl = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: mime }))
        cache.set(url, objectUrl)
        if (alive) setSrc(objectUrl)
      } catch {
        // Часть картинок у Steam есть не для всех игр (логотип, hero) — это нормально.
        failed.add(url)
        if (alive) setSrc(null)
      }
    })()

    return () => {
      alive = false
    }
  }, [url])

  return src
}
