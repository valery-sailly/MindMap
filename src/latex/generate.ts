// Arbre -> code TikZ mindmap, strictement conforme à ./grammar.md.
// Déterministe : la même MindmapTree produit toujours exactement le même texte.

import {
  DEFAULT_ROOT_COLOR_NAME,
  KNOWN_COLOR_NAMES,
  type MindmapNode,
  type MindmapStyle,
  type MindmapTree,
  defaultDistanceForDepth,
  defaultTextColorForStyle,
} from '../model/tree'

export const BEGIN_MARKER = '% MINDMAP:BEGIN'
export const END_MARKER = '% MINDMAP:END'

const INDENT = '  '

/**
 * Options de `\begin{tikzpicture}[...]` par préset de style — seule chose qui varie entre les
 * deux styles. Le reste (child/node/grow/couleurs) est strictement identique, voir grammar.md.
 * `parse.ts` doit reconnaître exactement ces deux chaînes pour restaurer `tree.style` à l'import.
 *
 * Épuré et monochrome par défaut dans les deux cas (`concept color=black, text=black`) — la
 * couleur reste toujours disponible par nœud (`concept color=`/`text=` explicites), simplement
 * pas activée tant que l'utilisateur ne la choisit pas. Seule différence entre les styles :
 * `fancy` dessine une case (rectangle à coins arrondis, bordure fine) autour de chaque nœud,
 * `simple` n'affiche que le texte, sans aucune case.
 *
 * `concept color=<défaut>` et `text=<défaut>` sont fixés ici au niveau du tikzpicture (pas
 * seulement par nœud) : sans ça, un nœud sans couleur explicite — typiquement la racine — n'a
 * aucune valeur définie pour "concept color", et certains moteurs de rendu retombent alors
 * silencieusement sur du noir au lieu de lever une erreur claire. Toujours définir un défaut au
 * niveau de l'image entière est le patron documenté par la bibliothèque mindmap elle-même.
 */
export const TIKZ_HEADER_OPTIONS: Record<MindmapStyle, string> = {
  fancy:
    `mindmap, concept color=${DEFAULT_ROOT_COLOR_NAME}, text=${defaultTextColorForStyle('fancy')}, ` +
    'every node/.style={concept, rectangle, rounded corners=3pt, align=center, inner sep=6pt, ' +
    'thin, draw=concept color, fill=white, font=\\sffamily}',
  simple:
    `mindmap, concept color=${DEFAULT_ROOT_COLOR_NAME}, text=${defaultTextColorForStyle('simple')}, ` +
    'every node/.style={concept, align=center, inner sep=2pt, draw=none, fill=none, font=\\sffamily}',
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
  const options: string[] = []
  if (node.color !== null) {
    assertKnownColor(tree, node.color)
    options.push(`concept color=${node.color}`)
  }
  options.push(`grow=${formatNumber(node.grow)}:1`)
  if (node.distance !== defaultDistanceForDepth(depth)) {
    options.push(`level distance=${node.distance.toFixed(1)}cm`)
  }

  const nodeOpts = ['concept']
  if (node.textColor !== null) {
    assertKnownColor(tree, node.textColor)
    nodeOpts.push(`text=${node.textColor}`)
  }

  const indent = INDENT.repeat(depth)
  const lines = [
    `${indent}child[${options.join(', ')}]{`,
    `${indent}${INDENT}node[${nodeOpts.join(', ')}] {${escapeLabel(node.label)}}`,
  ]
  for (const grandchild of node.children) {
    lines.push(...renderChild(tree, grandchild, depth + 1))
  }
  lines.push(`${indent}}`)
  return lines
}

export function generateTikz(tree: MindmapTree): string {
  const preamble = renderPreambleColors(tree)
  const rootOpts = ['concept', 'root concept']
  if (tree.root.textColor !== null) {
    assertKnownColor(tree, tree.root.textColor)
    rootOpts.push(`text=${tree.root.textColor}`)
  }
  const bodyLines = [
    `\\begin{tikzpicture}[${TIKZ_HEADER_OPTIONS[tree.style]}]`,
    `\\node[${rootOpts.join(', ')}] (root) {${escapeLabel(tree.root.label)}}`,
    ...tree.root.children.flatMap((child) => renderChild(tree, child, 1)),
  ]
  // Le point-virgule final ferme la dernière commande \node/child imbriquée.
  bodyLines[bodyLines.length - 1] += ';'
  bodyLines.push('\\end{tikzpicture}')

  // \resizebox fait tenir le diagramme sur une page paysage ou une slide beamer quelle que soit
  // sa taille naturelle, sans avoir à calculer nous-mêmes sa bounding box (nécessite \usepackage{graphicx}).
  const resized = ['\\resizebox{\\linewidth}{!}{%', ...bodyLines, '}%']

  return [BEGIN_MARKER, ...preamble, ...resized, END_MARKER].join('\n')
}
