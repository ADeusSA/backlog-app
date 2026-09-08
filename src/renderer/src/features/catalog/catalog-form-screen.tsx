import { useParams, useRouterState } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { GameForm } from './forms/game-form'
import { CompanyForm, SeriesForm, SimpleEntityForm } from './forms/entity-forms'

/** Диспетчер форм каталога: /catalog/:entity/new и /catalog/:entity/:id/edit (ТЗ 06 §7). */
export function CatalogFormScreen(): React.ReactElement {
  const { t } = useTranslation()
  const params = useParams({ strict: false }) as { entity?: string; id?: string }
  const isEdit = useRouterState({ select: (s) => s.location.pathname.endsWith('/edit') })
  const entity = params.entity ?? 'games'

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 p-6">
      <h1 className="type-h1">
        {isEdit ? t('catalog.edit') : t('catalog.new')} · {t(`catalog.entity.${entity}`)}
      </h1>
      {entity === 'games' && <GameForm gameId={isEdit ? params.id : undefined} />}
      {entity === 'companies' && <CompanyForm id={isEdit ? params.id : undefined} />}
      {entity === 'series' && <SeriesForm id={isEdit ? params.id : undefined} />}
      {(entity === 'genres' || entity === 'platforms' || entity === 'tags') && (
        <SimpleEntityForm entity={entity} id={isEdit ? params.id : undefined} />
      )}
    </div>
  )
}
