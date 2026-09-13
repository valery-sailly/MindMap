# Grammaire TikZ `mindmap` supportée (v2)

Ce document est le contrat entre `generate.ts` (arbre → tex) et `parse.ts` (tex → arbre). Les deux
DOIVENT rester strictement synchronisés avec ce fichier. Toute évolution de la grammaire doit être
faite ici en premier, puis répercutée dans les deux modules et leurs tests de round-trip.

Principe directeur : **déterminisme, zéro devinette**. Tout ce qui n'est pas décrit ici est
rejeté par le parseur avec une erreur explicite (ligne/colonne), jamais interprété au mieux.

## Historique : pourquoi pas le style `concept` de tikz mindmap ?

La v1 utilisait `\node[concept, root concept]` et `child[concept color=...]`, en s'appuyant sur le
style `concept` fourni par `\usetikzlibrary{mindmap}` pour l'apparence (cercle rempli, texte
blanc, couleur héritée le long des branches). **Vérifié par compilation réelle (`pdflatex`) que ce
n'est pas fiable** : `concept` est une *forme* PGF personnalisée qui peint elle-même son fond avec
la couleur active et **ignore silencieusement `draw=`, `fill=`, et les tentatives de
redéfinition via `every node/.style`** — impossible d'obtenir une case simple ou du texte nu à
partir de `concept`, quelles que soient les options ajoutées autour. `draw=concept color` échoue
même à la compilation sur la racine (`Undefined color 'concept color'`), cet alias n'existant que
dans la portée d'un `child[concept color=...]`.

La v2 abandonne entièrement `concept`/`concept color`/`root concept`. On garde `mindmap` **comme
bibliothèque de positionnement uniquement** (le mécanisme `child[grow=<angle>:1]` reste
inchangé et fonctionne parfaitement sans `concept`, vérifié par compilation), et on pilote
l'intégralité de l'apparence (case, bordure, texte, couleur des liens) avec des clés PGF/TikZ
standard (`rectangle`, `draw=`, `fill=`, `text=`, `edge from parent path=`, `edge from parent/.style=`),
qui elles respectent bien leurs valeurs. Toute couleur est désormais résolue et écrite
explicitement par `generate.ts` (via `model/tree.ts::getResolvedColor`), plus jamais par un
mécanisme d'héritage interne à `tikz`.

## Bloc reconnu

Un seul bloc mindmap par fichier, délimité par des marqueurs insérés automatiquement à la
première sauvegarde :

```
% MINDMAP:BEGIN
\begin{adjustbox}{max width=\linewidth, max totalheight=0.85\textheight, center}
\begin{tikzpicture}[mindmap, ...]
  ...
\end{tikzpicture}
\end{adjustbox}
% MINDMAP:END
```

L'enrobage `adjustbox` (package `adjustbox`, à ajouter par l'utilisateur dans son préambule — non
géré par cet outil) est **toujours émis par `generate.ts`**, pour que le diagramme s'adapte
automatiquement à la page/frame qui l'inclut, quel que soit le nombre de nœuds — pensé par défaut
pour tenir sur une page en orientation paysage ou une slide beamer. Contrainte **les deux
dimensions** (largeur et hauteur), contrairement à `\resizebox{\linewidth}{!}` (v1, abandonné) qui
ne contraignait que la largeur : **vérifié par compilation réelle** qu'un arbre asymétrique (une
branche qui pousse loin dans une direction) pouvait déborder sur une deuxième page avec
`\resizebox` seul. Il est **optionnel à l'analyse** : un `.tex` écrit à la main sans cet enrobage
(juste le `tikzpicture` nu), ou avec l'ancien enrobage `\resizebox`, reste accepté par `parse.ts`.

Si les marqueurs sont absents (fichier `.tex` écrit à la main), le parseur cherche à la place le
premier `\begin{tikzpicture}[...]` dont les options contiennent `mindmap`. S'il en existe plusieurs,
c'est une erreur : l'utilisateur doit choisir dans l'UI, jamais de devinette automatique.

Tout ce qui précède le bloc (prefix) et tout ce qui le suit (suffix) est conservé tel quel, au
byte près, lors d'une réécriture (mode B).

### Style global (`MindmapTree.style`)

Les options de `\begin{tikzpicture}[...]` n'ont que **deux formes canoniques possibles**, définies
dans `generate.ts::TIKZ_HEADER_OPTIONS` (vérifiées par compilation réelle) :

```
fancy:
mindmap, every node/.style={rectangle, rounded corners=3pt, align=center, inner sep=6pt, thin,
  draw=black, fill=white},
every child/.style={edge from parent path={(\tikzparentnode) -- (\tikzchildnode)},
  edge from parent/.style={draw, thin, black}}

simple:
mindmap, every node/.style={align=center},
every child/.style={edge from parent path={(\tikzparentnode) -- (\tikzchildnode)},
  edge from parent/.style={draw, thin, black}}
```

Différence unique entre les deux : `fancy` dessine une case (rectangle à coins arrondis, fond
blanc, bordure fine noire par défaut) autour de chaque nœud ; `simple` n'a ni forme ni bordure —
seul le texte est visible. Dans les deux cas, `edge from parent path` remplace le connecteur
organique par défaut de `mindmap` par un simple segment droit entre les deux nœuds, et la couleur
de ce segment est noire par défaut (redéfinissable par branche, voir plus bas).

Aucune police n'est imposée (pas de `font=`) : le texte hérite délibérément de la police courante
du document hôte (celle du préambule de l'utilisateur), pour rester visuellement cohérent avec le
reste du document plutôt que d'imposer une police différente pour le diagramme.

À l'analyse, `parse.ts` compare le contenu des crochets à ces deux chaînes exactes (espaces
normalisés) pour restaurer `tree.style` ; toute autre chaîne d'options (fichier écrit à la main
avec un style personnalisé) n'est pas préservée et retombe sur `fancy` par défaut — cohérent avec
le principe déjà admis que les options de `tikzpicture` ne sont pas garanties byte-identiques à la
réécriture.

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
\node (root) {<label>}
\node[text=<couleur>] (root) {<label>}
```

Les crochets `[...]` sont **entièrement omis** si aucune couleur de texte n'est définie sur la
racine (pas de `[]` vide). `text=<couleur>` sinon, seule option possible ici. Absent = texte noir
(couleur par défaut de LaTeX, jamais réécrite explicitement).

Suivi directement des blocs `child{...}` (voir ci-dessous), terminé par `;`.

## Nœuds enfants (récursif)

```
child[grow=<angle>:1]{
  node {<label>}
  child{ ... }
}
child[grow=<angle>:1, level distance=<distance>cm, edge from parent/.style={draw=<couleur>, thin}]{
  node[draw=<couleur>, text=<couleur>] {<label>}
  child{ ... }
}
```

Options de `child[...]`, dans cet ordre exact quand présentes :
1. `grow=<angle>:1` — **obligatoire**, toujours explicite. `<angle>` : entier ou décimal, degrés,
   `0` = droite, sens trigonométrique. `grow cyclic` n'est jamais généré et fait échouer le
   parseur avec un message clair s'il est rencontré.
2. `level distance=<distance>cm` — optionnel : `generate.ts` l'omet quand la distance vaut la
   valeur par défaut du niveau (`model/tree.ts::defaultDistanceForDepth`), mais `parse.ts` accepte
   sa présence ou son absence dans tous les cas. Nombre positif, une décimale.
3. `edge from parent/.style={draw=<couleur>, thin}` — optionnel : présent seulement quand la
   couleur résolue du nœud (`getResolvedColor`) diffère du noir par défaut. Colore le **lien** de
   ce nœud vers son parent, dans les deux styles.

Options de `node[...]`, dans cet ordre exact quand présentes :
1. `draw=<couleur>` — **uniquement en style `fancy`** (aucun sens en `simple`, qui n'a pas de
   bordure) ; présent seulement quand la couleur résolue diffère du noir par défaut. Colore la
   bordure de la case.
2. `text=<couleur>` — présent seulement si ce nœud précis a une couleur de texte explicite
   (`MindmapNode.textColor`). **Ne s'hérite pas**, contrairement à la couleur de branche : chaque
   descendant reste en texte par défaut sauf s'il porte lui-même l'option.

`<couleur>` (pour `draw=`, `text=`, et `edge from parent/.style={draw=...}`) est soit un nom de la
palette fixe (voir `model/tree.ts::DEFAULT_PALETTE_SEED`), soit un nom déclaré via `\definecolor`
dans le préambule — jamais une couleur "noir" explicite (le noir est toujours l'absence d'option,
pour un diff minimal).

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
- `concept`, `concept color`, `root concept` (grammaire v1, abandonnée — voir plus haut).

Ces cas produisent une erreur de parsing bloquante, jamais un résultat partiel silencieux.
