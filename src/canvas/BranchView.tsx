import type { Point } from '../layout/geometry'
import { branchPath } from '../layout/curve'

export interface BranchViewProps {
  parent: Point
  child: Point
  color: string
}

export function BranchView({ parent, child, color }: BranchViewProps) {
  return <path d={branchPath(parent, child)} fill="none" stroke={color} strokeWidth={3} strokeLinecap="round" />
}
