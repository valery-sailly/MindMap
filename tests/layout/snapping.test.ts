import { describe, expect, it } from 'vitest'
import {
  measureStroke,
  resolveFreeAngle,
  snapAngle,
  snapDistance,
} from '../../src/layout/snapping'
import { polarToPoint } from '../../src/layout/geometry'

describe('layout/snapping', () => {
  it('snaps an angle to the nearest step', () => {
    expect(snapAngle(92, 15)).toBe(90)
    expect(snapAngle(97, 15)).toBe(90)
    expect(snapAngle(98, 15)).toBe(105)
  })

  it('wraps snapped angles into [0, 360)', () => {
    expect(snapAngle(355, 15)).toBe(0)
    expect(snapAngle(-10, 15)).toBe(345)
  })

  it('snaps a distance to the nearest configured step', () => {
    expect(snapDistance(2.6)).toBe(2.5)
    expect(snapDistance(4.9)).toBe(5)
  })

  it('leaves a free angle untouched', () => {
    expect(resolveFreeAngle(90, [0, 180], 15)).toBe(90)
  })

  it('shifts to the next free slot when the desired angle is already occupied', () => {
    const resolved = resolveFreeAngle(90, [90], 15)
    expect(resolved).not.toBe(90)
    // Le premier essai alterne vers +15 avant -15.
    expect(resolved).toBe(105)
  })

  it('keeps shifting when several neighboring slots are already taken', () => {
    const resolved = resolveFreeAngle(90, [90, 105, 75], 15)
    expect([120, 60]).toContain(resolved)
  })

  it('measures a stroke end-to-end from a raw pointer position', () => {
    const origin = { x: 0, y: 0 }
    // Un point tracé presque à 90°/3cm doit tomber pile sur la grille (90°, 3cm).
    const pointer = polarToPoint(origin, 88, 3.1)
    const result = measureStroke(origin, pointer, [], 15)
    expect(result.grow).toBe(90)
    expect(result.distance).toBe(3)
  })

  it('avoids overlapping an existing sibling when measuring a stroke', () => {
    const origin = { x: 0, y: 0 }
    const pointer = polarToPoint(origin, 91, 4)
    const result = measureStroke(origin, pointer, [90], 15)
    expect(result.grow).not.toBe(90)
  })
})
