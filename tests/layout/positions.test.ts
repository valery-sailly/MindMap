import { describe, expect, it } from 'vitest'
import { addChild, createTree, ROOT_ID } from '../../src/model/tree'
import { computePositions } from '../../src/layout/positions'
import { polarToPoint } from '../../src/layout/geometry'

describe('layout/positions', () => {
  it('places the root at the given origin', () => {
    const tree = createTree('Root')
    const origin = { x: 500, y: 300 }
    const positions = computePositions(tree, origin)
    expect(positions.get(ROOT_ID)).toEqual(origin)
  })

  it('places a child relative to its parent using polar coordinates', () => {
    let tree = createTree('Root')
    tree = addChild(tree, ROOT_ID, { label: 'A', grow: 90, distance: 4, id: 'a' })
    const origin = { x: 0, y: 0 }
    const positions = computePositions(tree, origin)
    expect(positions.get('a')).toEqual(polarToPoint(origin, 90, 4))
  })

  it('accumulates position across two generations', () => {
    let tree = createTree('Root')
    tree = addChild(tree, ROOT_ID, { label: 'A', grow: 0, distance: 4, id: 'a' })
    tree = addChild(tree, 'a', { label: 'A1', grow: 0, distance: 3, id: 'a1' })
    const origin = { x: 0, y: 0 }
    const positions = computePositions(tree, origin)
    const aPos = positions.get('a')!
    expect(positions.get('a1')).toEqual(polarToPoint(aPos, 0, 3))
  })
})
