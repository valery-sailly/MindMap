// Arbre -> code TikZ mindmap, strictement conforme à ./grammar.md.
// Déterministe : la même MindmapTree produit toujours exactement le même texte.
//
// v2 : n'utilise plus le style `concept` de tikz mindmap (voir grammar.md § Historique) —
// vérifié par compilation réelle que `concept` ignore `draw=`/`fill=`/`text=` et ne peut pas être
// personnalisé. `mindmap` ne sert plus qu'au positionnement (`grow=<angle>:1`), l'apparence est
// entièrement pilotée par des clés PGF/TikZ standard, toutes vérifiées par compilation.

import {
  DEFAULT_ROOT_COLOR_NAME,
  KNOWN_COLOR_NAMES,
  type MindmapNode,
  type MindmapStyle,
  type MindmapTree,
  defaultDistanceForDepth,
  getResolvedColor,
} from '../model/tree'

export const BEGIN_MARKER = '% MINDMAP:BEGIN'
export const END_MARKER = '% MINDMAP:END'

const INDENT = '  '

/**
 * Options de `\begin{tikzpicture}[...]` par préset de style — seule chose qui varie entre les
 * deux styles, vérifiées par compilation réelle (pdflatex). `parse.ts` doit reconnaître
 * exactement ces deux chaînes pour restaurer `tree.style` à l'import.
 *
 * `edge from parent path=...` remplace le connecteur organique par défaut de `mindmap` par un
 * simple segment droit — un enfant peut ensuite recolorer SON lien via
 * `edge from parent/.style={draw=<couleur>, thin}` dans ses propres options `child[...]`.
 */
export const TIKZ_HEADER_OPTIONS: Record<MindmapStyle, string> = {
  fancy:
    'mindmap, every node/.style={rectangle, rounded corners=3pt, align=center, inner sep=6pt, ' +
    'thin, draw=black, fill=white, font=\\sffamily}, ' +
    'every child/.style={edge from parent path={(\\tikzparentnode) -- (\\tikzchildnode)}, ' +
    'edge from parent/.style={draw, thin, black}}',
  simple:
    'mindmap, every node/.style={align=center, font=\\sffamily}, ' +
    'every child/.style={edge from parent path={(\\tikzparentnode) -- (\\tikzchildnode)}, ' +
    'edge from parent/.style={draw, thin, black}}',
}

/** Erreur levée quand l'arbre référence une couleur hors du sous-ensemble supporté (voir grammar.md). */
export class GenerateError extends Error {}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const match = /^#?([0-9a-fA-F]{6})$/.exec(hex)
  if (!match) throw new GenerateError(`Couleur personnalisée invalide (attendu #rrggbb) : ${hex}`)
  const value = match[1]
  return {
    r: Number.parseInt(value.slice(0, 2), 16),
    g: Number.parseInt(value.slice(2, 4), 16),
    b: Number.parseInt(value.slice(4, 6), 16),
  }
}

function renderPreambleColors(tree: MindmapTree): string[] {
  return Object.entries(tree.palette).map(([name, hex]) => {
    const { r, g, b } = hexToRgb(hex)
    return `\\definecolor{${name}}{RGB}{${r},${g},${b}}`
  })
}

function assertKnownColor(tree: MindmapTree, color: string): void {
  if (KNOWN_COLOR_NAMES.has(color) || color in tree.palette) return
  throw new GenerateError(
    `Couleur "${color}" non reconnue : ni dans la palette xcolor de base, ni déclarée via \\definecolor.`,
  )
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

/**
 * Échappe un label utilisateur en texte LaTeX brut ; les retours à la ligne deviennent `\\`.
 * Inverse exact de `unescapeLabel` (./parse.ts) — pas d'espaces de padding autour de `\\` pour
 * garantir un round-trip parse(generate(x)) === x sur le texte du label.
 */
export function escapeLabel(label: string): string {
  const escaped = label
    .replace(/\\/g, '\\textbackslash{}')
    .replace(/([&%$#_{}])/g, '\\$1')
    .replace(/~/g, '\\textasciitilde{}')
    .replace(/\^/g, '\\textasciicircum{}')
  return escaped.split('\n').join('\\\\')
}

function renderChild(tree: MindmapTree, node: MindmapNode, depth: number): string[] {
  if (node.grow === null || node.distance === null) {
    throw new GenerateError(`Le nœud "${node.label}" n'a pas de position (grow/distance manquants).`)
  }
  const resolvedColor = getResolvedColor(tree, node.id) ?? DEFAULT_ROOT_COLOR_NAME
  if (resolvedColor !== DEFAULT_ROOT_COLOR_NAME) assertKnownColor(tree, resolvedColor)
  const hasColor = resolvedColor !== DEFAULT_ROOT_COLOR_NAME

  const childOpts: string[] = [`grow=${formatNumber(node.grow)}:1`]
  if (node.distance !== defaultDistanceForDepth(depth)) {
    childOpts.push(`level distance=${node.distance.toFixed(1)}cm`)
  }
  if (hasColor) childOpts.push(`edge from parent/.style={draw=${resolvedColor}, thin}`)

  const nodeOpts: string[] = []
  if (hasColor && tree.style === 'fancy') nodeOpts.push(`draw=${resolvedColor}`)
  if (node.textColor !== null) {
    assertKnownColor(tree, node.textColor)
    nodeOpts.push(`text=${node.textColor}`)
  }
  const nodeOptsStr = nodeOpts.length > 0 ? `[${nodeOpts.join(', ')}]` : ''

  const indent = INDENT.repeat(depth)
  const lines = [
    `${indent}child[${childOpts.join(', ')}]{`,
    `${indent}${INDENT}node${nodeOptsStr} {${escapeLabel(node.label)}}`,
  ]
  for (const grandchild of node.children) {
    lines.push(...renderChild(tree, grandchild, depth + 1))
  }
  lines.push(`${indent}}`)
  return lines
}

export function generateTikz(tree: MindmapTree): string {
  const preamble = renderPreambleColors(tree)
  const rootOpts: string[] = []
  if (tree.root.textColor !== null) {
    assertKnownColor(tree, tree.root.textColor)
    rootOpts.push(`text=${tree.root.textColor}`)
  }
  const rootOptsStr = rootOpts.length > 0 ? `[${rootOpts.join(', ')}]` : ''

  const bodyLines = [
    `\\begin{tikzpicture}[${TIKZ_HEADER_OPTIONS[tree.style]}]`,
    `\\node${rootOptsStr} (root) {${escapeLabel(tree.root.label)}}`,
    ...tree.root.children.flatMap((child) => renderChild(tree, child, 1)),
  ]
  // Le point-virgule final ferme la dernière commande \node/child imbriquée.
  bodyLines[bodyLines.length - 1] += ';'
  bodyLines.push('\\end{tikzpicture}')

  // adjustbox contraint à LA FOIS la largeur et la hauteur (contrairement à \resizebox{\linewidth}{!}
  // qui ne contraint que la largeur et peut déborder sur une deuxième page pour un arbre asymétrique
  // très étendu verticalement — vérifié par compilation réelle). Nécessite \usepackage{adjustbox}.
  const boxed = [
    '\\begin{adjustbox}{max width=\\linewidth, max totalheight=0.85\\textheight, center}',
    ...bodyLines,
    '\\end{adjustbox}',
  ]

  return [BEGIN_MARKER, ...preamble, ...boxed, END_MARKER].join('\n')
}
