import { useMemo, useRef } from 'react'
import {
  DEFAULT_ROOT_COLOR_NAME,
  type MindmapNode,
  type MindmapTree,
  ROOT_ID,
  defaultTextColorForStyle,
  getResolvedColor,
  toCssColor,
} from '../model/tree'
import { type Point } from '../layout/geometry'
import { computePositions } from '../layout/positions'
import { DEFAULT_BEND_FACTOR, SIMPLE_BEND_FACTOR, branchPath } from '../layout/curve'
import { useMindmapStore } from '../state/store'
import type { CanvasMode } from './useDragToPlace'
import { NodeView } from './NodeView'
import { BranchView } from './BranchView'
import { useDragToPlace } from './useDragToPlace'

const VIEW_WIDTH = 1400
const VIEW_HEIGHT = 800
const ORIGIN: Point = { x: VIEW_WIDTH / 2, y: VIEW_HEIGHT / 2 }

interface FlatNode {
  node: MindmapNode
  position: Point
  parentPosition: Point | null
  accentColor: string
  textColor: string
}

function flatten(tree: MindmapTree, positions: Map<string, Point>): FlatNode[] {
  const defaultTextColor = defaultTextColorForStyle(tree.style)

  function accentFor(node: MindmapNode): string {
    const resolved = node.id === ROOT_ID ? DEFAULT_ROOT_COLOR_NAME : (getResolvedColor(tree, node.id) ?? DEFAULT_ROOT_COLOR_NAME)
    return toCssColor(tree, resolved)
  }

  const out: FlatNode[] = []
  function walk(node: MindmapNode, parentPosition: Point | null) {
    const position = positions.get(node.id)
    if (!position) return
    const accentColor = accentFor(node)
    const textColor = node.textColor ? toCssColor(tree, node.textColor) : defaultTextColor
    out.push({ node, position, parentPosition, accentColor, textColor })
    for (const child of node.children) walk(child, position)
  }
  walk(tree.root, null)
  return out
}

export function MindmapCanvas({ angleStepDeg, mode }: { angleStepDeg: number; mode: CanvasMode }) {
  const store = useMindmapStore()
  const svgRef = useRef<SVGSVGElement | null>(null)

  const positions = useMemo(() => computePositions(store.tree, ORIGIN), [store.tree])
  const { dragFrom, dragPointer, startDrag } = useDragToPlace(svgRef, store.tree, positions, store, angleStepDeg, mode)

  const isSimple = store.tree.style === 'simple'
  const bendFactor = isSimple ? SIMPLE_BEND_FACTOR : DEFAULT_BEND_FACTOR

  const flat = useMemo(() => flatten(store.tree, positions), [store.tree, positions])

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
      className="mindmap-canvas"
      onPointerDown={(e) => {
        if (e.target === svgRef.current) store.select(null)
      }}
    >
      {flat.map(
        ({ node, position, parentPosition, accentColor }) =>
          parentPosition && (
            <BranchView
              key={`branch-${node.id}`}
              parent={parentPosition}
              child={position}
              color={accentColor}
              bendFactor={bendFactor}
              strokeWidth={1.3}
            />
          ),
      )}
      {dragFrom && dragPointer && (
        <path
          d={branchPath(dragFrom.origin, dragPointer, bendFactor)}
          fill="none"
          stroke="#999"
          strokeDasharray="6 4"
          strokeWidth={2}
        />
      )}
      {flat.map(({ node, position, accentColor, textColor }) => (
        <NodeView
          key={node.id}
          id={node.id}
          label={node.label}
          position={position}
          accentColor={accentColor}
          textColor={textColor}
          style={store.tree.style}
          mode={mode}
          isRoot={node.id === ROOT_ID}
          isSelected={store.selectedId === node.id}
          onPointerDown={startDrag}
        />
      ))}
    </svg>
  )
}
