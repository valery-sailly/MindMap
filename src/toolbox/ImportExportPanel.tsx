import { useMemo, useState } from 'react'
import { generateTikz } from '../latex/generate'
import { AmbiguousBlockError, parseDocument } from '../latex/parse'
import { useMindmapStore } from '../state/store'

export type EditMode = 'scratch' | 'import'

export interface DocShell {
  prefix: string
  suffix: string
}

export interface ImportExportPanelProps {
  mode: EditMode
  onModeChange: (mode: EditMode) => void
  docShell: DocShell | null
  onImported: (shell: DocShell) => void
}

export function ImportExportPanel({ mode, onModeChange, docShell, onImported }: ImportExportPanelProps) {
  const store = useMindmapStore()
  const [importText, setImportText] = useState('')
  const [importError, setImportError] = useState<string | null>(null)
  const [copyStatus, setCopyStatus] = useState<string | null>(null)

  const exportText = useMemo(() => {
    try {
      const block = generateTikz(store.tree)
      return docShell ? `${docShell.prefix}${block}${docShell.suffix}` : block
    } catch (err) {
      return `% Erreur de génération : ${(err as Error).message}`
    }
  }, [store.tree, docShell])

  function handleImport() {
    setImportError(null)
    try {
      const parsed = parseDocument(importText)
      store.replaceTree(parsed.tree)
      onImported({ prefix: parsed.prefix, suffix: parsed.suffix })
    } catch (err) {
      if (err instanceof AmbiguousBlockError) {
        setImportError(
          `${err.message} Gardez un seul bloc \\begin{tikzpicture}[mindmap, ...] dans le texte collé, puis réessayez. ` +
            `Blocs trouvés : ${err.candidates.map((c) => `"${c.preview.replace(/\s+/g, ' ')}…"`).join(' | ')}`,
        )
      } else {
        setImportError((err as Error).message)
      }
    }
  }

  function handleCopy() {
    navigator.clipboard
      .writeText(exportText)
      .then(() => setCopyStatus('Copié !'))
      .catch(() => setCopyStatus('Échec de la copie'))
    setTimeout(() => setCopyStatus(null), 2000)
  }

  function handleDownload() {
    const blob = new Blob([exportText], { type: 'text/x-tex' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'mindmap.tex'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="import-export-panel">
      <div className="mode-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={mode === 'scratch'} className={mode === 'scratch' ? 'active' : ''} onClick={() => onModeChange('scratch')}>
          Construction pure
        </button>
        <button type="button" role="tab" aria-selected={mode === 'import'} className={mode === 'import' ? 'active' : ''} onClick={() => onModeChange('import')}>
          Importer un .tex
        </button>
      </div>

      {mode === 'import' && (
        <div className="import-section">
          <textarea
            placeholder="Collez ici un document .tex contenant une mindmap tikz…"
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            rows={6}
          />
          <button type="button" onClick={handleImport}>
            Charger
          </button>
          {importError && <p className="error-message">{importError}</p>}
        </div>
      )}

      <div className="export-section">
        <div className="export-actions">
          <button type="button" onClick={handleCopy}>
            Copier le .tex
          </button>
          <button type="button" onClick={handleDownload}>
            Télécharger .tex
          </button>
          {copyStatus && <span className="copy-status">{copyStatus}</span>}
        </div>
        <textarea readOnly value={exportText} rows={10} className="export-preview" />
      </div>
    </div>
  )
}
