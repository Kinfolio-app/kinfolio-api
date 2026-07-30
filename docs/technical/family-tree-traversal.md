# Parcours récursif d'une branche familiale

Cette note explique la requête utilisée par `FamilyTreeRepository` pour
consulter une branche familiale. Le format de réponse est défini dans
l'[ADR 0008](../adr/0008-represent-family-branches-as-graphs.md).

## Pourquoi `WITH RECURSIVE`

La table `parent_child_relationships` ne stocke que des liens directs : un
parent et un enfant. Une requête ordinaire permet de récupérer les parents
d'une personne, mais ne poursuit pas automatiquement vers les grands-parents,
puis les générations suivantes.

`WITH RECURSIVE` permet à PostgreSQL de répéter une même étape de parcours
jusqu'à ce qu'aucune nouvelle personne ne soit atteinte ou qu'une limite soit
atteinte. Cela évite d'exécuter une requête distincte pour chaque génération.

## La CTE `traversal`

La CTE récursive `traversal` contient au maximum une ligne pour une même
personne à une même profondeur :

| Colonne     | Rôle                                   |
| ----------- | -------------------------------------- |
| `person_id` | Personne atteinte pendant le parcours. |
| `depth`     | Distance depuis la personne racine.    |

Elle démarre toujours avec la personne racine :

```text
Alice, depth 0
```

Puis la partie récursive recherche la personne suivante pour chaque ligne déjà
trouvée.

| Direction     | Relation suivie                                  |
| ------------- | ------------------------------------------------ |
| `ancestors`   | de l'enfant vers ses parents                     |
| `descendants` | du parent vers ses enfants                       |
| `both`        | vers l'autre extrémité de toute relation directe |

Avec Alice et deux parents, une demande `ancestors` à profondeur `1`
produit :

```text
Alice, depth 0
Marie, depth 1
Paul,  depth 1
```

La réponse contient donc Alice, Marie et Paul. Les grands-parents seraient à
la profondeur `2` et ne seraient pas inclus.

## Protection contre la multiplication des chemins

La partie initiale et la partie récursive sont réunies avec `UNION`.
PostgreSQL élimine ainsi les lignes identiques avant l'itération suivante. Si
deux chemins atteignent la même personne à la même profondeur, cette personne
n'est développée qu'une seule fois pour cette profondeur.

Cette déduplication est particulièrement utile pour `both`, qui peut revenir
sur une relation dans l'autre sens ou rejoindre une personne par plusieurs
branches. Une personne peut encore être rencontrée à des profondeurs
différentes, mais le parcours reste borné par la profondeur maximale demandée.

## Déduplication et profondeur retenue

Après le parcours, `reachable_people` regroupe les profondeurs éventuelles
d'une personne et conserve la profondeur minimale. Une personne présente dans
deux branches est donc renvoyée une seule fois dans `people`.

Par exemple, si Marie et Paul ont Diane comme mère :

```text
       Diane
      /     \\
  Marie     Paul
      \\     /
       Alice
```

Diane est atteinte par deux chemins, mais elle apparaît une seule fois dans le
graphe retourné.

## Profondeur et `truncated`

La personne racine est à profondeur `0`. Ses proches directs sont à
profondeur `1`, leurs proches directs à profondeur `2`, et ainsi de suite.

La route utilise une profondeur de `3` par défaut et accepte une profondeur
maximale de `10`.

La requête explore jusqu'à `depth + 1` : les personnes de cette génération
supplémentaire ne sont pas renvoyées, mais leur présence permet de savoir si le
résultat s'arrête avant la fin de la branche.

Ainsi, pour `depth = 1` :

- les personnes aux profondeurs `0` et `1` sont retournées ;
- la présence d'une personne à profondeur `2` définit `truncated: true` ;
- sinon, `truncated: false`.

## Limite du nombre de personnes

Une réponse contient au maximum `500` personnes. Après le parcours,
`candidate_people` trie les personnes par profondeur, puis par identifiant pour
obtenir un ordre déterministe. Il conserve temporairement jusqu'à `501`
personnes :

- les `500` premières deviennent `included_people` et sont retournées ;
- la présence de la personne supplémentaire produit la raison
  `size_limit`.

Ce tri garantit que la racine et les générations les plus proches sont
prioritaires. Les relations retournées ont toujours leurs deux extrémités dans
`included_people`.

Les raisons de troncature sont :

- `depth_limit` lorsqu'une personne existe au-delà de la profondeur demandée ;
- `size_limit` lorsque plus de `500` personnes existent dans la profondeur
  demandée.

Les deux raisons peuvent être présentes simultanément.

## Personnes supprimées logiquement

La personne racine et chaque personne atteinte doivent avoir `deleted_at IS
NULL`. Une personne supprimée ne figure pas dans le graphe et le parcours ne
continue pas au-delà d'elle. Ses relations ne sont donc pas exposées.

## Relations retournées

Après avoir déterminé les personnes incluses, la requête retourne les relations
dont le parent et l'enfant appartiennent tous les deux au graphe. Cela permet au
client de reconstruire une vue en arbre, une vue par générations ou une autre
présentation.

## Point d'attention pour les performances

La déduplication pendant la récursion évite de conserver une ligne distincte
pour chaque chemin. Sur le jeu de benchmark, elle a réduit de plus de 98 % les
lignes récursives du scénario bidirectionnel maximal à profondeur `10`.

La limite de `500` borne toujours uniquement la réponse finale : le parcours
peut atteindre davantage de personnes avant cette sélection. Les statistiques,
mesures et comparaisons sont regroupées dans la
[note de performance](family-tree-performance.md).
