// Historique undo/redo générique par pile, utilisé pour MindmapTree mais indépendant du type.

export interface History<T> {
  past: T[]
  present: T
  future: T[]
}

export function createHistory<T>(initial: T): History<T> {
  return { past: [], present: initial, future: [] }
}

/** Empile l'état courant et applique le nouvel état ; vide le futur (nouvelle branche d'édition). */
export function push<T>(history: History<T>, next: T): History<T> {
  return { past: [...history.past, history.present], present: next, future: [] }
}

export function undo<T>(history: History<T>): History<T> {
  if (history.past.length === 0) return history
  const previous = history.past[history.past.length - 1]
  return {
    past: history.past.slice(0, -1),
    present: previous,
    future: [history.present, ...history.future],
  }
}

export function redo<T>(history: History<T>): History<T> {
  if (history.future.length === 0) return history
  const [next, ...rest] = history.future
  return { past: [...history.past, history.present], present: next, future: rest }
}

export const canUndo = <T>(history: History<T>): boolean => history.past.length > 0
export const canRedo = <T>(history: History<T>): boolean => history.future.length > 0
