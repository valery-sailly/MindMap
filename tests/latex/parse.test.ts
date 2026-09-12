import { describe, expect, it } from 'vitest'
import { addChild, createTree, defineColor, ROOT_ID } from '../../src/model/tree'
import { generateTikz } from '../../src/latex/generate'
import { AmbiguousBlockError, BlockNotFoundError, parseDocument } from '../../src/latex/parse'
import { ParseError } from '../../src/latex/tokenizer'

describe('latex/parse', () => {
  it('parses a lone root back to the same label', () => {
    const tree = createTree('Root')
    const tex = generateTikz(tree)
    const parsed = parseDocument(tex)
    expect(parsed.tree.root.label).toBe('Root')
    expect(parsed.tree.root.children).toHaveLength(0)
    expect(parsed.hadMarkers).toBe(true)
  })

  it('round-trips a multi-level tree with colors and custom distance', () => {
    let tree = createTree('Projet')
    tree = addChild(tree, ROOT_ID, { label: 'Accueil', grow: 90, id: 'accueil', color: 'teal', distance: 5 })
    tree = addChild(tree, 'accueil', { label: 'Gynécologie', grow: 70, id: 'gyneco' })
    tree = addChild(tree, ROOT_ID, { label: 'Blog', grow: 210, id: 'blog', color: 'violet' })

    const tex = generateTikz(tree)
    const parsed = parseDocument(tex)

    expect(parsed.tree.root.label).toBe('Projet')
    expect(parsed.tree.root.children).toHaveLength(2)
    const accueil = parsed.tree.root.children[0]
    expect(accueil).toMatchObject({ label: 'Accueil', grow: 90, distance: 5, color: 'teal' })
    expect(accueil.children[0]).toMatchObject({ label: 'Gynécologie', grow: 70, color: null })
    expect(parsed.tree.root.children[1]).toMatchObject({ label: 'Blog', grow: 210, color: 'violet' })

    // Round-trip complet : regénérer l'arbre reparsé doit produire un texte identique.
    expect(generateTikz(parsed.tree)).toBe(tex)
  })

  it('round-trips custom \\definecolor palette entries', () => {
    let tree = createTree('Root')
    tree = defineColor(tree, 'customBlue', '#1a2b3c')
    tree = addChild(tree, ROOT_ID, { label: 'A', grow: 0, id: 'a', color: 'customBlue' })
    const tex = generateTikz(tree)
    const parsed = parseDocument(tex)
    expect(parsed.tree.palette.customBlue).toBe('#1a2b3c')
    expect(parsed.tree.root.children[0].color).toBe('customBlue')
    expect(generateTikz(parsed.tree)).toBe(tex)
  })

  it('round-trips escaped special characters and newlines in labels', () => {
    let tree = createTree('50% du budget & risques')
    tree = addChild(tree, ROOT_ID, { label: 'ligne 1\nligne 2 (test) #1', grow: 45, id: 'a' })
    const tex = generateTikz(tree)
    const parsed = parseDocument(tex)
    expect(parsed.tree.root.label).toBe('50% du budget & risques')
    expect(parsed.tree.root.children[0].label).toBe('ligne 1\nligne 2 (test) #1')
  })

  it('parses a hand-written .tex without markers and without the resizebox wrapper', () => {
    const handWritten = [
      'Some intro text.',
      '',
      '\\begin{tikzpicture}[mindmap, every node/.style={concept, align=center}]',
      '\\node[concept, root concept] (root) {Root}',
      '  child[concept color=blue, grow=45:1]{',
      '    node[concept] {A}',
      '  };',
      '\\end{tikzpicture}',
      '',
      'Some trailing text.',
    ].join('\n')
    const parsed = parseDocument(handWritten)
    expect(parsed.hadMarkers).toBe(false)
    expect(parsed.tree.root.children[0]).toMatchObject({ label: 'A', color: 'blue' })
    expect(parsed.prefix).toContain('Some intro text.')
    expect(parsed.suffix).toContain('Some trailing text.')
  })

  it('preserves prefix/suffix bytes exactly when markers are present', () => {
    const tree = createTree('Root')
    const tex = generateTikz(tree)
    const wrapped = `\\documentclass{article}\n\\begin{document}\n${tex}\n\\end{document}\n`
    const parsed = parseDocument(wrapped)
    expect(parsed.prefix).toBe('\\documentclass{article}\n\\begin{document}\n')
    expect(parsed.suffix).toBe('\n\\end{document}\n')
  })

  it('rejects grow cyclic with a clear error, no silent fallback', () => {
    const source = [
      '\\begin{tikzpicture}[mindmap, every node/.style={concept, align=center}]',
      '\\node[concept, root concept] (root) {Root}',
      '  child[concept color=blue, grow cyclic]{',
      '    node[concept] {A}',
      '  };',
      '\\end{tikzpicture}',
    ].join('\n')
    expect(() => parseDocument(source)).toThrow(ParseError)
  })

  it('rejects an unsupported macro inside a label', () => {
    const source = [
      '\\begin{tikzpicture}[mindmap, every node/.style={concept, align=center}]',
      '\\node[concept, root concept] (root) {Root \\alpha}',
      '  ;',
      '\\end{tikzpicture}',
    ].join('\n')
    expect(() => parseDocument(source)).toThrow(ParseError)
  })

  it('rejects an unknown color', () => {
    const source = [
      '\\begin{tikzpicture}[mindmap, every node/.style={concept, align=center}]',
      '\\node[concept, root concept] (root) {Root}',
      '  child[concept color=notacolor, grow=0:1]{',
      '    node[concept] {A}',
      '  };',
      '\\end{tikzpicture}',
    ].join('\n')
    expect(() => parseDocument(source)).toThrow(ParseError)
  })

  it('throws BlockNotFoundError when there is no mindmap tikzpicture', () => {
    expect(() => parseDocument('\\documentclass{article}\n\\begin{document}\nhello\n\\end{document}')).toThrow(
      BlockNotFoundError,
    )
  })

  it('throws AmbiguousBlockError when several mindmap blocks exist without markers', () => {
    const one = [
      '\\begin{tikzpicture}[mindmap]',
      '\\node[concept, root concept] (root) {A};',
      '\\end{tikzpicture}',
    ].join('\n')
    const source = `${one}\n\n${one}`
    expect(() => parseDocument(source)).toThrow(AmbiguousBlockError)
  })
})
