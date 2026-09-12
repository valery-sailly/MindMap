import { describe, expect, it } from 'vitest'
import { addChild, createTree, defineColor, recolorNode, ROOT_ID } from '../../src/model/tree'
import { BEGIN_MARKER, END_MARKER, GenerateError, escapeLabel, generateTikz } from '../../src/latex/generate'

describe('latex/generate', () => {
  it('wraps output with the round-trip markers', () => {
    const tree = createTree('Root')
    const tex = generateTikz(tree)
    expect(tex.startsWith(BEGIN_MARKER)).toBe(true)
    expect(tex.endsWith(END_MARKER)).toBe(true)
  })

  it('renders a lone root as a single terminated node', () => {
    const tree = createTree('Root')
    const tex = generateTikz(tree)
    expect(tex).toContain('\\node[concept, root concept] (root) {Root};')
  })

  it('renders a child with an explicit color and omits the default-distance option', () => {
    let tree = createTree('Root')
    tree = addChild(tree, ROOT_ID, { label: 'Branch A', grow: 90, id: 'a', color: 'teal' })
    const tex = generateTikz(tree)
    expect(tex).toContain('child[concept color=teal, grow=90:1]{')
    expect(tex).toContain('node[concept] {Branch A}')
    expect(tex).not.toContain('level distance')
  })

  it('includes level distance only when it differs from the depth default', () => {
    let tree = createTree('Root')
    tree = addChild(tree, ROOT_ID, { label: 'A', grow: 90, id: 'a', color: 'teal', distance: 5 })
    const tex = generateTikz(tree)
    expect(tex).toContain('level distance=5.0cm')
  })

  it('omits concept color on a child that inherits from its ancestor', () => {
    let tree = createTree('Root')
    tree = addChild(tree, ROOT_ID, { label: 'A', grow: 90, id: 'a', color: 'teal' })
    tree = addChild(tree, 'a', { label: 'A1', grow: 90, id: 'a1' })
    const tex = generateTikz(tree)
    const a1Line = tex.split('\n').find((l) => l.includes('A1'))
    expect(a1Line).toContain('node[concept] {A1}')
    const childBlockForA1 = tex.split('\n').find((l) => l.includes('grow=90:1') && l.includes('child['))
    expect(tex.match(/concept color=/g)?.length).toBe(1)
    expect(childBlockForA1).toBeDefined()
  })

  it('emits \\definecolor lines for palette colors', () => {
    let tree = createTree('Root')
    tree = defineColor(tree, 'customBlue', '#1a2b3c')
    tree = addChild(tree, ROOT_ID, { label: 'A', grow: 0, id: 'a', color: 'customBlue' })
    const tex = generateTikz(tree)
    expect(tex).toContain('\\definecolor{customBlue}{RGB}{26,43,60}')
    expect(tex).toContain('concept color=customBlue')
  })

  it('rejects an unknown color not in the palette (no silent fallback)', () => {
    let tree = createTree('Root')
    tree = addChild(tree, ROOT_ID, { label: 'A', grow: 0, id: 'a', color: 'not-a-real-color' })
    expect(() => generateTikz(tree)).toThrow(GenerateError)
  })

  it('rejects a node missing grow/distance (unplaced node)', () => {
    let tree = createTree('Root')
    tree = addChild(tree, ROOT_ID, { label: 'A', grow: 0, id: 'a' })
    // simulate an unplaced node bypassing addChild's defaults
    tree = { ...tree, root: { ...tree.root, children: [{ ...tree.root.children[0], grow: null }] } }
    expect(() => generateTikz(tree)).toThrow(GenerateError)
  })

  it('escapes LaTeX special characters and newlines in labels', () => {
    expect(escapeLabel('50% du budget & risques')).toBe('50\\% du budget \\& risques')
    expect(escapeLabel('ligne 1\nligne 2')).toBe('ligne 1\\\\ligne 2')
  })

  it('recoloring only the child keeps grandchildren inherited', () => {
    let tree = createTree('Root')
    tree = addChild(tree, ROOT_ID, { label: 'A', grow: 90, id: 'a', color: 'teal' })
    tree = recolorNode(tree, 'a', 'blue')
    const tex = generateTikz(tree)
    expect(tex).toContain('concept color=blue')
  })
})
