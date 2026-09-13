// Modèle d'arbre pur (aucune dépendance UI). Toutes les opérations sont immuables :
// elles retournent un nouvel arbre plutôt que de muter l'existant, ce qui permet
// l'undo/redo (voir history.ts) et des tests déterministes simples.

export type NodeId = string

/** Style global du document : deux présets figés, jamais un mélange libre (voir generate.ts). */
export type MindmapStyle = 'fancy' | 'simple'

export interface MindmapNode {
  id: NodeId
  label: string
  /** Couleur explicite de la branche, ou null pour hériter de l'ancêtre le plus proche. */
  color: string | null
  /** Couleur du texte (tikz `text=<couleur>`), ou null pour la couleur par défaut du style. */
  textColor: string | null
  /** Angle de croissance en degrés depuis le parent (tikz `grow=<angle>:1`). Null pour la racine. */
  grow: number | null
  /** Distance au parent en cm (tikz `level distance`). Null pour la racine. */
  distance: number | null
  children: MindmapNode[]
}

export interface MindmapTree {
  root: MindmapNode
  /** Couleurs personnalisées déclarées via \definecolor, nom -> #rrggbb (inclut la palette par défaut, voir DEFAULT_PALETTE_SEED). */
  palette: Record<string, string>
  style: MindmapStyle
}

// Palette sobre et cohérente, déclarée via \definecolor dans le .tex généré (pas des noms xcolor
// bruts type "red"/"blue" jugés trop criards) — voir createTree qui la seed dans chaque nouvel
// arbre. Purement optionnelle : par défaut (aucune couleur choisie), tout est monochrome noir —
// voir DEFAULT_ROOT_COLOR_NAME et defaultTextColorForStyle. La couleur reste toujours disponible
// pour les liens, les cases et le texte via la toolbox, elle n'est simplement pas le réglage par
// défaut d'un nouveau nœud.
export const DEFAULT_PALETTE_SEED: Record<string, string> = {
  mmTeal: '#3d6b66',
  mmBlue: '#3a5a80',
  mmPlum: '#6b5170',
  mmAmber: '#a97b3a',
  mmMoss: '#556b45',
  mmRose: '#95514f',
  mmSlate: '#54606b',
}

/**
 * Couleur neutre utilisée quand rien n'est choisi : un nom xcolor de base ('black'), pas une
 * entrée de palette — nécessaire au niveau du tikzpicture (`concept color=black`) pour qu'un nœud
 * sans couleur explicite (typiquement la racine) ait toujours une couleur définie, plutôt que de
 * dépendre d'un comportement par défaut non garanti selon le moteur de rendu.
 */
export const DEFAULT_ROOT_COLOR_NAME = 'black'

export const DEFAULT_BRANCH_COLORS = Object.keys(DEFAULT_PALETTE_SEED)

export const KNOWN_COLOR_NAMES = new Set<string>([
  'white', 'black', 'red', 'green', 'blue', 'cyan', 'magenta', 'yellow',
  'gray', 'darkgray', 'lightgray', 'brown', 'lime', 'olive', 'orange',
  'pink', 'purple', 'teal', 'violet',
])

/** Couleur de texte par défaut quand aucune n'est choisie : noir, dans les deux styles. */
export function defaultTextColorForStyle(_style: MindmapStyle): string {
  return 'black'
}

export function defaultDistanceForDepth(depth: number): number {
  if (depth <= 1) return 4
  if (depth === 2) return 3
  return 2.5
}

export const ROOT_ID: NodeId = 'root'

let idCounter = 0
/** Génère un id de nœud stable et lisible. Exposé pour permettre l'injection en test. */
export function makeNodeId(prefix = 'n'): NodeId {
  idCounter += 1
  return `${prefix}-${idCounter}-${Date.now().toString(36)}`
}

export function createTree(rootLabel: string, style: MindmapStyle = 'fancy'): MindmapTree {
  return {
    root: { id: ROOT_ID, label: rootLabel, color: null, textColor: null, grow: null, distance: null, children: [] },
    palette: { ...DEFAULT_PALETTE_SEED },
    style,
  }
}

interface Located {
  node: MindmapNode
  parent: MindmapNode | null
  depth: number
}

export function findNode(tree: MindmapTree, id: NodeId): Located | undefined {
  function walk(node: MindmapNode, parent: MindmapNode | null, depth: number): Located | undefined {
    if (node.id === id) return { node, parent, depth }
    for (const child of node.children) {
      const found = walk(child, node, depth + 1)
      if (found) return found
    }
    return undefined
  }
  return walk(tree.root, null, 0)
}

export function getDepth(tree: MindmapTree, id: NodeId): number {
  const located = findNode(tree, id)
  if (!located) throw new Error(`Nœud introuvable: ${id}`)
  return located.depth
}

/** Remplace un nœud par le résultat de `updater`, en reconstruisant le chemin depuis la racine. */
function replaceNode(tree: MindmapTree, id: NodeId, updater: (node: MindmapNode) => MindmapNode): MindmapTree {
  function walk(node: MindmapNode): MindmapNode {
    if (node.id === id) return updater(node)
    if (node.children.length === 0) return node
    return { ...node, children: node.children.map(walk) }
  }
  return { ...tree, root: walk(tree.root) }
}

export function addChild(
  tree: MindmapTree,
  parentId: NodeId,
  options: { label: string; grow: number; distance?: number; color?: string | null; textColor?: string | null; id?: NodeId },
): MindmapTree {
  const parentDepth = getDepth(tree, parentId)
  const child: MindmapNode = {
    id: options.id ?? makeNodeId(),
    label: options.label,
    color: options.color ?? null,
    textColor: options.textColor ?? null,
    grow: options.grow,
    distance: options.distance ?? defaultDistanceForDepth(parentDepth + 1),
    children: [],
  }
  return replaceNode(tree, parentId, (parent) => ({ ...parent, children: [...parent.children, child] }))
}

export function removeNode(tree: MindmapTree, id: NodeId): MindmapTree {
  if (id === ROOT_ID) throw new Error('La racine ne peut pas être supprimée')
  function walk(node: MindmapNode): MindmapNode {
    return { ...node, children: node.children.filter((c) => c.id !== id).map(walk) }
  }
  return { ...tree, root: walk(tree.root) }
}

export function relabelNode(tree: MindmapTree, id: NodeId, label: string): MindmapTree {
  return replaceNode(tree, id, (node) => ({ ...node, label }))
}

export function recolorNode(tree: MindmapTree, id: NodeId, color: string | null): MindmapTree {
  if (id === ROOT_ID) throw new Error("La racine n'a pas de couleur de branche")
  return replaceNode(tree, id, (node) => ({ ...node, color }))
}

export function moveNode(tree: MindmapTree, id: NodeId, placement: { grow: number; distance: number }): MindmapTree {
  if (id === ROOT_ID) throw new Error('La racine ne peut pas être déplacée')
  return replaceNode(tree, id, (node) => ({ ...node, grow: placement.grow, distance: placement.distance }))
}

/** Couleur du texte : contrairement à `color`, ne s'hérite pas — s'applique nœud par nœud. */
export function setTextColor(tree: MindmapTree, id: NodeId, textColor: string | null): MindmapTree {
  return replaceNode(tree, id, (node) => ({ ...node, textColor }))
}

export function setStyle(tree: MindmapTree, style: MindmapStyle): MindmapTree {
  return { ...tree, style }
}

/**
 * Convertit un nom de couleur du modèle (nom xcolor connu ou clé de palette personnalisée) en une
 * valeur CSS effectivement affichable. Nécessaire car une clé de palette (ex: "custom1") n'est pas
 * elle-même une couleur CSS valide — c'est un nom qui référence `MindmapTree.palette`.
 */
export function toCssColor(tree: MindmapTree, name: string): string {
  return tree.palette[name] ?? name
}

/** Couleur effective d'un nœud : sa couleur propre, sinon celle de l'ancêtre le plus proche qui en a une. */
export function getResolvedColor(tree: MindmapTree, id: NodeId): string | null {
  function walk(node: MindmapNode, path: MindmapNode[]): MindmapNode[] | undefined {
    const nextPath = [...path, node]
    if (node.id === id) return nextPath
    for (const child of node.children) {
      const found = walk(child, nextPath)
      if (found) return found
    }
    return undefined
  }
  const path = walk(tree.root, [])
  if (!path) throw new Error(`Nœud introuvable: ${id}`)
  for (let i = path.length - 1; i >= 0; i -= 1) {
    if (path[i].color) return path[i].color
  }
  return null
}

/**
 * Angles déjà occupés par les enfants directs d'un parent, pour l'anti-chevauchement du snapping.
 * `excludeId` permet d'ignorer un enfant précis (typiquement lui-même, quand on le déplace).
 */
export function listChildAngles(tree: MindmapTree, parentId: NodeId, excludeId?: NodeId): number[] {
  const located = findNode(tree, parentId)
  if (!located) throw new Error(`Nœud introuvable: ${parentId}`)
  return located.node.children
    .filter((c) => c.id !== excludeId)
    .map((c) => c.grow)
    .filter((g): g is number => g !== null)
}

/** Prochaine couleur par défaut à proposer pour une nouvelle branche de niveau 1. */
export function nextBranchColor(tree: MindmapTree): string {
  const used = tree.root.children.map((c) => c.color).filter(Boolean)
  const free = DEFAULT_BRANCH_COLORS.find((c) => !used.includes(c))
  return free ?? DEFAULT_BRANCH_COLORS[tree.root.children.length % DEFAULT_BRANCH_COLORS.length]
}

export function defineColor(tree: MindmapTree, name: string, hex: string): MindmapTree {
  return { ...tree, palette: { ...tree.palette, [name]: hex } }
}
