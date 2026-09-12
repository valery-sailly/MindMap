import { describe, expect, it } from 'vitest'
import {
  ROOT_ID,
  addChild,
  createTree,
  getResolvedColor,
  listChildAngles,
  moveNode,
  recolorNode,
  relabelNode,
  removeNode,
} from '../../src/model/tree'

describe('model/tree', () => {
  it('creates a tree with a single root and no children', () => {
    const tree = createTree('Root')
    expect(tree.root.id).toBe(ROOT_ID)
    expect(tree.root.label).toBe('Root')
    expect(tree.root.children).toHaveLength(0)
  })

  it('adds children immutably (does not mutate the original tree)', () => {
    const tree = createTree('Root')
    const next = addChild(tree, ROOT_ID, { label: 'A', grow: 90, id: 'a' })
    expect(tree.root.children).toHaveLength(0)
    expect(next.root.children).toHaveLength(1)
    expect(next.root.children[0]).toMatchObject({ id: 'a', label: 'A', grow: 90 })
  })

  it('adds grandchildren under the correct parent', () => {
    let tree = createTree('Root')
    tree = addChild(tree, ROOT_ID, { label: 'A', grow: 90, id: 'a' })
    tree = addChild(tree, 'a', { label: 'A1', grow: 90, id: 'a1' })
    expect(tree.root.children[0].children[0]).toMatchObject({ id: 'a1', label: 'A1' })
  })

  it('resolves color by inheriting from the nearest colored ancestor', () => {
    let tree = createTree('Root')
    tree = addChild(tree, ROOT_ID, { label: 'A', grow: 90, id: 'a', color: '#123456' })
    tree = addChild(tree, 'a', { label: 'A1', grow: 90, id: 'a1' })
    expect(getResolvedColor(tree, 'a1')).toBe('#123456')
    expect(getResolvedColor(tree, 'a')).toBe('#123456')
  })

  it('lets a descendant override the inherited color', () => {
    let tree = createTree('Root')
    tree = addChild(tree, ROOT_ID, { label: 'A', grow: 90, id: 'a', color: '#123456' })
    tree = addChild(tree, 'a', { label: 'A1', grow: 90, id: 'a1' })
    tree = recolorNode(tree, 'a1', '#abcdef')
    expect(getResolvedColor(tree, 'a1')).toBe('#abcdef')
  })

  it('removes a node and its subtree', () => {
    let tree = createTree('Root')
    tree = addChild(tree, ROOT_ID, { label: 'A', grow: 90, id: 'a' })
    tree = addChild(tree, 'a', { label: 'A1', grow: 90, id: 'a1' })
    tree = removeNode(tree, 'a')
    expect(tree.root.children).toHaveLength(0)
  })

  it('refuses to remove the root', () => {
    const tree = createTree('Root')
    expect(() => removeNode(tree, ROOT_ID)).toThrow()
  })

  it('relabels a node without touching its siblings', () => {
    let tree = createTree('Root')
    tree = addChild(tree, ROOT_ID, { label: 'A', grow: 90, id: 'a' })
    tree = addChild(tree, ROOT_ID, { label: 'B', grow: 270, id: 'b' })
    tree = relabelNode(tree, 'a', 'A renamed')
    expect(tree.root.children[0].label).toBe('A renamed')
    expect(tree.root.children[1].label).toBe('B')
  })

  it('moves a node to a new angle/distance', () => {
    let tree = createTree('Root')
    tree = addChild(tree, ROOT_ID, { label: 'A', grow: 90, id: 'a' })
    tree = moveNode(tree, 'a', { grow: 45, distance: 6 })
    expect(tree.root.children[0]).toMatchObject({ grow: 45, distance: 6 })
  })

  it('lists occupied child angles for anti-overlap snapping', () => {
    let tree = createTree('Root')
    tree = addChild(tree, ROOT_ID, { label: 'A', grow: 90, id: 'a' })
    tree = addChild(tree, ROOT_ID, { label: 'B', grow: 210, id: 'b' })
    expect(listChildAngles(tree, ROOT_ID).sort((a, b) => a - b)).toEqual([90, 210])
  })
})
