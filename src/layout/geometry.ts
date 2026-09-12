// Conversion point <-> (angle, distance). Convention trigonométrique : 0° = droite, sens
// anti-horaire, comme `grow=<angle>:1` en tikz. L'axe Y écran croît vers le bas, d'où l'inversion.

export interface Point {
  x: number
  y: number
}

/** Pixels par centimètre : source unique utilisée par le canvas SVG et par la génération tex. */
export const PX_PER_CM = 40

export function polarToPoint(origin: Point, angleDeg: number, distanceCm: number): Point {
  const rad = (angleDeg * Math.PI) / 180
  const distancePx = distanceCm * PX_PER_CM
  return {
    x: origin.x + Math.cos(rad) * distancePx,
    y: origin.y - Math.sin(rad) * distancePx,
  }
}

export function pointToPolar(origin: Point, point: Point): { angleDeg: number; distanceCm: number } {
  const dx = point.x - origin.x
  const dy = origin.y - point.y
  const rad = Math.atan2(dy, dx)
  const angleDeg = ((rad * 180) / Math.PI + 360) % 360
  const distanceCm = Math.hypot(dx, dy) / PX_PER_CM
  return { angleDeg, distanceCm }
}
