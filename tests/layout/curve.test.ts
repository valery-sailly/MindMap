import { describe, expect, it } from 'vitest'
import { branchControlPoints, branchPath } from '../../src/layout/curve'

describe('layout/curve', () => {
  it('produces control points off the straight line between parent and child', () => {
    const parent = { x: 0, y: 0 }
    const child = { x: 100, y: 0 }
    const [c1, c2] = branchControlPoints(parent, child)
    expect(c1.y).not.toBe(0)
    expect(c2.y).not.toBe(0)
  })

  it('is deterministic for the same inputs', () => {
    const parent = { x: 10, y: 20 }
    const child = { x: 130, y: -40 }
    expect(branchPath(parent, child)).toBe(branchPath(parent, child))
  })

  it('starts and ends the path at the given points', () => {
    const parent = { x: 5, y: 5 }
    const child = { x: 50, y: 80 }
    const path = branchPath(parent, child)
    expect(path.startsWith(`M ${parent.x} ${parent.y}`)).toBe(true)
    expect(path.endsWith(`${child.x} ${child.y}`)).toBe(true)
  })
})
