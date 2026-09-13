// Tex -> arbre, strictement conforme à ./grammar.md. Toute construction hors du sous-ensemble
// documenté échoue avec une erreur explicite (jamais de best-effort silencieux).
//
// v2 : plus de "concept"/"concept color" (voir grammar.md § Historique) — la couleur d'un nœud se
// lit sur `edge from parent/.style={draw=<couleur>, thin}` (présent dans les deux styles) et,
// en style fancy uniquement, sur `draw=<couleur>` du node lui-même (doit alors concorder).

import {
  KNOWN_COLOR_NAMES,
  type MindmapStyle,
  type MindmapTree,
  ROOT_ID,
  addChild,
  createTree,
  defaultDistanceForDepth,
  defineColor,
  findNode,
  setTextColor,
} from '../model/tree'
import { BEGIN_MARKER, END_MARKER, TIKZ_HEADER_OPTIONS } from './generate'
import { ParseError, Scanner } from './tokenizer'

function normalizeOptions(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim()
}

function detectStyle(headerOpts: string): MindmapStyle {
  const normalized = normalizeOptions(headerOpts)
  const match = (Object.keys(TIKZ_HEADER_OPTIONS) as MindmapStyle[]).find(
    (style) => normalizeOptions(TIKZ_HEADER_OPTIONS[style]) === normalized,
  )
  return match ?? 'fancy'
}

/** Découpe une liste d'options `a, b={c, d}, e` sur les virgules de premier niveau uniquement. */
function splitTopLevelOptions(raw: string): string[] {
  const parts: string[] = []
  let depth = 0
  let current = ''
  for (const ch of raw) {
    if (ch === '{') depth += 1
    else if (ch === '}') depth -= 1
    if (ch === ',' && depth === 0) {
      parts.push(current.trim())
      current = ''
    } else {
      current += ch
    }
  }
  if (current.trim()) parts.push(current.trim())
  return parts
}

export class BlockNotFoundError extends Error {}

export class AmbiguousBlockError extends Error {
  readonly candidates: Array<{ index: number; preview: string }>

  constructor(candidates: Array<{ index: number; preview: string }>) {
    super(`Plusieurs blocs tikzpicture[mindmap] trouvés (${candidates.length}) : choix requis.`)
    this.candidates = candidates
  }
}

export interface ParsedDocument {
  tree: MindmapTree
  /** Texte avant le bloc reconnu, à préserver tel quel lors d'une réécriture. */
  prefix: string
  /** Texte après le bloc reconnu, à préserver tel quel lors d'une réécriture. */
  suffix: string
  /** true si le fichier source utilisait déjà les marqueurs `% MINDMAP:BEGIN/END`. */
  hadMarkers: boolean
}

const DEFINE_COLOR_RE = /^[ \t]*\\definecolor\{([A-Za-z][A-Za-z0-9]*)\}\{RGB\}\{\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\}[ \t]*$/

function toHex(r: string, g: string, b: string): string {
  const clamp = (n: string) => Math.min(255, Math.max(0, Number.parseInt(n, 10)))
  const hex = (n: number) => n.toString(16).padStart(2, '0')
  return `#${hex(clamp(r))}${hex(clamp(g))}${hex(clamp(b))}`
}

/** Localise le bloc mindmap dans un document plus large. Voir grammar.md pour la stratégie. */
function locateBlock(source: string): { prefix: string; block: string; suffix: string; hadMarkers: boolean } {
  const beginIdx = source.indexOf(BEGIN_MARKER)
  const endIdx = source.indexOf(END_MARKER)
  if (beginIdx !== -1 && endIdx !== -1 && endIdx > beginIdx) {
    return {
      prefix: source.slice(0, beginIdx),
      block: source.slice(beginIdx + BEGIN_MARKER.length, endIdx),
      suffix: source.slice(endIdx + END_MARKER.length),
      hadMarkers: true,
    }
  }

  const beginTikz = /\\begin\{tikzpicture\}(\s*\[[^\n]*?mindmap[^\n]*?\])?/g
  const candidates: Array<{ start: number; optsOk: boolean }> = []
  let match: RegExpExecArray | null
  while ((match = beginTikz.exec(source))) {
    candidates.push({ start: match.index, optsOk: Boolean(match[1]) })
  }
  const valid = candidates.filter((c) => c.optsOk)
  if (valid.length === 0) {
    throw new BlockNotFoundError('Aucun \\begin{tikzpicture}[mindmap, ...] trouvé dans le document.')
  }
  if (valid.length > 1) {
    throw new AmbiguousBlockError(
      valid.map((c) => ({ index: c.start, preview: source.slice(c.start, c.start + 60) })),
    )
  }

  const tikzStart = valid[0].start
  const endTikzLiteral = '\\end{tikzpicture}'
  const endTikzIdx = source.indexOf(endTikzLiteral, tikzStart)
  if (endTikzIdx === -1) throw new BlockNotFoundError('\\end{tikzpicture} introuvable.')
  const afterTikz = endTikzIdx + endTikzLiteral.length

  // Inclut un éventuel enrobage (\begin{adjustbox}{...} ou \resizebox{...}{...}{) déjà présent
  // autour du tikzpicture.
  let blockStart = tikzStart
  const beforeTikz = source.slice(0, tikzStart)
  const adjustboxMatch = /\\begin\{adjustbox\}\{[^}]*\}\s*$/.exec(beforeTikz)
  const resizeMatch = adjustboxMatch ? null : /\\resizebox\{[^}]*\}\{[^}]*\}\{%?\s*$/.exec(beforeTikz)
  if (adjustboxMatch) blockStart = adjustboxMatch.index
  else if (resizeMatch) blockStart = resizeMatch.index

  let blockEnd = afterTikz
  const afterTikzText = source.slice(afterTikz)
  if (adjustboxMatch) {
    const closingMatch = /^\s*\\end\{adjustbox\}/.exec(afterTikzText)
    if (closingMatch) blockEnd = afterTikz + closingMatch[0].length
  } else if (resizeMatch) {
    const closingMatch = /^\s*\}%?/.exec(afterTikzText)
    if (closingMatch) blockEnd = afterTikz + closingMatch[0].length
  }

  // Remonte au-delà des lignes \definecolor contiguës qui précèdent immédiatement le bloc.
  const linesBefore = source.slice(0, blockStart).split('\n')
  let firstBlockLine = linesBefore.length - 1
  while (firstBlockLine > 0) {
    const candidateLine = linesBefore[firstBlockLine - 1]
    if (DEFINE_COLOR_RE.test(candidateLine) || candidateLine.trim() === '') {
      firstBlockLine -= 1
    } else break
  }
  const prefixLines = linesBefore.slice(0, firstBlockLine)
  const prefix = prefixLines.length > 0 ? `${prefixLines.join('\n')}\n` : ''
  const block = source.slice(prefix.length, blockEnd)
  const suffix = source.slice(blockEnd)

  return { prefix, block, suffix, hadMarkers: false }
}

interface BlockContent {
  palette: Record<string, string>
  tikzSource: string
}

function extractPalette(block: string): BlockContent {
  const lines = block.split('\n')
  const palette: Record<string, string> = {}
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (line.trim() === '') {
      i += 1
      continue
    }
    const m = DEFINE_COLOR_RE.exec(line)
    if (!m) break
    palette[m[1]] = toHex(m[2], m[3], m[4])
    i += 1
  }

  let bodyLines = lines.slice(i)
  while (bodyLines.length > 0 && bodyLines[0].trim() === '') bodyLines = bodyLines.slice(1)
  while (bodyLines.length > 0 && bodyLines[bodyLines.length - 1].trim() === '') bodyLines = bodyLines.slice(0, -1)

  // Retire un enrobage toujours émis par generate.ts (facultatif à l'analyse) : \begin{adjustbox}
  // (v2, contraint largeur ET hauteur) ou \resizebox (v1, largeur seule — encore accepté en lecture
  // pour les documents déjà exportés avant ce changement).
  const first = bodyLines[0]?.trim()
  if (first && /^\\begin\{adjustbox\}\{.*\}$/.test(first)) {
    bodyLines = bodyLines.slice(1)
    const last = bodyLines[bodyLines.length - 1]?.trim()
    if (last === '\\end{adjustbox}') bodyLines = bodyLines.slice(0, -1)
  } else if (first && /^\\resizebox\{[^}]*\}\{[^}]*\}\{%?$/.test(first)) {
    bodyLines = bodyLines.slice(1)
    const last = bodyLines[bodyLines.length - 1]?.trim()
    if (last === '}%' || last === '}') bodyLines = bodyLines.slice(0, -1)
  }

  return { palette, tikzSource: bodyLines.join('\n') }
}

interface ChildOptions {
  color: string | null
  grow: number
  distance: number | null
}

function assertKnownColor(scanner: Scanner, groupStart: number, color: string, palette: Record<string, string>): void {
  if (KNOWN_COLOR_NAMES.has(color) || color in palette) return
  scanner.error(
    `Couleur "${color}" inconnue : ni palette xcolor de base, ni déclarée via \\definecolor.`,
    groupStart,
  )
}

/** Extrait le contenu `{...}` d'une option `<prefix>{...}` déjà isolée par splitTopLevelOptions. */
function extractBraceValue(part: string, prefix: string, scanner: Scanner, groupStart: number): string {
  const rest = part.slice(prefix.length).trim()
  const match = /^\{(.*)\}$/.exec(rest)
  if (!match) scanner.error(`Valeur invalide pour "${prefix}" : attendu "{...}"`, groupStart)
  return match![1]
}

function parseEdgeStyleColor(value: string, scanner: Scanner, groupStart: number): string {
  const parts = splitTopLevelOptions(value)
  const drawPart = parts.find((p) => p.startsWith('draw='))
  if (!drawPart) {
    scanner.error('"edge from parent/.style" doit contenir "draw=<couleur>"', groupStart)
  }
  const rest = parts.filter((p) => p !== drawPart)
  if (rest.length !== 1 || rest[0] !== 'thin') {
    scanner.error('"edge from parent/.style" non supporté : attendu exactement "draw=<couleur>, thin"', groupStart)
  }
  return drawPart!.slice('draw='.length).trim()
}

function parseChildOptions(raw: string, scanner: Scanner, groupStart: number): ChildOptions {
  if (/\bgrow cyclic\b/.test(raw)) {
    scanner.error('`grow cyclic` non supporté : angle explicite requis (voir grammar.md)', groupStart)
  }
  const parts = splitTopLevelOptions(raw)

  let color: string | null = null
  let grow: number | null = null
  let distance: number | null = null

  for (const part of parts) {
    if (part.startsWith('grow=')) {
      const value = part.slice('grow='.length).trim()
      const growMatch = /^(-?\d+(?:\.\d+)?):1$/.exec(value)
      if (!growMatch) scanner.error(`Angle "grow" invalide : "${value}" (attendu "<angle>:1")`, groupStart)
      grow = Number.parseFloat(growMatch![1])
    } else if (part.startsWith('level distance=')) {
      const value = part.slice('level distance='.length).trim()
      const distMatch = /^(\d+(?:\.\d+)?)cm$/.exec(value)
      if (!distMatch) scanner.error(`Distance invalide : "${value}" (attendu "<nombre>cm")`, groupStart)
      distance = Number.parseFloat(distMatch![1])
    } else if (part.startsWith('edge from parent/.style=')) {
      const braceContent = extractBraceValue(part, 'edge from parent/.style=', scanner, groupStart)
      color = parseEdgeStyleColor(braceContent, scanner, groupStart)
    } else {
      scanner.error(`Option non supportée dans un child[...] : "${part}"`, groupStart)
    }
  }

  if (grow === null) scanner.error('Option "grow=<angle>:1" manquante (obligatoire)', groupStart)
  return { color, grow, distance }
}

interface NodeOptions {
  drawColor: string | null
  textColor: string | null
}

function parseNodeOptions(raw: string, scanner: Scanner, groupStart: number): NodeOptions {
  const parts = splitTopLevelOptions(raw)
  let drawColor: string | null = null
  let textColor: string | null = null
  for (const part of parts) {
    if (part.startsWith('draw=')) {
      drawColor = part.slice('draw='.length).trim()
    } else if (part.startsWith('text=')) {
      textColor = part.slice('text='.length).trim()
    } else {
      scanner.error(
        `Option de nœud non supportée : "${part}" (seules "draw=<couleur>" et "text=<couleur>" sont permises)`,
        groupStart,
      )
    }
  }
  return { drawColor, textColor }
}

const LABEL_ESCAPES: Array<[RegExp, string]> = [
  [/^\\textbackslash\{\}/, '\\'],
  [/^\\textasciitilde\{\}/, '~'],
  [/^\\textasciicircum\{\}/, '^'],
  [/^\\\\/, '\n'],
  [/^\\&/, '&'],
  [/^\\%/, '%'],
  [/^\\\$/, '$'],
  [/^\\#/, '#'],
  [/^\\_/, '_'],
  [/^\\\{/, '{'],
  [/^\\\}/, '}'],
]

export function unescapeLabel(raw: string, scanner: Scanner, groupStart: number): string {
  let out = ''
  let i = 0
  while (i < raw.length) {
    if (raw[i] === '\\') {
      const rest = raw.slice(i)
      const found = LABEL_ESCAPES.find(([re]) => re.test(rest))
      if (!found) {
        scanner.error(`Commande LaTeX non supportée dans un label : "${rest.slice(0, 20)}..."`, groupStart)
      }
      const [re, replacement] = found!
      out += replacement
      i += re.exec(rest)![0].length
    } else {
      out += raw[i]
      i += 1
    }
  }
  return out
}

interface RawChild {
  label: string
  color: string | null
  textColor: string | null
  grow: number
  distance: number
  children: RawChild[]
}

function parseChildBlock(scanner: Scanner, depth: number, palette: Record<string, string>, style: MindmapStyle): RawChild {
  scanner.expect('child')
  const optsStart = scanner.position
  const optsRaw = scanner.readBracketGroup()
  const options = parseChildOptions(optsRaw, scanner, optsStart)
  if (options.color) assertKnownColor(scanner, optsStart, options.color, palette)

  scanner.expect('{')
  scanner.expect('node')
  let nodeOpts: NodeOptions = { drawColor: null, textColor: null }
  if (scanner.peekLiteral('[')) {
    const nodeOptsStart = scanner.position
    const nodeOptsRaw = scanner.readBracketGroup()
    nodeOpts = parseNodeOptions(nodeOptsRaw, scanner, nodeOptsStart)
    if (nodeOpts.drawColor !== null) {
      if (style !== 'fancy') {
        scanner.error('"draw=" sur un nœud n\'a de sens qu\'en style fancy (pas de case en style simple)', nodeOptsStart)
      }
      assertKnownColor(scanner, nodeOptsStart, nodeOpts.drawColor, palette)
      if (options.color !== null && options.color !== nodeOpts.drawColor) {
        scanner.error(
          `Couleur de case ("${nodeOpts.drawColor}") et de lien ("${options.color}") incohérentes pour ce nœud`,
          nodeOptsStart,
        )
      }
    }
    if (nodeOpts.textColor) assertKnownColor(scanner, nodeOptsStart, nodeOpts.textColor, palette)
  }
  const labelStart = scanner.position
  const rawLabel = scanner.readBraceGroup()
  const label = unescapeLabel(rawLabel, scanner, labelStart)

  const children: RawChild[] = []
  while (scanner.peekLiteral('child')) {
    children.push(parseChildBlock(scanner, depth + 1, palette, style))
  }
  scanner.expect('}')

  return {
    label,
    color: options.color ?? nodeOpts.drawColor,
    textColor: nodeOpts.textColor,
    grow: options.grow,
    distance: options.distance ?? defaultDistanceForDepth(depth),
    children,
  }
}

function parseTikzSource(
  tikzSource: string,
  palette: Record<string, string>,
): { rootLabel: string; rootTextColor: string | null; style: MindmapStyle; children: RawChild[] } {
  const scanner = new Scanner(tikzSource)
  scanner.expect('\\begin{tikzpicture}')
  const headerOpts = scanner.readBracketGroup()
  const style = detectStyle(headerOpts)
  scanner.expect('\\node')
  let rootTextColor: string | null = null
  if (scanner.peekLiteral('[')) {
    const rootOptsStart = scanner.position
    const rootOptsRaw = scanner.readBracketGroup()
    const rootOpts = parseNodeOptions(rootOptsRaw, scanner, rootOptsStart)
    if (rootOpts.drawColor !== null) {
      scanner.error('La racine ne supporte pas "draw=" (pas de bordure ni de lien sur la racine)', rootOptsStart)
    }
    rootTextColor = rootOpts.textColor
    if (rootTextColor) assertKnownColor(scanner, rootOptsStart, rootTextColor, palette)
  }
  scanner.expect('(')
  scanner.readUntil(')')
  scanner.expect(')')
  const rootLabelStart = scanner.position
  const rawRootLabel = scanner.readBraceGroup()
  const rootLabel = unescapeLabel(rawRootLabel, scanner, rootLabelStart)

  const children: RawChild[] = []
  while (scanner.peekLiteral('child')) {
    children.push(parseChildBlock(scanner, 1, palette, style))
  }
  scanner.expect(';')
  scanner.expect('\\end{tikzpicture}')
  return { rootLabel, rootTextColor, style, children }
}

export function parseDocument(source: string): ParsedDocument {
  const { prefix, block, suffix, hadMarkers } = locateBlock(source)
  const { palette, tikzSource } = extractPalette(block)
  const { rootLabel, rootTextColor, style, children } = parseTikzSource(tikzSource, palette)

  let tree = createTree(rootLabel, style)
  for (const [name, hex] of Object.entries(palette)) tree = defineColor(tree, name, hex)
  if (rootTextColor) tree = setTextColor(tree, ROOT_ID, rootTextColor)

  function attach(tree: MindmapTree, parentId: string, raw: RawChild): MindmapTree {
    let next = addChild(tree, parentId, {
      label: raw.label,
      grow: raw.grow,
      distance: raw.distance,
      color: raw.color,
      textColor: raw.textColor,
    })
    const located = findNode(next, parentId)
    if (!located) throw new Error('parent introuvable après ajout')
    const newChildId = located.node.children[located.node.children.length - 1].id
    for (const grandchild of raw.children) {
      next = attach(next, newChildId, grandchild)
    }
    return next
  }

  for (const child of children) {
    tree = attach(tree, ROOT_ID, child)
  }

  return { tree, prefix, suffix, hadMarkers }
}

export { ParseError }
