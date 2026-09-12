import { describe, expect, it } from 'vitest'
import { PX_PER_CM, pointToPolar, polarToPoint } from '../../src/layout/geometry'

describe('layout/geometry', () => {
  it('places a point to the right for angle 0', () => {
    const p = polarToPoint({ x: 0, y: 0 }, 0, 1)
    expect(p.x).toBeCloseTo(PX_PER_CM)
    expect(p.y).toBeCloseTo(0)
  })

  it('places a point above the origin for angle 90 (screen y grows downward)', () => {
    const p = polarToPoint({ x: 0, y: 0 }, 90, 1)
    expect(p.x).toBeCloseTo(0)
    expect(p.y).toBeCloseTo(-PX_PER_CM)
  })

  it('round-trips polarToPoint -> pointToPolar', () => {
    const origin = { x: 100, y: 100 }
    const original = { angleDeg: 40, distanceCm: 3.5 }
    const point = polarToPoint(origin, original.angleDeg, original.distanceCm)
    const recovered = pointToPolar(origin, point)
    expect(recovered.angleDeg).toBeCloseTo(original.angleDeg)
    expect(recovered.distanceCm).toBeCloseTo(original.distanceCm)
  })

  it('normalizes negative angles to [0, 360)', () => {
    const point = polarToPoint({ x: 0, y: 0 }, -90, 1)
    const { angleDeg } = pointToPolar({ x: 0, y: 0 }, point)
    expect(angleDeg).toBeCloseTo(270)
  })
})
