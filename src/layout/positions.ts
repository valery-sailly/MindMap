// Calcule la position absolue (pixels canvas) de chaque nœud à partir de l'arbre et de l'origine
// de la racine. Fonction pure, seule source de vérité pour le placement, utilisée par le rendu
// SVG et par les interactions de tracé (pour connaître le point de départ d'une nouvelle branche).

import type { MindmapNode, MindmapTree, NodeId } from '../model/tree'
import { type Point, polarToPoint } from './geometry'

export function computePositions(tree: MindmapTree, origin: Point): Map<NodeId, Point> {
  const positions = new Map<NodeId, Point>()

  function walk(node: MindmapNode, position: Point): void {
    positions.set(node.id, position)
    for (const child of node.children) {
      if (child.grow === null || child.distance === null) continue
      walk(child, polarToPoint(position, child.grow, child.distance))
    }
  }

  walk(tree.root, origin)
  return positions
}
