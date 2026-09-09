import type { CSSProperties, ReactElement } from 'react'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { imageUrl } from '@/lib/format'

export interface CoverImageProps {
  fileName: string | null | undefined
  title: string
  dominantColor?: string | null
  ratio?: '3/4' | '16/9'
  size?: number
  className?: string
}

/**
 * Обложка игры: `<img loading="lazy" decoding="async">` либо плейсхолдер
 * (заливка `dominantColor`/`--surface-2` + название по центру) с шиммером
 * до загрузки и fade 200 мс при появлении (04 §6, 07 §3, 07 §8).
 */
export function CoverImage({
  fileName,
  title,
  dominantColor,
  ratio = '3/4',
  size,
  className
}: CoverImageProps): ReactElement {
  const [loaded, setLoaded] = useState(false)
  const src = imageUrl(fileName)

  const style: CSSProperties = { aspectRatio: ratio }
  if (size) style.width = size

  // В мелких плитках (палитра, «Недавно добавлено») название не помещается и обрезается
  // посреди буквы — там показываем инициалы.
  const compact = size !== undefined && size < 64

  return (
    <div className={cn('relative overflow-hidden rounded-md bg-surface-2', className)} style={style}>
      <div
        className="absolute inset-0 flex items-center justify-center px-2 text-center"
        style={{ background: dominantColor ?? 'var(--surface-2)' }}
      >
        {compact ? (
          <span className="type-caption font-semibold text-text-2" aria-hidden>
            {initialsOf(title)}
          </span>
        ) : (
          <span className="type-small line-clamp-2 font-semibold text-text-2">{title}</span>
        )}
      </div>
      {src && (
        <img
          src={src}
          alt={title}
          loading="lazy"
          decoding="async"
          // Иначе браузер начинает собственное перетаскивание картинки и перехватывает
          // drag-n-drop карточек (ручной порядок коллекции, «Топ любимых»).
          draggable={false}
          onLoad={() => setLoaded(true)}
          className={cn(
            'absolute inset-0 h-full w-full object-cover transition-opacity',
            loaded ? 'opacity-100' : 'opacity-0'
          )}
          style={{ transitionDuration: '200ms', transitionTimingFunction: 'var(--ease-standard)' }}
        />
      )}
      {src && !loaded && <div className="skeleton absolute inset-0 rounded-none" aria-hidden />}
    </div>
  )
}

/** До двух заглавных букв названия: «Elden Ring» → «ER», «Pyre» → «P». */
function initialsOf(title: string): string {
  return title
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('')
}
