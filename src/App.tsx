import { useState } from 'react'
import { MindmapProvider, useMindmapStore } from './state/store'
import { MindmapCanvas } from './canvas/MindmapCanvas'
import type { CanvasMode } from './canvas/useDragToPlace'
import { NodeInspector } from './toolbox/NodeInspector'
import { AngleSnapControl } from './toolbox/AngleSnapControl'
import { StyleSwitch } from './toolbox/StyleSwitch'
import { ModeSwitch } from './toolbox/ModeSwitch'
import { ImportExportPanel, type DocShell, type EditMode } from './toolbox/ImportExportPanel'
import { DEFAULT_ANGLE_STEP_DEG } from './layout/snapping'

interface ToolbarProps {
  angleStep: number
  onAngleStepChange: (n: number) => void
  canvasMode: CanvasMode
  onCanvasModeChange: (m: CanvasMode) => void
}

function Toolbar({ angleStep, onAngleStepChange, canvasMode, onCanvasModeChange }: ToolbarProps) {
  const store = useMindmapStore()
  return (
    <header className="toolbar">
      <h1>Mindmap → LaTeX</h1>
      <div className="toolbar-actions">
        <button type="button" onClick={store.undo} disabled={!store.canUndo}>
          ↶ Annuler
        </button>
        <button type="button" onClick={store.redo} disabled={!store.canRedo}>
          ↷ Rétablir
        </button>
        <ModeSwitch value={canvasMode} onChange={onCanvasModeChange} />
        <StyleSwitch value={store.tree.style} onChange={store.setStyle} />
        <AngleSnapControl value={angleStep} onChange={onAngleStepChange} />
      </div>
    </header>
  )
}

function Workspace({ angleStep, canvasMode }: { angleStep: number; canvasMode: CanvasMode }) {
  const [mode, setMode] = useState<EditMode>('scratch')
  const [docShell, setDocShell] = useState<DocShell | null>(null)

  return (
    <div className="workspace">
      <MindmapCanvas angleStepDeg={angleStep} mode={canvasMode} />
      <aside className="side-panel">
        <NodeInspector canvasMode={canvasMode} />
        <ImportExportPanel
          mode={mode}
          onModeChange={setMode}
          docShell={docShell}
          onImported={(shell) => {
            setDocShell(shell)
            setMode('import')
          }}
        />
      </aside>
    </div>
  )
}

function App() {
  const [angleStep, setAngleStep] = useState(DEFAULT_ANGLE_STEP_DEG)
  const [canvasMode, setCanvasMode] = useState<CanvasMode>('create')

  return (
    <MindmapProvider>
      <div className="app-shell">
        <Toolbar
          angleStep={angleStep}
          onAngleStepChange={setAngleStep}
          canvasMode={canvasMode}
          onCanvasModeChange={setCanvasMode}
        />
        <Workspace angleStep={angleStep} canvasMode={canvasMode} />
      </div>
    </MindmapProvider>
  )
}

export default App
