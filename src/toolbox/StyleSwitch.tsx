import type { MindmapStyle } from '../model/tree'

export interface StyleSwitchProps {
  value: MindmapStyle
  onChange: (style: MindmapStyle) => void
}

export function StyleSwitch({ value, onChange }: StyleSwitchProps) {
  return (
    <div className="style-switch" role="group" aria-label="Style global">
      <button type="button" className={value === 'fancy' ? 'active' : ''} onClick={() => onChange('fancy')}>
        Fancy
      </button>
      <button type="button" className={value === 'simple' ? 'active' : ''} onClick={() => onChange('simple')}>
        Simple / formel
      </button>
    </div>
  )
}
