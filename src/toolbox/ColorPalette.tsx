import { DEFAULT_BRANCH_COLORS } from '../model/tree'

export interface ColorPaletteProps {
  value: string | null
  customColors: Record<string, string>
  onChange: (color: string | null) => void
  nullLabel?: string
  nullSymbol?: string
}

export function ColorPalette({
  value,
  customColors,
  onChange,
  nullLabel = 'Hériter de la branche parente',
  nullSymbol = '↖',
}: ColorPaletteProps) {
  return (
    <div className="color-palette" role="group" aria-label="Couleur">
      <button
        type="button"
        className={`swatch swatch-inherit${value === null ? ' selected' : ''}`}
        onClick={() => onChange(null)}
        title={nullLabel}
      >
        {nullSymbol}
      </button>
      {DEFAULT_BRANCH_COLORS.map((color) => (
        <button
          key={color}
          type="button"
          className={`swatch${value === color ? ' selected' : ''}`}
          style={{ background: color }}
          onClick={() => onChange(color)}
          title={color}
          aria-label={color}
        />
      ))}
      {Object.entries(customColors).map(([name, hex]) => (
        <button
          key={name}
          type="button"
          className={`swatch${value === name ? ' selected' : ''}`}
          style={{ background: hex }}
          onClick={() => onChange(name)}
          title={name}
          aria-label={name}
        />
      ))}
    </div>
  )
}
