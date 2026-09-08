# Контракт компонента коллекции

`GameCollectionView` — единый компонент для всех списковых экранов (ТЗ 07). Его реализует
исполнитель блока 1.4; экраны библиотеки, списка, серии, компании, поиска и каталога только
передают пропсы. Ломать сигнатуру нельзя, расширять (новые необязательные пропсы) — можно.

```tsx
import { GameCollectionView } from '@/features/collection/game-collection-view'
import type { CollectionScope, Sort } from '@shared/schema/filters'

<GameCollectionView
  scope={scope}                 // CollectionScope — обязательный
  title="Бэклог"                // H1 экрана
  subtitle="128 игр · 412 ч"    // строка под заголовком; если не задана — считается сама
  titleSlot={<InlineRename …/>} // необязательная замена заголовку (inline-переименование списка)
  headerSlot={<ListCover …/>}   // блок слева от заголовка (обложка списка/серии/логотип студии)
  actionsSlot={<Button …/>}     // дополнительные кнопки тулбара (левее переключателя вида)
  progress                      // показывать кольцо прогресса (07 §6); по умолчанию true для library/list/series/company
  filters                       // показывать панель фильтров; по умолчанию true, false для поиска
  random                        // кнопка «Что поиграть?»; по умолчанию true для library и list
  defaultSort={{ field: 'position', dir: 'asc' }}
  defaultGroupBy="finished_year"
  hiddenFilterSections={['series']}   // секции панели, скрытые в этом scope (07 §7 «Панель адаптируется к scope»)
  reorderable                    // ручной порядок с drag-n-drop (список/серия)
  onReorder={(orderedGameIds) => …}
  renderItemExtra={(game) => …}  // добавка к карточке (номер позиции, заметка, вложенные DLC)
  breadcrumbContext={{ from: 'list', fromId: list.id, fromTitle: list.name }}
  emptySlot={<EmptyState …/>}    // своё пустое состояние
/>
```

Что компонент делает сам, и экраны это НЕ дублируют:

- читает и пишет состояние вида в search-параметр маршрута `f` (`@/lib/route-state`), поэтому
  «назад/вперёд» восстанавливают фильтры, сортировку, вид и скролл;
- запоминает вид (сетка/список) и состояние панели фильтров на каждый scope в настройках
  (`useSettingsStore.setScopeView` / `setFilterPanel`);
- запрашивает `collection.query` и `collection.facets`, показывает скелетоны и ошибки;
- рисует карточки, мультивыбор, контекстное меню, быстрые действия, панель массовых операций;
- виртуализирует сетку и таблицу, включает FLIP до 300 элементов;
- показывает кольцо прогресса и кнопку «Что поиграть?».

Переход на страницу игры выполняется как
`navigate({ to: '/games/$gameId', params: { gameId }, search: breadcrumbContext ?? {} })` —
контекст нужен крошкам (05 §4.2).
