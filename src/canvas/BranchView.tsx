import type { Point } from '../layout/geometry'
import { branchPath } from '../layout/curve'

export interface BranchViewProps {
  parent: Point
  child: Point
  color: string
  bendFactor: number
  strokeWidth: number
}

export function BranchView({ parent, child, color, bendFactor, strokeWidth }: BranchViewProps) {
  return <path d={branchPath(parent, child, bendFactor)} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
}
