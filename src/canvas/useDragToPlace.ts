// Traduit un geste souris (pointerdown sur un nœud -> drag -> pointerup) en un nouveau nœud
// placé via layout/snapping.ts. Un simple clic (déplacement en dessous du seuil) sélectionne le
// nœud au lieu d'en créer un, pour que la même interaction serve les deux usages.

import { useCallback, useEffect, useState } from 'react'
import type { RefObject } from 'react'
import type { MindmapTree, NodeId } from '../model/tree'
import { listChildAngles } from '../model/tree'
import type { Point } from '../layout/geometry'
import { measureStroke } from '../layout/snapping'
import type { MindmapStore } from '../state/store'

const CLICK_THRESHOLD_PX = 20

export function useDragToPlace(
  svgRef: RefObject<SVGSVGElement | null>,
  tree: MindmapTree,
  store: Pick<MindmapStore, 'addChild' | 'select'>,
  angleStepDeg: number,
) {
  const [dragFrom, setDragFrom] = useState<{ parentId: NodeId; origin: Point } | null>(null)
  const [dragPointer, setDragPointer] = useState<Point | null>(null)

  const toLocalPoint = useCallback(
    (clientX: number, clientY: number): Point => {
      const svg = svgRef.current
      if (!svg) return { x: 0, y: 0 }
      const rect = svg.getBoundingClientRect()
      const viewBox = svg.viewBox.baseVal
      return {
        x: ((clientX - rect.left) / rect.width) * viewBox.width + viewBox.x,
        y: ((clientY - rect.top) / rect.height) * viewBox.height + viewBox.y,
      }
    },
    [svgRef],
  )

  const startDrag = useCallback(
    (parentId: NodeId, clientX: number, clientY: number) => {
      setDragFrom({ parentId, origin: toLocalPoint(clientX, clientY) })
    },
    [toLocalPoint],
  )

  useEffect(() => {
    const from = dragFrom
    if (!from) return

    const handleMove = (e: PointerEvent) => {
      setDragPointer(toLocalPoint(e.clientX, e.clientY))
    }

    const handleUp = (e: PointerEvent) => {
      setDragFrom(null)
      setDragPointer(null)
      const pointer = toLocalPoint(e.clientX, e.clientY)
      const dx = pointer.x - from.origin.x
      const dy = pointer.y - from.origin.y
      if (Math.hypot(dx, dy) < CLICK_THRESHOLD_PX) {
        store.select(from.parentId)
        return
      }
      const occupied = listChildAngles(tree, from.parentId)
      const { grow, distance } = measureStroke(from.origin, pointer, occupied, angleStepDeg)
      store.addChild(from.parentId, { label: 'Nouveau nœud', grow, distance })
    }

    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp, { once: true })
    return () => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
    }
  }, [dragFrom, tree, store, angleStepDeg, toLocalPoint])

  return { dragFrom, dragPointer, startDrag }
}
