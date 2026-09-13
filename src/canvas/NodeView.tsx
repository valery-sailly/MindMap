import type { MindmapStyle, NodeId } from '../model/tree'
import type { Point } from '../layout/geometry'
import type { CanvasMode } from './useDragToPlace'

export interface NodeViewProps {
  id: NodeId
  label: string
  position: Point
  /** Couleur d'accent : bordure de la case en style fancy, ligne de connexion, sélection. */
  accentColor: string
  textColor: string
  style: MindmapStyle
  mode: CanvasMode
  isRoot: boolean
  isSelected: boolean
  onPointerDown: (id: NodeId) => void
}

const PADDING_X = 14
const PADDING_Y = 10
const CHAR_WIDTH = 7.2
const LINE_HEIGHT = 18

export function NodeView({
  id,
  label,
  position,
  accentColor,
  textColor,
  style,
  mode,
  isRoot,
  isSelected,
  onPointerDown,
}: NodeViewProps) {
  const lines = label.split('\n')
  const longest = Math.max(1, ...lines.map((l) => l.length))
  const width = longest * CHAR_WIDTH + PADDING_X * 2
  const height = lines.length * LINE_HEIGHT + PADDING_Y * 2
  const isSimple = style === 'simple'
  const cursor = mode === 'move' ? (isRoot ? 'default' : 'move') : 'copy'

  // fancy : case toujours visible (bordure = couleur d'accent, blanc par défaut).
  // simple : aucune case — seule la sélection affiche un contour pointillé temporaire.
  const showBorder = !isSimple || isSelected
  const borderColor = isSelected ? '#111' : accentColor

  return (
    <g
      transform={`translate(${position.x - width / 2}, ${position.y - height / 2})`}
      onPointerDown={() => onPointerDown(id)}
      style={{ cursor }}
      role="button"
      tabIndex={0}
      aria-label={label}
    >
      <rect
        width={width}
        height={height}
        rx={6}
        fill={isSimple ? 'transparent' : '#fff'}
        stroke={showBorder ? borderColor : 'none'}
        strokeWidth={isSelected ? 2 : isSimple ? 0 : 1.3}
        strokeDasharray={isSimple && isSelected ? '3 2' : undefined}
      />
      <text
        x={width / 2}
        y={height / 2}
        textAnchor="middle"
        dominantBaseline="central"
        fill={textColor}
        fontSize={13}
        fontFamily="system-ui, sans-serif"
      >
        {lines.map((line, i) => (
          <tspan key={i} x={width / 2} dy={i === 0 ? 0 : LINE_HEIGHT}>
            {line}
          </tspan>
        ))}
      </text>
    </g>
  )
}
