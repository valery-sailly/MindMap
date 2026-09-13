import type { CanvasMode } from '../canvas/useDragToPlace'

export interface ModeSwitchProps {
  value: CanvasMode
  onChange: (mode: CanvasMode) => void
}

export function ModeSwitch({ value, onChange }: ModeSwitchProps) {
  return (
    <div className="mode-switch" role="group" aria-label="Mode d'interaction du canvas">
      <button type="button" className={value === 'create' ? 'active' : ''} onClick={() => onChange('create')}>
        ✛ Créer
      </button>
      <button type="button" className={value === 'move' ? 'active' : ''} onClick={() => onChange('move')}>
        ✥ Déplacer
      </button>
    </div>
  )
}
