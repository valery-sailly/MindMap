import type { MindmapStyle, NodeId } from '../model/tree'
import type { Point } from '../layout/geometry'

export interface NodeViewProps {
  id: NodeId
  label: string
  position: Point
  fillColor: string
  strokeColor: string
  textColor: string
  style: MindmapStyle
  isSelected: boolean
  onPointerDown: (id: NodeId, clientX: number, clientY: number) => void
}

const PADDING_X = 14
const PADDING_Y = 10
const CHAR_WIDTH = 7.2
const LINE_HEIGHT = 18

export function NodeView({
  id,
  label,
  position,
  fillColor,
  strokeColor,
  textColor,
  style,
  isSelected,
  onPointerDown,
}: NodeViewProps) {
  const lines = label.split('\n')
  const longest = Math.max(1, ...lines.map((l) => l.length))
  const width = longest * CHAR_WIDTH + PADDING_X * 2
  const height = lines.length * LINE_HEIGHT + PADDING_Y * 2
  const isSimple = style === 'simple'

  return (
    <g
      transform={`translate(${position.x - width / 2}, ${position.y - height / 2})`}
      onPointerDown={(e) => onPointerDown(id, e.clientX, e.clientY)}
      style={{ cursor: 'grab' }}
      role="button"
      tabIndex={0}
      aria-label={label}
    >
      <rect
        width={width}
        height={height}
        rx={isSimple ? 4 : height / 2}
        fill={isSimple ? '#fff' : fillColor}
        stroke={isSimple ? (isSelected ? '#111' : strokeColor) : isSelected ? '#111' : 'none'}
        strokeWidth={isSimple ? (isSelected ? 2.5 : 1.5) : isSelected ? 2.5 : 0}
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
