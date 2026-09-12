# Grammaire TikZ `mindmap` supportée (v1)

Ce document est le contrat entre `generate.ts` (arbre → tex) et `parse.ts` (tex → arbre). Les deux
DOIVENT rester strictement synchronisés avec ce fichier. Toute évolution de la grammaire doit être
faite ici en premier, puis répercutée dans les deux modules et leurs tests de round-trip.

Principe directeur : **déterminisme, zéro devinette**. Tout ce qui n'est pas décrit ici est
rejeté par le parseur avec une erreur explicite (ligne/colonne), jamais interprété au mieux.

## Bloc reconnu

Un seul bloc mindmap par fichier, délimité par des marqueurs insérés automatiquement à la
première sauvegarde :

```
% MINDMAP:BEGIN
\resizebox{\linewidth}{!}{%
\begin{tikzpicture}[mindmap, ...]
  ...
\end{tikzpicture}
}%
% MINDMAP:END
```

L'enrobage `\resizebox{\linewidth}{!}{...}` (package `graphicx`, à ajouter par l'utilisateur dans
son préambule — non géré par cet outil) est **toujours émis par `generate.ts`**, pour que le
diagramme s'adapte automatiquement à la largeur de la page/frame qui l'inclut, quel que soit le
nombre de nœuds — pensé par défaut pour tenir sur une page en orientation paysage ou une slide
beamer. Il est **optionnel à l'analyse** : un `.tex` écrit à la main sans cet enrobage (juste le
`tikzpicture` nu) reste accepté par `parse.ts`.

Si les marqueurs sont absents (fichier `.tex` écrit à la main), le parseur cherche à la place le
premier `\begin{tikzpicture}[...]` dont les options contiennent `mindmap`. S'il en existe plusieurs,
c'est une erreur : l'utilisateur doit choisir dans l'UI, jamais de devinette automatique.

### Style global (`MindmapTree.style`)

Les options de `\begin{tikzpicture}[...]` n'ont que **deux formes canoniques possibles**, définies
dans `generate.ts::TIKZ_HEADER_OPTIONS` :

- `fancy` (défaut) : nœuds circulaires colorés, texte blanc par défaut — le style mindmap
  classique.
- `simple` : rectangles à coins légèrement arrondis, fond blanc, contour de la couleur de branche,
  texte noir par défaut — pensé pour un document formel/académique.

Le reste du bloc (`child[...]`, `node[...]`, couleurs, grow, distance) est **strictement
identique** entre les deux styles ; seule cette ligne d'options change. À l'analyse, `parse.ts`
compare le contenu des crochets à ces deux chaînes exactes (espaces normalisés) pour restaurer
`tree.style` ; toute autre chaîne d'options (fichier écrit à la main avec un style personnalisé)
n'est pas préservée et retombe sur `fancy` par défaut — cohérent avec le principe déjà admis que
les options de `tikzpicture` ne sont pas garanties byte-identiques à la réécriture.

Tout ce qui précède le bloc (prefix) et tout ce qui le suit (suffix) est conservé tel quel, au
byte près, lors d'une réécriture (mode B).

## Préambule optionnel : couleurs personnalisées

Avant le bloc, des lignes de la forme :

```
\definecolor{<nom>}{RGB}{<r>,<g>,<b>}
```

sont reconnues et ajoutées à la palette (`MindmapTree.palette`). `<nom>` : identifiant TeX valide
(`[A-Za-z][A-Za-z0-9]*`). `<r>,<g>,<b>` : entiers 0-255. Aucune autre forme de `\definecolor`
(`{HTML}`, `{cmyk}`, etc.) n'est supportée en v1.

## Nœud racine

```
\node[concept, root concept] (root) {<label>}
\node[concept, root concept, text=<couleur>] (root) {<label>}
```

`text=<couleur>` est optionnel, toujours en dernière position, même univers de couleurs que
`concept color` (voir plus bas). Absent = couleur de texte par défaut du style (`fancy` : blanc,
`simple` : noir — définie dans `every node/.style`, pas répétée sur chaque nœud).

Suivi directement des blocs `child{...}` (voir ci-dessous), terminé par `;`.

## Nœuds enfants (récursif)

```
child[concept color=<couleur>, grow=<angle>:1, level distance=<distance>cm]{
  node[concept] {<label>}
  child{ ... }
  child{ ... }
}
child[concept color=<couleur>, grow=<angle>:1]{
  node[concept, text=<couleur>] {<label>}
}
```

`node[concept]` peut être suivi d'une seule option `text=<couleur>` (jamais d'autre option) : la
couleur du texte de **ce nœud précis**. Contrairement à `concept color`, `text=` **ne s'hérite
pas** — chaque descendant garde le texte par défaut du style sauf s'il porte lui-même l'option.

Règles strictes :
- `grow=<angle>:1` est **obligatoire** et **explicite** sur chaque enfant. `grow cyclic` n'est
  jamais généré et fait échouer le parseur avec un message clair s'il est rencontré.
- `<angle>` : entier ou décimal, degrés, `0` = droite, sens trigonométrique.
- `level distance=<distance>cm` : nombre positif, une décimale (`generate.ts` formate toujours à
  1 décimale). Optionnel sur un enfant si identique à la distance par défaut du niveau : dans ce
  cas `generate.ts` l'omet, mais `parse.ts` doit accepter sa présence ou son absence.
- `concept color=<couleur>` : optionnel. Absent = le nœud hérite de la couleur résolue de son
  parent (voir `model/tree.ts::getResolvedColor`). `<couleur>` est soit un nom de la palette fixe
  (voir `model/tree.ts::DEFAULT_BRANCH_COLORS`, référencés par nom `mmColorN`), soit un nom déclaré
  via `\definecolor` dans le préambule. `text=<couleur>` (sur `node[...]`, voir plus bas) partage
  exactement le même univers de couleurs autorisées.
- Les options entre crochets peuvent apparaître dans n'importe quel ordre séparées par des virgules
  ; `generate.ts` les émet toujours dans l'ordre `concept color, grow, level distance` pour un
  diff stable.

## Labels

Texte brut uniquement. Un retour à la ligne littéral s'écrit `\\` dans le label. Aucune autre
commande LaTeX, macro, mode mathématique ou `\foreach` n'est supportée : le parseur échoue sur
toute séquence `\<lettres>` rencontrée à l'intérieur d'un `{...}` de label autre que `\\`.

## Ce qui est explicitement rejeté (v1)

- `grow cyclic` ou toute variante de croissance automatique.
- Mélanges de couleurs `color!40!color`.
- Plusieurs `tikzpicture` candidats sans bloc marqué.
- Toute commande/macro dans un label.
- `\definecolor` en dehors du modèle `{RGB}{r,g,b}`.

Ces cas produisent une erreur de parsing bloquante, jamais un résultat partiel silencieux.
