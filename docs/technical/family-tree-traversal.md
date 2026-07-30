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

La CTE récursive `traversal` contient une ligne par chemin parcouru :

| Colonne     | Rôle                                        |
| ----------- | ------------------------------------------- |
| `person_id` | Personne atteinte pendant le parcours.      |
| `depth`     | Distance depuis la personne racine.         |
| `path`      | Identifiants déjà rencontrés sur ce chemin. |

Elle démarre toujours avec la personne racine :

```text
Alice, depth 0, path [Alice]
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

## Protection contre les retours en arrière

Le parcours vérifie que la personne suivante n'est pas déjà présente dans
`path`. Cette protection est particulièrement nécessaire pour `both` : sans
elle, PostgreSQL pourrait suivre `Alice → Marie → Alice → Marie` jusqu'à la
limite de profondeur.

Cette protection porte sur un chemin individuel. Deux chemins distincts
peuvent donc atteindre un même ancêtre, ce qui est nécessaire lorsqu'ils
rejoignent une branche commune.

## Déduplication et profondeur retenue

Après le parcours, `reachable_people` regroupe les lignes par personne et
conserve la profondeur minimale. Une personne présente dans deux branches est
donc renvoyée une seule fois dans `people`.

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

`path` évite les boucles, mais plusieurs chemins peuvent exister dans une
branche très dense. Une limite du nombre de personnes et des mesures sur de
grands graphes restent nécessaires. Elles relèvent des points suivants de la
phase 4.
