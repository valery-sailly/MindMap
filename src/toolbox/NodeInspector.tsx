import { useState } from 'react'
import { ROOT_ID, defaultDistanceForDepth, findNode, listChildAngles, nextBranchColor } from '../model/tree'
import { resolveFreeAngle } from '../layout/snapping'
import { useMindmapStore } from '../state/store'
import type { CanvasMode } from '../canvas/useDragToPlace'
import { ColorPalette } from './ColorPalette'

let customColorCounter = 0
const DEFAULT_ANGLE_STEP = 15

export function NodeInspector({ canvasMode }: { canvasMode: CanvasMode }) {
  const store = useMindmapStore()
  const [customHex, setCustomHex] = useState('#3366cc')
  const located = store.selectedId ? findNode(store.tree, store.selectedId) : undefined

  if (!located) {
    return (
      <div className="node-inspector node-inspector-empty">
        <p>
          {canvasMode === 'move'
            ? 'Sélectionnez un nœud, ou faites glisser un nœud existant pour le repositionner.'
            : 'Sélectionnez un nœud, ou faites glisser depuis un nœud existant pour créer une branche.'}
        </p>
      </div>
    )
  }

  const { node, depth } = located
  const isRoot = node.id === ROOT_ID

  function addChildHere() {
    const occupied = listChildAngles(store.tree, node.id)
    const grow = resolveFreeAngle(90, occupied, DEFAULT_ANGLE_STEP)
    const distance = defaultDistanceForDepth(depth + 1)
    const color = isRoot ? nextBranchColor(store.tree) : null
    store.addChild(node.id, { label: 'Nouveau nœud', grow, distance, color })
  }

  return (
    <div className="node-inspector">
      <label className="field">
        Texte
        <textarea value={node.label} rows={2} onChange={(e) => store.relabel(node.id, e.target.value)} />
      </label>

      <button type="button" onClick={addChildHere}>
        + Ajouter un enfant
      </button>

      <div className="field">
        <span>Couleur du texte</span>
        <ColorPalette
          value={node.textColor}
          customColors={store.tree.palette}
          onChange={(color) => store.setTextColor(node.id, color)}
          nullLabel="Couleur par défaut du style (blanc en fancy, noir en simple)"
          nullSymbol="Aa"
        />
        <div className="custom-color-row">
          <input type="color" value={customHex} onChange={(e) => setCustomHex(e.target.value)} />
          <button
            type="button"
            onClick={() => {
              customColorCounter += 1
              const name = `custom${customColorCounter}`
              store.defineColor(name, customHex)
              store.setTextColor(node.id, name)
            }}
          >
            + couleur personnalisée
          </button>
        </div>
      </div>

      {!isRoot && (
        <>
          <div className="field">
            <span>Couleur de la branche</span>
            <ColorPalette value={node.color} customColors={store.tree.palette} onChange={(color) => store.recolor(node.id, color)} />
            <div className="custom-color-row">
              <input type="color" value={customHex} onChange={(e) => setCustomHex(e.target.value)} />
              <button
                type="button"
                onClick={() => {
                  customColorCounter += 1
                  const name = `custom${customColorCounter}`
                  store.defineColor(name, customHex)
                  store.recolor(node.id, name)
                }}
              >
                + couleur personnalisée
              </button>
            </div>
          </div>

          <div className="field placement-row">
            <label>
              Angle (°)
              <input
                type="number"
                value={node.grow ?? 0}
                onChange={(e) => store.move(node.id, { grow: Number(e.target.value), distance: node.distance ?? 4 })}
              />
            </label>
            <label>
              Distance (cm)
              <input
                type="number"
                step={0.5}
                value={node.distance ?? 4}
                onChange={(e) => store.move(node.id, { grow: node.grow ?? 0, distance: Number(e.target.value) })}
              />
            </label>
          </div>

          <button type="button" className="danger" onClick={() => store.removeNode(node.id)}>
            Supprimer ce nœud (et ses enfants)
          </button>
        </>
      )}
    </div>
  )
}
