import { createContext, useCallback, useContext, useMemo, useReducer } from 'react'
import type { ReactNode } from 'react'
import {
  type MindmapTree,
  type NodeId,
  addChild as modelAddChild,
  createTree,
  defineColor as modelDefineColor,
  makeNodeId,
  moveNode as modelMoveNode,
  recolorNode as modelRecolorNode,
  relabelNode as modelRelabelNode,
  removeNode as modelRemoveNode,
} from '../model/tree'
import { type History, canRedo, canUndo, createHistory, push, redo, undo } from '../model/history'

interface State {
  history: History<MindmapTree>
  selectedId: NodeId | null
}

type Action =
  | { type: 'ADD_CHILD'; id: NodeId; parentId: NodeId; label: string; grow: number; distance: number; color: string | null }
  | { type: 'REMOVE_NODE'; id: NodeId }
  | { type: 'RELABEL'; id: NodeId; label: string }
  | { type: 'RECOLOR'; id: NodeId; color: string | null }
  | { type: 'MOVE'; id: NodeId; grow: number; distance: number }
  | { type: 'DEFINE_COLOR'; name: string; hex: string }
  | { type: 'REPLACE_TREE'; tree: MindmapTree }
  | { type: 'SELECT'; id: NodeId | null }
  | { type: 'UNDO' }
  | { type: 'REDO' }

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'ADD_CHILD': {
      const tree = modelAddChild(state.history.present, action.parentId, {
        id: action.id,
        label: action.label,
        grow: action.grow,
        distance: action.distance,
        color: action.color,
      })
      return { history: push(state.history, tree), selectedId: action.id }
    }
    case 'REMOVE_NODE': {
      const tree = modelRemoveNode(state.history.present, action.id)
      const selectedId = state.selectedId === action.id ? null : state.selectedId
      return { history: push(state.history, tree), selectedId }
    }
    case 'RELABEL':
      return { ...state, history: push(state.history, modelRelabelNode(state.history.present, action.id, action.label)) }
    case 'RECOLOR':
      return { ...state, history: push(state.history, modelRecolorNode(state.history.present, action.id, action.color)) }
    case 'MOVE':
      return {
        ...state,
        history: push(state.history, modelMoveNode(state.history.present, action.id, { grow: action.grow, distance: action.distance })),
      }
    case 'DEFINE_COLOR':
      return { ...state, history: push(state.history, modelDefineColor(state.history.present, action.name, action.hex)) }
    case 'REPLACE_TREE':
      return { history: createHistory(action.tree), selectedId: null }
    case 'SELECT':
      return { ...state, selectedId: action.id }
    case 'UNDO':
      return { ...state, history: undo(state.history) }
    case 'REDO':
      return { ...state, history: redo(state.history) }
    default:
      return state
  }
}

export interface MindmapStore {
  tree: MindmapTree
  selectedId: NodeId | null
  canUndo: boolean
  canRedo: boolean
  addChild: (parentId: NodeId, options: { label: string; grow: number; distance: number; color?: string | null }) => NodeId
  removeNode: (id: NodeId) => void
  relabel: (id: NodeId, label: string) => void
  recolor: (id: NodeId, color: string | null) => void
  move: (id: NodeId, placement: { grow: number; distance: number }) => void
  defineColor: (name: string, hex: string) => void
  replaceTree: (tree: MindmapTree) => void
  select: (id: NodeId | null) => void
  undo: () => void
  redo: () => void
}

const StoreContext = createContext<MindmapStore | null>(null)

export function MindmapProvider({ children, initialTree }: { children: ReactNode; initialTree?: MindmapTree }) {
  const [state, dispatch] = useReducer(reducer, undefined, () => ({
    history: createHistory(initialTree ?? createTree('Nouvelle carte')),
    selectedId: null,
  }))

  const addChild = useCallback<MindmapStore['addChild']>((parentId, options) => {
    const id = makeNodeId()
    dispatch({ type: 'ADD_CHILD', id, parentId, label: options.label, grow: options.grow, distance: options.distance, color: options.color ?? null })
    return id
  }, [])
  const removeNode = useCallback((id: NodeId) => dispatch({ type: 'REMOVE_NODE', id }), [])
  const relabel = useCallback((id: NodeId, label: string) => dispatch({ type: 'RELABEL', id, label }), [])
  const recolor = useCallback((id: NodeId, color: string | null) => dispatch({ type: 'RECOLOR', id, color }), [])
  const move = useCallback((id: NodeId, placement: { grow: number; distance: number }) => dispatch({ type: 'MOVE', id, ...placement }), [])
  const defineColorAction = useCallback((name: string, hex: string) => dispatch({ type: 'DEFINE_COLOR', name, hex }), [])
  const replaceTree = useCallback((tree: MindmapTree) => dispatch({ type: 'REPLACE_TREE', tree }), [])
  const select = useCallback((id: NodeId | null) => dispatch({ type: 'SELECT', id }), [])
  const undoAction = useCallback(() => dispatch({ type: 'UNDO' }), [])
  const redoAction = useCallback(() => dispatch({ type: 'REDO' }), [])

  const value = useMemo<MindmapStore>(
    () => ({
      tree: state.history.present,
      selectedId: state.selectedId,
      canUndo: canUndo(state.history),
      canRedo: canRedo(state.history),
      addChild,
      removeNode,
      relabel,
      recolor,
      move,
      defineColor: defineColorAction,
      replaceTree,
      select,
      undo: undoAction,
      redo: redoAction,
    }),
    [state, addChild, removeNode, relabel, recolor, move, defineColorAction, replaceTree, select, undoAction, redoAction],
  )

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useMindmapStore(): MindmapStore {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useMindmapStore doit être utilisé dans un <MindmapProvider>')
  return ctx
}
