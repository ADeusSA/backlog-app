import { draggable, dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter'
import { combine } from '@atlaskit/pragmatic-drag-and-drop/utils/combine'
import {
  attachClosestEdge,
  extractClosestEdge,
  type Edge
} from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge'
import { reorderWithEdge } from '@atlaskit/pragmatic-drag-and-drop-hitbox/util/reorder-with-edge'

/**
 * Drag-n-drop ручного порядка карточек/строк (07 §9, 06 §3.3/§4.2): перетаскивание меняет
 * позицию, применяется только когда `sort.field === 'position'` — вызывающая сторона
 * решает, включать ли `enabled`.
 */

export interface ReorderHoverState {
  overId: string | null
  edge: Edge | null
}

export interface AttachReorderableParams {
  element: HTMLElement
  id: string
  index: number
  axis: 'vertical' | 'horizontal'
  onDragStateChange: (draggingId: string | null) => void
  onHoverChange: (state: ReorderHoverState) => void
  onDropped: (sourceId: string, sourceIndex: number, targetIndex: number, edge: Edge | null) => void
}

/** Ключ данных перетаскиваемого элемента — нужен и внешним целям (корзина в «Топе любимых»). */
export const REORDER_KEY = 'reorderId'
const REORDER_INDEX = 'reorderIndex'

export function attachReorderable(params: AttachReorderableParams): () => void {
  const { element, id, index, axis, onDragStateChange, onHoverChange, onDropped } = params
  const allowedEdges: Edge[] = axis === 'vertical' ? ['top', 'bottom'] : ['left', 'right']

  return combine(
    draggable({
      element,
      getInitialData: () => ({ [REORDER_KEY]: id, [REORDER_INDEX]: index }),
      onDragStart: () => onDragStateChange(id),
      onDrop: () => onDragStateChange(null)
    }),
    dropTargetForElements({
      element,
      canDrop: ({ source }) => source.data[REORDER_KEY] !== id && typeof source.data[REORDER_KEY] === 'string',
      getData: ({ input }) =>
        attachClosestEdge(
          { [REORDER_KEY]: id, [REORDER_INDEX]: index },
          { element, input, allowedEdges }
        ),
      onDrag: ({ self }) => onHoverChange({ overId: id, edge: extractClosestEdge(self.data) }),
      onDragLeave: () => onHoverChange({ overId: null, edge: null }),
      onDrop: ({ source, self }) => {
        const edge = extractClosestEdge(self.data)
        onHoverChange({ overId: null, edge: null })
        const sourceId = source.data[REORDER_KEY]
        const sourceIndex = source.data[REORDER_INDEX]
        if (typeof sourceId === 'string' && typeof sourceIndex === 'number') {
          onDropped(sourceId, sourceIndex, index, edge)
        }
      }
    })
  )
}

/** Пересчитывает порядок id по результату `attachReorderable` (см. `reorderWithEdge`). */
export function reorderIds(
  ids: string[],
  startIndex: number,
  targetIndex: number,
  edge: Edge | null,
  axis: 'vertical' | 'horizontal'
): string[] {
  return reorderWithEdge({ list: ids, startIndex, indexOfTarget: targetIndex, closestEdgeOfTarget: edge, axis })
}

export type { Edge }
