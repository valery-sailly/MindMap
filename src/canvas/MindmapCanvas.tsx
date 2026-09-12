import { useMemo, useRef } from 'react'
import { type MindmapNode, ROOT_ID, getResolvedColor } from '../model/tree'
import { type Point } from '../layout/geometry'
import { computePositions } from '../layout/positions'
import { branchPath } from '../layout/curve'
import { useMindmapStore } from '../state/store'
import { NodeView } from './NodeView'
import { BranchView } from './BranchView'
import { useDragToPlace } from './useDragToPlace'

const VIEW_WIDTH = 1400
const VIEW_HEIGHT = 800
const ORIGIN: Point = { x: VIEW_WIDTH / 2, y: VIEW_HEIGHT / 2 }
const ROOT_COLOR = '#26282b'

interface FlatNode {
  node: MindmapNode
  position: Point
  parentPosition: Point | null
  color: string
}

function flatten(root: MindmapNode, positions: Map<string, Point>, resolveColor: (id: string) => string): FlatNode[] {
  const out: FlatNode[] = []
  function walk(node: MindmapNode, parentPosition: Point | null) {
    const position = positions.get(node.id)
    if (!position) return
    out.push({ node, position, parentPosition, color: node.id === ROOT_ID ? ROOT_COLOR : resolveColor(node.id) })
    for (const child of node.children) walk(child, position)
  }
  walk(root, null)
  return out
}

export function MindmapCanvas({ angleStepDeg }: { angleStepDeg: number }) {
  const store = useMindmapStore()
  const svgRef = useRef<SVGSVGElement | null>(null)
  const { dragFrom, dragPointer, startDrag } = useDragToPlace(svgRef, store.tree, store, angleStepDeg)

  const positions = useMemo(() => computePositions(store.tree, ORIGIN), [store.tree])
  const flat = useMemo(
    () => flatten(store.tree.root, positions, (id) => getResolvedColor(store.tree, id) ?? '#888'),
    [store.tree, positions],
  )

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
        ({ node, position, parentPosition, color }) =>
          parentPosition && <BranchView key={`branch-${node.id}`} parent={parentPosition} child={position} color={color} />,
      )}
      {dragFrom && dragPointer && (
        <path d={branchPath(dragFrom.origin, dragPointer)} fill="none" stroke="#999" strokeDasharray="6 4" strokeWidth={2} />
      )}
      {flat.map(({ node, position, color }) => (
        <NodeView
          key={node.id}
          id={node.id}
          label={node.label}
          position={position}
          color={color}
          isRoot={node.id === ROOT_ID}
          isSelected={store.selectedId === node.id}
          onPointerDown={startDrag}
        />
      ))}
    </svg>
  )
}
