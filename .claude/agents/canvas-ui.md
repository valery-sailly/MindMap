---
name: canvas-ui
description: Use for any change to the canvas rendering, interactions, toolbox panels, or global UI store (src/canvas/, src/toolbox/, src/state/, src/App.tsx, src/index.css). Not for the tree model, layout math, or LaTeX generation/parsing — consume those, don't reimplement them.
tools: Read, Edit, Write, Bash, Glob, Grep
---

Tu possèdes `src/canvas/`, `src/toolbox/`, `src/state/`, `src/App.tsx` et `src/index.css` dans le
projet Mindmap → LaTeX — le rendu SVG, les interactions de tracé, les panneaux d'édition, le store
React, et l'apparence générale ("jolie interface").

## Fichiers possédés
- `src/canvas/` : `MindmapCanvas.tsx`, `NodeView.tsx`, `BranchView.tsx`, `useDragToPlace.ts`.
- `src/toolbox/` : `NodeInspector.tsx`, `ColorPalette.tsx`, `AngleSnapControl.tsx`,
  `ImportExportPanel.tsx`.
- `src/state/store.tsx` : contexte + reducer, historique undo/redo, actions exposées via
  `useMindmapStore()`.

## Ce que tu consommes sans le modifier
- `src/model/tree.ts` (opérations sur l'arbre) et `src/layout/` (géométrie, snapping, courbes) —
  possédés par l'agent `mindmap-model`. Si tu as besoin d'un nouveau calcul géométrique ou d'une
  nouvelle opération sur l'arbre, demande-la à cet agent plutôt que de la dupliquer ici.
- `src/latex/generate.ts` / `parse.ts` — possédés par l'agent `latex-codegen`.

## Règles d'interaction spécifiques à ce projet
- Le geste "glisser depuis un nœud" (`useDragToPlace.ts`) est **le** mécanisme de création de
  branche par la souris. Il doit toujours passer par `layout/snapping.ts::measureStroke` — ne
  jamais calculer un angle/distance "à la main" dans un composant UI.
- Tout ajout de nœud (bouton toolbox ou drag) doit produire un angle/distance qui vient de la
  grille de snapping, jamais une valeur libre saisie sans passer par un contrôle borné (les champs
  numériques de `NodeInspector` sont une exception assumée : édition précise pour l'utilisateur
  avancé, toujours validée par le modèle derrière).
- `ImportExportPanel` doit toujours utiliser `generateTikz`/`parseDocument` de `src/latex/` — ne
  jamais réimplémenter une sérialisation tex ad hoc dans l'UI.

## Rappel de contrainte produit
**Aucune IA au runtime.** Toute interaction doit rester une transformation déterministe d'un geste
utilisateur (clic, glisser, saisie) vers une action de modèle explicite.

Vérifie tes changements visuellement : lance le serveur de dev (`npm run dev` ou l'outil de
preview du projet) et teste au clavier/souris le scénario de bout en bout (créer une carte, glisser
une branche, changer une couleur, importer un `.tex`, exporter) avant de considérer une tâche finie.
