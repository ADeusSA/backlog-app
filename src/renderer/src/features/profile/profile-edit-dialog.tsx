import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Search, Trash2, Upload } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { ProfileDto } from '@shared/schema/entities'
import { Button } from '@/components/ui/button'
import { CoverImage } from '@/components/ui/image'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input, Textarea } from '@/components/ui/input'
import { Avatar } from '@/components/ui/avatar'
import { toast } from '@/components/ui/toast'
import { call } from '@/platform/api'
import { bytesFromFile, saveImage } from '@/lib/image-pipeline'
import { imageUrl } from '@/lib/format'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  profile: ProfileDto
}

/** Диалог редактирования профиля (ТЗ 06 §1.1). */
export function ProfileEditDialog({ open, onOpenChange, profile }: Props): React.ReactElement {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const year = new Date().getFullYear()

  const [displayName, setDisplayName] = useState(profile.displayName)
  const [bio, setBio] = useState(profile.bio ?? '')
  const [yearGoal, setYearGoal] = useState(profile.yearGoal ? String(profile.yearGoal) : '')
  const [avatar, setAvatar] = useState<{ id: string | null; file: string | null }>({
    id: profile.avatarImageId,
    file: profile.avatarFile
  })
  const [banner, setBanner] = useState<{ id: string | null; file: string | null }>({
    id: profile.bannerImageId,
    file: profile.bannerFile
  })
  const [favorites, setFavorites] = useState<string[]>(profile.favoriteGameIds)
  const [query, setQuery] = useState('')
  const [saving, setSaving] = useState(false)
  const avatarInput = useRef<HTMLInputElement>(null)
  const bannerInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setDisplayName(profile.displayName)
    setBio(profile.bio ?? '')
    setYearGoal(profile.yearGoal ? String(profile.yearGoal) : '')
    setAvatar({ id: profile.avatarImageId, file: profile.avatarFile })
    setBanner({ id: profile.bannerImageId, file: profile.bannerFile })
    setFavorites(profile.favoriteGameIds)
  }, [open, profile])

  const { data: found } = useQuery({
    queryKey: ['games', 'quickSearch', query],
    queryFn: () => call('games.quickSearch', { q: query, limit: 8 }),
    enabled: open && query.trim().length >= 2
  })

  const { data: favoriteCards } = useQuery({
    queryKey: ['games', 'favorites', favorites],
    queryFn: () => call('games.quickSearch', { q: '', limit: 50 }),
    enabled: false
  })

  const pickImage = async (
    file: File | undefined,
    kind: 'avatar' | 'banner'
  ): Promise<void> => {
    if (!file) return
    try {
      const source = await bytesFromFile(file)
      const saved = await saveImage(source, { kind })
      if (kind === 'avatar') setAvatar({ id: saved.id, file: saved.fileName })
      else setBanner({ id: saved.id, file: saved.fileName })
    } catch (err) {
      toast({ title: (err as Error).message, tone: 'danger' })
    }
  }

  const save = async (): Promise<void> => {
    setSaving(true)
    try {
      await call('profile.patch', {
        displayName: displayName.trim() || 'Игрок',
        bio: bio.trim() || null,
        avatarImageId: avatar.id,
        bannerImageId: banner.id,
        favoriteGameIds: favorites.slice(0, 4),
        yearGoal: yearGoal.trim() ? Number(yearGoal) : null
      })
      await queryClient.invalidateQueries()
      toast({ title: t('profile.edit.saved'), tone: 'success' })
      onOpenChange(false)
    } catch (err) {
      toast({ title: (err as Error).message, tone: 'danger' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size={640}>
        <DialogHeader>
          <DialogTitle>{t('profile.edit.title')}</DialogTitle>
        </DialogHeader>

        <div className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto pr-1">
          <label className="flex flex-col gap-1">
            <span className="type-small" style={{ color: 'var(--text-2)' }}>
              {t('profile.edit.name')}
            </span>
            <Input value={displayName} onChange={(event) => setDisplayName(event.target.value)} autoFocus />
          </label>

          <label className="flex flex-col gap-1">
            <span className="type-small" style={{ color: 'var(--text-2)' }}>
              {t('profile.edit.bio')}
            </span>
            <Textarea
              value={bio}
              onChange={(event) => setBio(event.target.value)}
              rows={2}
              placeholder={t('profile.edit.bio.placeholder')}
            />
          </label>

          <div className="flex flex-wrap gap-6">
            <div className="flex items-center gap-3">
              <Avatar name={displayName} src={avatar.file ?? undefined} size={56} />
              <div className="flex flex-col gap-1">
                <span className="type-small" style={{ color: 'var(--text-2)' }}>
                  {t('profile.edit.avatar')}
                </span>
                <Button variant="secondary" size="sm" onClick={() => avatarInput.current?.click()}>
                  <Upload size={14} strokeWidth={1.75} />
                  {t('catalog.image.file')}
                </Button>
                <input
                  ref={avatarInput}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(event) => void pickImage(event.target.files?.[0], 'avatar')}
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div
                className="rounded-[var(--r-sm)]"
                style={{
                  width: 96,
                  height: 30,
                  background: banner.file
                    ? `center/cover no-repeat url(${imageUrl(banner.file)})`
                    : 'var(--surface-2)'
                }}
              />
              <div className="flex flex-col gap-1">
                <span className="type-small" style={{ color: 'var(--text-2)' }}>
                  {t('profile.edit.banner')}
                </span>
                <Button variant="secondary" size="sm" onClick={() => bannerInput.current?.click()}>
                  <Upload size={14} strokeWidth={1.75} />
                  {t('catalog.image.file')}
                </Button>
                <input
                  ref={bannerInput}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(event) => void pickImage(event.target.files?.[0], 'banner')}
                />
              </div>
            </div>
          </div>

          <label className="flex flex-col gap-1">
            <span className="type-small" style={{ color: 'var(--text-2)' }}>
              {t('profile.edit.yearGoal', { year })}
            </span>
            <Input
              type="number"
              min={0}
              value={yearGoal}
              onChange={(event) => setYearGoal(event.target.value)}
              placeholder={t('profile.edit.yearGoal.placeholder')}
              className="w-[140px]"
            />
            <span className="type-small" style={{ color: 'var(--text-3)' }}>
              {t('profile.edit.yearGoal.hint')}
            </span>
          </label>

          <div className="flex flex-col gap-2">
            <span className="type-small" style={{ color: 'var(--text-2)' }}>
              {t('profile.edit.favorites')}
            </span>
            <div className="flex flex-wrap gap-2">
              {favorites.map((id) => {
                const card =
                  profile.favoriteGames.find((game) => game.id === id) ??
                  favoriteCards?.find((game) => game.id === id)
                return (
                  <span key={id} className="flex items-center gap-2 rounded-[var(--r-sm)] px-2 py-1"
                    style={{ background: 'var(--surface-1)' }}
                  >
                    <CoverImage fileName={card?.coverFile ?? null} title={card?.title ?? id} size={24} />
                    <span className="max-w-[160px] truncate type-small">{card?.title ?? id}</span>
                    <button
                      type="button"
                      aria-label={t('profile.edit.favorites.remove')}
                      onClick={() => setFavorites((current) => current.filter((value) => value !== id))}
                    >
                      <Trash2 size={14} strokeWidth={1.75} style={{ color: 'var(--danger)' }} />
                    </button>
                  </span>
                )
              })}
            </div>
            {favorites.length < 4 && (
              <>
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={t('profile.edit.favorites.search')}
                  iconLeft={<Search size={14} strokeWidth={1.75} />}
                />
                {(found?.length ?? 0) > 0 && (
                  <ul
                    className="max-h-[160px] overflow-y-auto rounded-[var(--r-sm)]"
                    style={{ background: 'var(--surface-1)', border: '1px solid var(--border-1)' }}
                  >
                    {found
                      ?.filter((game) => !favorites.includes(game.id))
                      .map((game) => (
                        <li key={game.id}>
                          <button
                            type="button"
                            className="flex w-full items-center gap-2 px-2 py-1.5 text-left type-small hover:bg-[var(--surface-2)]"
                            onClick={() => {
                              setFavorites((current) => [...current, game.id].slice(0, 4))
                              setQuery('')
                            }}
                          >
                            <CoverImage fileName={game.coverFile} title={game.title} size={22} />
                            {game.title}
                          </button>
                        </li>
                      ))}
                  </ul>
                )}
              </>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {t('action.cancel')}
          </Button>
          <Button variant="primary" loading={saving} onClick={() => void save()}>
            {t('action.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
