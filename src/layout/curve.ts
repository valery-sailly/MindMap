// Formule de courbe unique pour l'aperçu SVG des branches (approximation visuelle du rendu tikz
// mindmap réel, voir grammar.md — pas un rendu pixel-perfect du PDF compilé). Une seule fonction
// pure ici, jamais dupliquée ailleurs dans canvas/.

import type { Point } from './geometry'

/** Fraction de la longueur du segment utilisée comme amplitude de la courbure. */
const BEND_FACTOR = 0.15

export function branchControlPoints(parent: Point, child: Point): [Point, Point] {
  const dx = child.x - parent.x
  const dy = child.y - parent.y
  const length = Math.hypot(dx, dy) || 1
  const perpX = -dy / length
  const perpY = dx / length
  const bend = length * BEND_FACTOR

  return [
    { x: parent.x + dx * 0.25 + perpX * bend, y: parent.y + dy * 0.25 + perpY * bend },
    { x: parent.x + dx * 0.75 + perpX * bend, y: parent.y + dy * 0.75 + perpY * bend },
  ]
}

/** Chemin SVG `d` pour une courbe de branche cubique entre deux nœuds. */
export function branchPath(parent: Point, child: Point): string {
  const [c1, c2] = branchControlPoints(parent, child)
  return `M ${parent.x} ${parent.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${child.x} ${child.y}`
}
