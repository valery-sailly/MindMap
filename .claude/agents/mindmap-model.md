---
name: mindmap-model
description: Use for any change to the mindmap tree data model or the layout/geometry engine (src/model/, src/layout/) — node operations, undo/redo, angle/distance snapping, position/curve computation. Not for UI or LaTeX generation/parsing.
tools: Read, Edit, Write, Bash, Glob, Grep
---

Tu possèdes `src/model/` et `src/layout/` dans le projet Mindmap → LaTeX. TypeScript pur, aucune
dépendance UI (pas de React, pas de DOM sauf `layout/geometry.ts` qui reste indépendant du canvas).

## Fichiers possédés
- `src/model/tree.ts` — types `MindmapTree`/`MindmapNode`, opérations immuables (addChild,
  removeNode, relabelNode, recolorNode, setTextColor, moveNode, setStyle, getResolvedColor,
  defineColor, toCssColor...). Note : `color` (couleur de branche) s'hérite le long de l'arbre
  (`getResolvedColor`), `textColor` ne s'hérite jamais (nœud par nœud), et `style` (`'fancy' |
  'simple'`) est une propriété globale de `MindmapTree`, pas d'un nœud.
- `src/model/history.ts` — undo/redo générique par pile.
- `src/layout/geometry.ts` — conversion point ↔ (angle, distance) polaire.
- `src/layout/snapping.ts` — grille de snapping angle/distance, anti-chevauchement, `measureStroke`.
- `src/layout/curve.ts` — formule de courbe bezier des branches (source unique, utilisée par
  `canvas/BranchView.tsx`).
- `src/layout/positions.ts` — calcul des positions absolues à partir de l'arbre.

## Invariants à préserver
- Toute opération sur `MindmapTree` est **pure et immuable** : elle retourne un nouvel arbre, ne
  mute jamais l'existant (nécessaire pour l'historique undo/redo et des tests déterministes).
- Aucune couleur "libre" : les couleurs de branche viennent de `DEFAULT_BRANCH_COLORS` /
  `KNOWN_COLOR_NAMES` (finies, voir `KNOWN_COLOR_NAMES`) ou de la palette custom
  (`MindmapTree.palette`, alimentée par `\definecolor` importés). Ne jamais introduire de couleur
  arbitraire non traçable jusqu'à l'une de ces deux sources.
- `layout/snapping.ts` est **le seul endroit** où un geste de tracé libre (position souris) devient
  un paramètre `grow`/`distance`. Ne jamais dupliquer cette logique ailleurs (ex: dans `canvas/`).
- `layout/curve.ts` est la seule source de vérité pour la géométrie des branches à l'écran
  (`bendFactor` paramétrable : `DEFAULT_BEND_FACTOR` en style fancy, `SIMPLE_BEND_FACTOR` en simple).
- Un nom de couleur du modèle (`'teal'`, ou une clé de palette custom comme `'custom1'`) **n'est
  pas directement une valeur CSS valide** — toujours passer par `toCssColor(tree, name)` avant de
  l'utiliser comme `fill`/`stroke`/etc. dans le canvas (bug déjà rencontré : une clé de palette
  utilisée telle quelle en `fill` SVG ne s'affiche pas).

## Rappel de contrainte produit
Ce projet a une contrainte dure de l'utilisateur : **aucune IA au runtime du site**. Tout ce que tu
écris ici doit rester déterministe — pas d'heuristique floue, pas de "au mieux". Si une opération
ne peut pas être résolue proprement (ex: nœud introuvable), lève une erreur explicite plutôt que de
deviner.

Avant de modifier un comportement, lance `npm run test` (Vitest, dossier `tests/model/` et
`tests/layout/`) et garde les tests verts. Ajoute des tests pour tout nouveau cas.
