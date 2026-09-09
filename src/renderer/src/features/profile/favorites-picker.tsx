import type { ReactElement } from 'react'
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Check, Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { FAVORITES_LIMIT } from '@shared/constants'
import { CoverImage } from '@/components/ui/image'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { call } from '@/platform/api'
import { cn } from '@/lib/utils'

export interface FavoritesPickerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Уже добавленные в топ — отмечены галочкой и недоступны. */
  selectedIds: string[]
  onPick: (gameId: string) => void
}

/**
 * Выбор игр в «Топ любимых» (06 §1.4): показывает всё, что отмечено сердечком.
 * Клик по карточке добавляет игру в конец топа, диалог остаётся открытым.
 */
export function FavoritesPicker({
  open,
  onOpenChange,
  selectedIds,
  onPick
}: FavoritesPickerProps): ReactElement {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')

  const { data } = useQuery({
    queryKey: ['collection', 'favorites'],
    queryFn: () =>
      call('collection.query', {
        scope: { kind: 'library' },
        filters: { flags: { favorite: true } },
        sort: { field: 'title', dir: 'asc' }
      }),
    enabled: open
  })

  const games = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const items = data?.items ?? []
    return needle ? items.filter((game) => game.title.toLowerCase().includes(needle)) : items
  }, [data, query])

  const full = selectedIds.length >= FAVORITES_LIMIT

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size={800}>
        <DialogHeader>
          <DialogTitle>{t('profile.favorites.pick.title')}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('profile.favorites.pick.search')}
            iconLeft={<Search size={14} strokeWidth={1.75} />}
          />

          <p className="type-small" style={{ color: full ? 'var(--warning)' : 'var(--text-2)' }}>
            {full
              ? t('profile.favorites.limit', { count: FAVORITES_LIMIT })
              : t('profile.favorites.pick.hint', { count: FAVORITES_LIMIT - selectedIds.length })}
          </p>

          {games.length === 0 ? (
            <p className="type-small" style={{ color: 'var(--text-3)' }}>
              {t('profile.favorites.pick.empty')}
            </p>
          ) : (
            <ul className="grid max-h-[52vh] grid-cols-[repeat(auto-fill,minmax(104px,1fr))] gap-3 overflow-y-auto pr-1">
              {games.map((game) => {
                const picked = selectedIds.includes(game.id)
                const disabled = picked || full
                return (
                  <li key={game.id}>
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => onPick(game.id)}
                      title={game.title}
                      className={cn(
                        'flex w-full flex-col gap-1.5 rounded-[var(--r-md)] p-1 text-left outline-none',
                        'transition-[background,transform] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)]',
                        disabled
                          ? 'opacity-45'
                          : 'hover:-translate-y-0.5 hover:bg-[var(--surface-1)]'
                      )}
                      style={{ transitionDuration: 'var(--d-hover)' }}
                    >
                      <span className="relative block">
                        <CoverImage
                          fileName={game.coverFile}
                          title={game.title}
                          dominantColor={game.dominantColor}
                          size={96}
                        />
                        {picked && (
                          <span
                            className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-full"
                            style={{ background: 'var(--accent)' }}
                          >
                            <Check size={12} strokeWidth={2.5} style={{ color: 'var(--accent-on)' }} />
                          </span>
                        )}
                      </span>
                      <span className="line-clamp-2 type-small">{game.title}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
