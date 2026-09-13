// Traduit un geste souris (pointerdown sur un nœud -> drag -> pointerup) en une action sur le
// modèle, mesurée via layout/snapping.ts. Un simple clic (déplacement en dessous du seuil)
// sélectionne le nœud plutôt que d'agir, pour que la même interaction serve les deux usages.
//
// Deux modes exclusifs (voir toolbox/ModeSwitch.tsx) :
// - 'create' : glisser depuis un nœud crée un nouvel enfant à l'endroit relâché.
// - 'move'   : glisser un nœud le repositionne (angle/distance relatifs à SON parent), sans rien créer.

import { useCallback, useEffect, useState } from 'react'
import type { RefObject } from 'react'
import { type MindmapTree, type NodeId, ROOT_ID, findNode, listChildAngles } from '../model/tree'
import type { Point } from '../layout/geometry'
import { measureStroke } from '../layout/snapping'
import type { MindmapStore } from '../state/store'

export type CanvasMode = 'create' | 'move'

const CLICK_THRESHOLD_PX = 20

interface DragFrom {
  nodeId: NodeId
  origin: Point
}

export function useDragToPlace(
  svgRef: RefObject<SVGSVGElement | null>,
  tree: MindmapTree,
  positions: Map<NodeId, Point>,
  store: Pick<MindmapStore, 'addChild' | 'select' | 'move'>,
  angleStepDeg: number,
  mode: CanvasMode,
) {
  const [dragFrom, setDragFrom] = useState<DragFrom | null>(null)
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
    (nodeId: NodeId) => {
      if (mode === 'move') {
        if (nodeId === ROOT_ID) return // la racine ne peut pas être déplacée : un clic simple la sélectionnera
        const parent = findNode(tree, nodeId)?.parent
        const origin = parent ? positions.get(parent.id) : undefined
        if (!origin) return
        setDragFrom({ nodeId, origin })
      } else {
        const origin = positions.get(nodeId)
        if (!origin) return
        setDragFrom({ nodeId, origin })
      }
    },
    [mode, tree, positions],
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
        store.select(from.nodeId)
        return
      }
      if (mode === 'move') {
        const parent = findNode(tree, from.nodeId)?.parent
        if (!parent) return
        const occupied = listChildAngles(tree, parent.id, from.nodeId)
        const { grow, distance } = measureStroke(from.origin, pointer, occupied, angleStepDeg)
        store.move(from.nodeId, { grow, distance })
        store.select(from.nodeId)
      } else {
        const occupied = listChildAngles(tree, from.nodeId)
        const { grow, distance } = measureStroke(from.origin, pointer, occupied, angleStepDeg)
        store.addChild(from.nodeId, { label: 'Nouveau nœud', grow, distance })
      }
    }

    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp, { once: true })
    return () => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
    }
  }, [dragFrom, tree, store, angleStepDeg, mode, toLocalPoint])

  return { dragFrom, dragPointer, startDrag }
}
