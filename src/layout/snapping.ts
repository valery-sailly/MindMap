// Grille de snapping angle/distance : cœur du principe "pas d'IA, on mesure les traits". Un
// geste de tracé libre est toujours ramené à un point d'une grille finie avant de devenir un
// paramètre `grow`/`level distance` — jamais interprété librement.

import { type Point, pointToPolar } from './geometry'

export const ANGLE_STEP_OPTIONS = [5, 10, 15, 30] as const
export const DEFAULT_ANGLE_STEP_DEG = 15

export const DISTANCE_STEPS_CM = [2, 2.5, 3, 3.5, 4, 5, 6, 8] as const

export function snapAngle(angleDeg: number, stepDeg: number): number {
  const normalized = ((angleDeg % 360) + 360) % 360
  return (Math.round(normalized / stepDeg) * stepDeg) % 360
}

export function snapDistance(distanceCm: number, steps: readonly number[] = DISTANCE_STEPS_CM): number {
  return steps.reduce((best, step) => (Math.abs(step - distanceCm) < Math.abs(best - distanceCm) ? step : best), steps[0])
}

function angularSeparation(a: number, b: number): number {
  const diff = Math.abs(a - b) % 360
  return Math.min(diff, 360 - diff)
}

/**
 * Décale un angle snappé vers le prochain palier libre s'il est déjà occupé par un sibling
 * (à moins de `stepDeg` d'écart), en alternant de part et d'autre de l'angle désiré.
 */
export function resolveFreeAngle(desiredAngle: number, occupiedAngles: readonly number[], stepDeg: number): number {
  const isFree = (angle: number): boolean => occupiedAngles.every((o) => angularSeparation(angle, o) >= stepDeg)
  if (isFree(desiredAngle)) return desiredAngle
  const steps = Math.floor(360 / stepDeg)
  for (let i = 1; i <= steps; i += 1) {
    const offset = i * stepDeg
    const plus = (desiredAngle + offset) % 360
    if (isFree(plus)) return plus
    const minus = ((desiredAngle - offset) % 360 + 360) % 360
    if (isFree(minus)) return minus
  }
  return desiredAngle
}

export interface StrokeMeasurement {
  grow: number
  distance: number
}

/**
 * Transforme un geste de tracé (origine du parent -> position du pointeur) en placement
 * `grow`/`distance` toujours dans la grille de la toolbox : c'est le seul point d'entrée entre
 * l'interaction souris et le modèle de données.
 */
export function measureStroke(
  origin: Point,
  pointer: Point,
  occupiedAngles: readonly number[],
  angleStepDeg: number = DEFAULT_ANGLE_STEP_DEG,
): StrokeMeasurement {
  const raw = pointToPolar(origin, pointer)
  const snappedAngle = snapAngle(raw.angleDeg, angleStepDeg)
  const freeAngle = resolveFreeAngle(snappedAngle, occupiedAngles, angleStepDeg)
  const distance = snapDistance(raw.distanceCm)
  return { grow: freeAngle, distance }
}
