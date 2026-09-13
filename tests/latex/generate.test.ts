import { describe, expect, it } from 'vitest'
import { addChild, createTree, defineColor, recolorNode, ROOT_ID, setStyle, setTextColor } from '../../src/model/tree'
import { BEGIN_MARKER, END_MARKER, GenerateError, TIKZ_HEADER_OPTIONS, escapeLabel, generateTikz } from '../../src/latex/generate'

describe('latex/generate', () => {
  it('wraps output with the round-trip markers', () => {
    const tree = createTree('Root')
    const tex = generateTikz(tree)
    expect(tex.startsWith(BEGIN_MARKER)).toBe(true)
    expect(tex.endsWith(END_MARKER)).toBe(true)
  })

  it('renders a lone root with no options (no color chosen)', () => {
    const tree = createTree('Root')
    const tex = generateTikz(tree)
    expect(tex).toContain('\\node (root) {Root};')
  })

  it('renders a colored child with a matching edge and node draw color, omitting default distance', () => {
    let tree = createTree('Root')
    tree = addChild(tree, ROOT_ID, { label: 'Branch A', grow: 90, id: 'a', color: 'teal' })
    const tex = generateTikz(tree)
    expect(tex).toContain('child[grow=90:1, edge from parent/.style={draw=teal, thin}]{')
    expect(tex).toContain('node[draw=teal] {Branch A}')
    expect(tex).not.toContain('level distance')
  })

  it('includes level distance only when it differs from the depth default', () => {
    let tree = createTree('Root')
    tree = addChild(tree, ROOT_ID, { label: 'A', grow: 90, id: 'a', color: 'teal', distance: 5 })
    const tex = generateTikz(tree)
    expect(tex).toContain('level distance=5.0cm')
  })

  it('propagates a resolved color explicitly to an inheriting descendant (no tikz-side cascading)', () => {
    let tree = createTree('Root')
    tree = addChild(tree, ROOT_ID, { label: 'A', grow: 90, id: 'a', color: 'teal' })
    tree = addChild(tree, 'a', { label: 'A1', grow: 90, id: 'a1' })
    const tex = generateTikz(tree)
    const a1Line = tex.split('\n').find((l) => l.includes('A1'))
    expect(a1Line).toContain('node[draw=teal] {A1}')
    const childLines = tex.split('\n').filter((l) => l.trim().startsWith('child['))
    expect(childLines.every((l) => l.includes('draw=teal'))).toBe(true)
  })

  it('omits color options entirely for a node with no color in its ancestry', () => {
    let tree = createTree('Root')
    tree = addChild(tree, ROOT_ID, { label: 'A', grow: 90, id: 'a' })
    const tex = generateTikz(tree)
    expect(tex).toContain('child[grow=90:1]{')
    expect(tex).toContain('node {A}')
  })

  it('emits \\definecolor lines for palette colors and references them by name', () => {
    let tree = createTree('Root')
    tree = defineColor(tree, 'customBlue', '#1a2b3c')
    tree = addChild(tree, ROOT_ID, { label: 'A', grow: 0, id: 'a', color: 'customBlue' })
    const tex = generateTikz(tree)
    expect(tex).toContain('\\definecolor{customBlue}{RGB}{26,43,60}')
    expect(tex).toContain('draw=customBlue, thin}]{')
    expect(tex).toContain('node[draw=customBlue] {A}')
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

  it('recoloring a child updates both its edge and its own draw color', () => {
    let tree = createTree('Root')
    tree = addChild(tree, ROOT_ID, { label: 'A', grow: 90, id: 'a', color: 'teal' })
    tree = recolorNode(tree, 'a', 'blue')
    const tex = generateTikz(tree)
    expect(tex).toContain('draw=blue, thin}]{')
    expect(tex).toContain('node[draw=blue] {A}')
  })

  it('draw= is never emitted in simple style, even for a colored branch (no box to color)', () => {
    let tree = createTree('Root')
    tree = setStyle(tree, 'simple')
    tree = addChild(tree, ROOT_ID, { label: 'A', grow: 90, id: 'a', color: 'teal' })
    const tex = generateTikz(tree)
    expect(tex).toContain('edge from parent/.style={draw=teal, thin}')
    expect(tex).not.toContain('node[draw=')
    expect(tex).toContain('node {A}')
  })

  it('adds a text= option on a child node with an explicit text color, after draw=', () => {
    let tree = createTree('Root')
    tree = addChild(tree, ROOT_ID, { label: 'A', grow: 90, id: 'a', color: 'orange' })
    tree = setTextColor(tree, 'a', 'black')
    const tex = generateTikz(tree)
    expect(tex).toContain('node[draw=orange, text=black] {A}')
  })

  it('adds a text= option on the root node', () => {
    let tree = createTree('Root')
    tree = setTextColor(tree, ROOT_ID, 'yellow')
    const tex = generateTikz(tree)
    expect(tex).toContain('\\node[text=yellow] (root) {Root};')
  })

  it('omits a per-node text= override when none is set', () => {
    let tree = createTree('Root')
    tree = addChild(tree, ROOT_ID, { label: 'A', grow: 90, id: 'a' })
    const tex = generateTikz(tree)
    expect(tex).not.toContain('text=')
  })

  it('rejects an unknown text color', () => {
    let tree = createTree('Root')
    tree = addChild(tree, ROOT_ID, { label: 'A', grow: 90, id: 'a' })
    tree = setTextColor(tree, 'a', 'not-a-real-color')
    expect(() => generateTikz(tree)).toThrow(GenerateError)
  })

  it('uses the fancy tikzpicture header by default', () => {
    const tree = createTree('Root')
    const tex = generateTikz(tree)
    expect(tex).toContain(`\\begin{tikzpicture}[${TIKZ_HEADER_OPTIONS.fancy}]`)
  })

  it('switches to the simple tikzpicture header', () => {
    let tree = createTree('Root')
    tree = setStyle(tree, 'simple')
    const tex = generateTikz(tree)
    expect(tex).toContain(`\\begin{tikzpicture}[${TIKZ_HEADER_OPTIONS.simple}]`)
  })
})
