import { describe, expect, it } from 'vitest'
import { canRedo, canUndo, createHistory, push, redo, undo } from '../../src/model/history'

describe('model/history', () => {
  it('starts with no undo/redo available', () => {
    const h = createHistory(0)
    expect(canUndo(h)).toBe(false)
    expect(canRedo(h)).toBe(false)
  })

  it('undoes back to the previous state', () => {
    let h = createHistory(0)
    h = push(h, 1)
    h = push(h, 2)
    h = undo(h)
    expect(h.present).toBe(1)
    expect(canRedo(h)).toBe(true)
  })

  it('redoes after an undo', () => {
    let h = createHistory(0)
    h = push(h, 1)
    h = undo(h)
    h = redo(h)
    expect(h.present).toBe(1)
    expect(canRedo(h)).toBe(false)
  })

  it('clears the redo stack on a new edit after undo', () => {
    let h = createHistory(0)
    h = push(h, 1)
    h = push(h, 2)
    h = undo(h)
    h = push(h, 3)
    expect(h.present).toBe(3)
    expect(canRedo(h)).toBe(false)
  })
})
