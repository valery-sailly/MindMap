// Modèle d'arbre pur (aucune dépendance UI). Toutes les opérations sont immuables :
// elles retournent un nouvel arbre plutôt que de muter l'existant, ce qui permet
// l'undo/redo (voir history.ts) et des tests déterministes simples.

export type NodeId = string

export interface MindmapNode {
  id: NodeId
  label: string
  /** Couleur explicite de la branche, ou null pour hériter de l'ancêtre le plus proche. */
  color: string | null
  /** Angle de croissance en degrés depuis le parent (tikz `grow=<angle>:1`). Null pour la racine. */
  grow: number | null
  /** Distance au parent en cm (tikz `level distance`). Null pour la racine. */
  distance: number | null
  children: MindmapNode[]
}

export interface MindmapTree {
  root: MindmapNode
  /** Couleurs personnalisées déclarées via \definecolor, nom -> #rrggbb. */
  palette: Record<string, string>
}

// Palette finie de noms de couleurs xcolor de base (disponibles sans \definecolor), pour que le
// générateur n'ait jamais besoin de sortir de ce que la toolbox propose. Les couleurs
// personnalisées d'un .tex importé vivent séparément dans MindmapTree.palette (voir defineColor).
export const DEFAULT_BRANCH_COLORS = [
  'teal',
  'blue',
  'violet',
  'orange',
  'green',
  'red',
  'magenta',
] as const

export const KNOWN_COLOR_NAMES = new Set<string>([
  'white', 'black', 'red', 'green', 'blue', 'cyan', 'magenta', 'yellow',
  'gray', 'darkgray', 'lightgray', 'brown', 'lime', 'olive', 'orange',
  'pink', 'purple', 'teal', 'violet',
])

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

export function createTree(rootLabel: string): MindmapTree {
  return {
    root: { id: ROOT_ID, label: rootLabel, color: null, grow: null, distance: null, children: [] },
    palette: {},
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
  options: { label: string; grow: number; distance?: number; color?: string | null; id?: NodeId },
): MindmapTree {
  const parentDepth = getDepth(tree, parentId)
  const child: MindmapNode = {
    id: options.id ?? makeNodeId(),
    label: options.label,
    color: options.color ?? null,
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

/** Angles déjà occupés par les enfants directs d'un parent, pour l'anti-chevauchement du snapping. */
export function listChildAngles(tree: MindmapTree, parentId: NodeId): number[] {
  const located = findNode(tree, parentId)
  if (!located) throw new Error(`Nœud introuvable: ${parentId}`)
  return located.node.children.map((c) => c.grow).filter((g): g is number => g !== null)
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
