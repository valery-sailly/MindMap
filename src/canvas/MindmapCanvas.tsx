import { useMemo, useRef } from 'react'
import { type MindmapNode, type MindmapTree, ROOT_ID, getResolvedColor, toCssColor } from '../model/tree'
import { type Point } from '../layout/geometry'
import { computePositions } from '../layout/positions'
import { DEFAULT_BEND_FACTOR, SIMPLE_BEND_FACTOR, branchPath } from '../layout/curve'
import { useMindmapStore } from '../state/store'
import { NodeView } from './NodeView'
import { BranchView } from './BranchView'
import { useDragToPlace } from './useDragToPlace'

const VIEW_WIDTH = 1400
const VIEW_HEIGHT = 800
const ORIGIN: Point = { x: VIEW_WIDTH / 2, y: VIEW_HEIGHT / 2 }
const ROOT_COLOR = '#26282b'
const ROOT_BORDER_COLOR = '#333333'

interface FlatNode {
  node: MindmapNode
  position: Point
  parentPosition: Point | null
  fillColor: string
  strokeColor: string
  textColor: string
}

function flatten(tree: MindmapTree, positions: Map<string, Point>): FlatNode[] {
  const isSimple = tree.style === 'simple'
  const defaultTextColor = isSimple ? 'black' : 'white'

  function colorsFor(node: MindmapNode): { fillColor: string; strokeColor: string } {
    if (node.id === ROOT_ID) return { fillColor: ROOT_COLOR, strokeColor: ROOT_BORDER_COLOR }
    const resolved = getResolvedColor(tree, node.id) ?? 'gray'
    const css = toCssColor(tree, resolved)
    return { fillColor: css, strokeColor: css }
  }

  const out: FlatNode[] = []
  function walk(node: MindmapNode, parentPosition: Point | null) {
    const position = positions.get(node.id)
    if (!position) return
    const { fillColor, strokeColor } = colorsFor(node)
    const textColor = node.textColor ? toCssColor(tree, node.textColor) : defaultTextColor
    out.push({ node, position, parentPosition, fillColor, strokeColor, textColor })
    for (const child of node.children) walk(child, position)
  }
  walk(tree.root, null)
  return out
}

export function MindmapCanvas({ angleStepDeg }: { angleStepDeg: number }) {
  const store = useMindmapStore()
  const svgRef = useRef<SVGSVGElement | null>(null)
  const { dragFrom, dragPointer, startDrag } = useDragToPlace(svgRef, store.tree, store, angleStepDeg)

  const isSimple = store.tree.style === 'simple'
  const bendFactor = isSimple ? SIMPLE_BEND_FACTOR : DEFAULT_BEND_FACTOR
  const branchWidth = isSimple ? 1.5 : 3

  const positions = useMemo(() => computePositions(store.tree, ORIGIN), [store.tree])
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
        ({ node, position, parentPosition, fillColor }) =>
          parentPosition && (
            <BranchView
              key={`branch-${node.id}`}
              parent={parentPosition}
              child={position}
              color={fillColor}
              bendFactor={bendFactor}
              strokeWidth={branchWidth}
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
      {flat.map(({ node, position, fillColor, strokeColor, textColor }) => (
        <NodeView
          key={node.id}
          id={node.id}
          label={node.label}
          position={position}
          fillColor={fillColor}
          strokeColor={strokeColor}
          textColor={textColor}
          style={store.tree.style}
          isSelected={store.selectedId === node.id}
          onPointerDown={startDrag}
        />
      ))}
    </svg>
  )
}
