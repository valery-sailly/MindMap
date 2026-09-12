# Mindmap → LaTeX

Éditeur graphique de cartes mentales qui génère du code LaTeX (`tikz mindmap`) — et inversement.
Site 100% statique, **aucune IA au runtime** : la conversion carte ↔ `.tex` est entièrement
déterministe.

## Principe

- **Mode « construction pure »** : partez d'une carte vide, ajoutez des branches en faisant
  glisser depuis un nœud (ou via le bouton « + Ajouter un enfant »), coloriez, éditez le texte.
  Chaque geste de tracé est mesuré et **snappé** sur une grille d'angles/distances (réglable dans
  la toolbox) avant de devenir un paramètre `grow=<angle>:1` — jamais d'interprétation floue.
- **Mode « importer un .tex »** : collez un document contenant déjà une mindmap `tikz`. Il est
  analysé par un parseur classique (pas d'IA), affiché graphiquement, éditable, puis réexporté en
  ne modifiant que le bloc reconnu — le reste du fichier est préservé au byte près.
- Le `.tex` généré est toujours enrobé dans `\resizebox{\linewidth}{!}{...}` pour tenir sur une
  page en orientation paysage ou une slide beamer, quel que soit le nombre de nœuds. Ça nécessite
  `\usepackage{graphicx}` dans votre document (à ajouter vous-même, non géré par cet outil).

Le sous-ensemble de TikZ `mindmap` réellement supporté (et donc les limites du parseur) est
documenté précisément dans [`src/latex/grammar.md`](src/latex/grammar.md). Ce fichier fait
autorité : `generate.ts` et `parse.ts` doivent toujours lui rester strictement conformes.

## Limites connues (v1)

- Le canvas SVG est une approximation visuelle du rendu tikz mindmap réel, pas un rendu
  pixel-parfait du PDF compilé (pas de moteur LaTeX côté client).
- Un seul bloc mindmap par fichier `.tex`.
- `grow cyclic` et les mélanges de couleurs (`color!40!color`) ne sont pas supportés : rejetés
  avec un message clair plutôt qu'interprétés au mieux.

## Développement

```bash
npm install
npm run dev        # serveur de développement
npm run test       # tests unitaires + tests de round-trip LaTeX (Vitest)
npm run build      # build statique de production
```

## Déploiement

Le dépôt est configuré pour GitHub Pages via `.github/workflows/deploy.yml` (build sur push vers
`main`, déploiement automatique). Le `base` de Vite est fixé à `/MindMap/` dans
`vite.config.ts` pour correspondre à l'URL `https://<utilisateur>.github.io/MindMap/` — à adapter
si le dépôt est renommé.

## Structure

```
src/
  model/    arbre de la mindmap (types, opérations pures, undo/redo)
  layout/   géométrie, snapping angle/distance, courbe des branches, calcul des positions
  latex/    génération et analyse du tikz mindmap (grammar.md fait autorité)
  canvas/   rendu SVG et interactions de tracé
  toolbox/  panneaux d'édition (inspecteur, palette, import/export)
  state/    store React (contexte + reducer, historique undo/redo)
tests/      tests unitaires, miroir de src/
```

Voir aussi `.claude/agents/` pour les agents dédiés à chaque module de ce projet.
