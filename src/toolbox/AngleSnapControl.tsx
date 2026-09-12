import { ANGLE_STEP_OPTIONS } from '../layout/snapping'

export interface AngleSnapControlProps {
  value: number
  onChange: (step: number) => void
}

export function AngleSnapControl({ value, onChange }: AngleSnapControlProps) {
  return (
    <label className="angle-snap-control">
      Pas d'angle (toolbox)
      <select value={value} onChange={(e) => onChange(Number(e.target.value))}>
        {ANGLE_STEP_OPTIONS.map((step) => (
          <option key={step} value={step}>
            {step}°
          </option>
        ))}
      </select>
    </label>
  )
}
