import { useState } from 'react'
import { MindmapProvider, useMindmapStore } from './state/store'
import { MindmapCanvas } from './canvas/MindmapCanvas'
import { NodeInspector } from './toolbox/NodeInspector'
import { AngleSnapControl } from './toolbox/AngleSnapControl'
import { StyleSwitch } from './toolbox/StyleSwitch'
import { ImportExportPanel, type DocShell, type EditMode } from './toolbox/ImportExportPanel'
import { DEFAULT_ANGLE_STEP_DEG } from './layout/snapping'

function Toolbar({ angleStep, onAngleStepChange }: { angleStep: number; onAngleStepChange: (n: number) => void }) {
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
        <StyleSwitch value={store.tree.style} onChange={store.setStyle} />
        <AngleSnapControl value={angleStep} onChange={onAngleStepChange} />
      </div>
    </header>
  )
}

function Workspace({ angleStep }: { angleStep: number }) {
  const [mode, setMode] = useState<EditMode>('scratch')
  const [docShell, setDocShell] = useState<DocShell | null>(null)

  return (
    <div className="workspace">
      <MindmapCanvas angleStepDeg={angleStep} />
      <aside className="side-panel">
        <NodeInspector />
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

  return (
    <MindmapProvider>
      <div className="app-shell">
        <Toolbar angleStep={angleStep} onAngleStepChange={setAngleStep} />
        <Workspace angleStep={angleStep} />
      </div>
    </MindmapProvider>
  )
}

export default App
