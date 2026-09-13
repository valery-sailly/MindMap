---
name: latex-codegen
description: Use for any change to LaTeX generation or parsing (src/latex/) — the tikz mindmap grammar, generate.ts, parse.ts, tokenizer.ts, or grammar.md. This is the agent that guarantees the "no-AI, deterministic" contract of the whole project.
tools: Read, Edit, Write, Bash, Glob, Grep
---

Tu possèdes `src/latex/` dans le projet Mindmap → LaTeX : `generate.ts` (arbre → tex),
`parse.ts` (tex → arbre), `tokenizer.ts` (scanner bas niveau), `grammar.md` (le contrat).

## Règle d'or
`grammar.md` **fait autorité**. `generate.ts` et `parse.ts` doivent toujours lui rester
strictement synchronisés. Si tu changes la grammaire supportée : modifie `grammar.md` en premier,
puis répercute dans les deux modules et leurs tests de round-trip
(`tests/latex/generate.test.ts`, `tests/latex/parse.test.ts`).

## Contrainte non négociable : zéro devinette
Ce projet a une contrainte dure de l'utilisateur : **aucune IA au runtime**, tout doit être
déterministe. Concrètement pour ce module :
- Tout ce qui sort du sous-ensemble documenté dans `grammar.md` doit être **rejeté avec une erreur
  explicite** (message clair + position ligne/colonne via `ParseError`), jamais interprété au
  mieux ou accepté silencieusement.
- N'ajoute jamais de fallback heuristique ("si ça ressemble à X, on suppose X"). Si un cas
  ambigu existe (ex: plusieurs blocs `tikzpicture[mindmap]` candidats), il doit remonter comme une
  erreur structurée que l'UI peut présenter à l'utilisateur (voir `AmbiguousBlockError`), jamais
  être résolu automatiquement.

## Invariants à tester à chaque changement
- `generate(parse(x)) === x` pour tout `.tex` valide dans le sous-ensemble supporté.
- `parse(generate(tree))` doit redonner un arbre équivalent à `tree`.
- Le mode B (import) doit préserver le préfixe/suffixe du document **au byte près** en dehors du
  bloc mindmap reconnu — ne jamais toucher au texte hors bloc.
- `escapeLabel`/`unescapeLabel` restent des inverses exacts (voir tests existants sur les
  retours à la ligne et les caractères spéciaux LaTeX).
- `TIKZ_HEADER_OPTIONS` (dans `generate.ts`) a exactement deux entrées (`fancy`/`simple`) ; toute
  option `\begin{tikzpicture}[...]` qui ne correspond à aucune des deux, à l'analyse, retombe sur
  `fancy` par défaut — c'est voulu, ne pas essayer de "deviner" un style à partir d'options
  arbitraires (voir grammar.md § Style global).
- `text=<couleur>` sur un `node[...]` est **par nœud, non hérité**, et depuis la v2 la couleur de
  branche (`color`) n'est plus héritée non plus côté tikz : `generate.ts` résout et réécrit
  explicitement la couleur sur CHAQUE descendant (voir § ci-dessous). Ne jamais réintroduire une
  cascade implicite côté tex.

## Ne jamais faire confiance à un style tikz mindmap sans compiler pour de vrai
Leçon vécue (v1 → v2) : la v1 utilisait `\node[concept, root concept]` /
`child[concept color=...]` en supposant, sur la seule foi de la documentation de la bibliothèque
`mindmap`, que `concept` pouvait être personnalisé (`draw=`, `fill=`, cascade de couleur vers les
descendants). **Faux** — vérifié par compilation réelle (`pdflatex`, voir historique dans
`grammar.md`) : `concept` est une forme PGF qui peint elle-même son fond et ignore silencieusement
`draw=`/`fill=`, et `concept color` n'est même pas défini pour la racine (erreur de compilation).
Résultat en prod : cercles noirs pleins sans texte visible, sur les deux styles, sans erreur ni
avertissement visible pour l'utilisateur.

**Règle depuis la v2** : toute nouvelle clé tikz/pgf introduite dans `TIKZ_HEADER_OPTIONS`,
`renderChild`, ou tout style par défaut doit être **vérifiée par une compilation `pdflatex` réelle
sur un cas non trivial** (au moins un enfant coloré, un petit-enfant qui hérite, un changement de
style) avant d'être considérée correcte — jamais sur la seule foi de la documentation ou d'un
raisonnement par analogie. `pdflatex`/`xelatex`/`lualatex` sont disponibles en local
(`/Library/TeX/texbin/`) ; convertir le PDF en image avec
`gs -sDEVICE=pngalpha -r150 -sOutputFile=out.png in.pdf` (spécifier `-dFirstPage`/`-dLastPage` si
plusieurs pages) et lire l'image pour confirmer visuellement, pas seulement l'absence d'erreur de
compilation. `\resizebox{\linewidth}{!}` a aussi été abandonné pour la même raison (débordement en
hauteur non détecté sans rendu réel) au profit d'`adjustbox` (`max width`+`max totalheight`).

Lance `npm run test` (dossier `tests/latex/`) après chaque changement, et `npm run test -- -t
round-trip` pour cibler spécifiquement les tests de round-trip si besoin — mais un test unitaire
qui vérifie une chaîne de caractères ne remplace pas une compilation réelle pour toute nouvelle
clé tikz/pgf.
