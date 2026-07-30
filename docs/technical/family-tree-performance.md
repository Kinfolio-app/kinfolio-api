# Performance de la consultation familiale

Ce document rassemble les données et mesures utilisées pour évaluer la route
de consultation d'une branche familiale. Il ne contient aucune donnée
personnelle issue des fichiers de benchmark.

## Jeu de données réel

- **Date de l'analyse :** 2026-07-30
- **Format :** GEDCOM 5.5.1 encodé en UTF-8
- **Taille du fichier :** 4 747 059 octets
- **Nombre de lignes :** 265 066
- **Lignes non reconnues :** 0

Le fichier source est conservé localement dans
`test/fixtures/private/gedcom` et ignoré par Git.

L'analyse structurelle lit uniquement les enregistrements `INDI` et `FAM`
ainsi que les références `HUSB`, `WIFE` et `CHIL`. Les noms, dates, lieux,
notes et autres données personnelles ne sont ni extraits ni reportés.

## Structure du graphe

| Mesure                                         |                            Valeur |
| ---------------------------------------------- | --------------------------------: |
| Personnes                                      |                             9 458 |
| Familles GEDCOM                                |                             2 495 |
| Relations parent-enfant distinctes             |                            10 657 |
| Plus grande composante parent-enfant           |                   6 576 personnes |
| Composantes connexes                           |                             2 482 |
| Personnes isolées dans le graphe parent-enfant |                             2 332 |
| Profondeur générationnelle maximale            | 20 relations, soit 21 générations |
| Cycles détectés                                |                                 0 |
| Références parent ou enfant manquantes         |                                 0 |

Les personnes isolées peuvent notamment appartenir à des familles sans enfant.
Les relations de couple ne sont pas incluses dans ce graphe, car Kinfolio ne les
modélise pas encore.

## Densité

| Mesure                         | Médiane | 95e percentile | Maximum |
| ------------------------------ | ------: | -------------: | ------: |
| Parents connus par personne    |       2 |              2 |       2 |
| Enfants connus par personne    |       0 |              7 |      19 |
| Parents référencés par famille |       2 |              2 |       2 |
| Enfants référencés par famille |       1 |              8 |      16 |

## Personnes atteignables

Les nombres suivants incluent la personne racine. Ils décrivent des personnes
uniques atteignables et non le nombre de chemins produits par la CTE récursive.

### Profondeur 3

| Direction     | Médiane | 95e percentile | Maximum |
| ------------- | ------: | -------------: | ------: |
| `ancestors`   |       3 |             15 |      15 |
| `descendants` |       1 |             22 |      74 |
| `both`        |      16 |             46 |     113 |

Aucune racine ne dépasse la limite de 500 personnes à cette profondeur.

### Profondeur 5

| Direction     | Médiane | 95e percentile | Maximum |
| ------------- | ------: | -------------: | ------: |
| `ancestors`   |       3 |             31 |      63 |
| `descendants` |       1 |             39 |     124 |
| `both`        |      37 |            134 |     373 |

Aucune racine ne dépasse la limite de 500 personnes à cette profondeur.

### Profondeur 10

| Direction     | Médiane | 95e percentile | Maximum | Racines au-dessus de 500 |
| ------------- | ------: | -------------: | ------: | -----------------------: |
| `ancestors`   |       3 |             56 |     934 |                       25 |
| `descendants` |       1 |             97 |     225 |                        0 |
| `both`        |     192 |            832 |   3 758 |                    1 175 |

## Premières conclusions

- La profondeur par défaut de `3` produit des graphes nettement inférieurs à
  la limite de 500 personnes sur ce jeu de données.
- Le parcours `descendants` reste inférieur à 500 personnes, même à profondeur
  `10`.
- Certains parcours `ancestors` à profondeur `10` dépassent la limite.
- `both` à profondeur `10` constitue le principal scénario de charge : plus de
  12 % des racines dépassent 500 personnes et le maximum atteint 3 758
  personnes uniques avant limitation.
- La limite de réponse à 500 personnes est donc utile, mais elle ne garantit
  pas à elle seule que la CTE effectue peu de travail.

## Chargement anonymisé

Le script `scripts/benchmarks/load-gedcom-topology.ts` charge uniquement la
topologie dans `kinfolio_benchmark`. Il :

- refuse toute autre base de données ;
- exige `--replace` lorsque la base contient déjà des données ;
- remplace les identifiants GEDCOM par des UUID générés localement ;
- utilise uniquement des noms artificiels ;
- ignore les noms, dates, lieux, notes, sources et médias du GEDCOM ;
- utilise `unspecified` pour toutes les filiations ;
- vérifie l'anonymisation et les totaux avant de valider la transaction.

La commande manuelle est :

```shell
npm run benchmark:load-gedcom -- \
  test/fixtures/private/gedcom/large-family-tree.ged \
  --replace
```

Le chargement local du 2026-07-30 a produit :

| Mesure                         |         Valeur |
| ------------------------------ | -------------: |
| Personnes anonymes insérées    |          9 458 |
| Relations insérées             |         10 657 |
| Relations dupliquées ignorées  |              0 |
| Temps de parsing               |  environ 52 ms |
| Temps de chargement PostgreSQL | environ 219 ms |

Ces durées décrivent uniquement la machine locale utilisée pour le
développement et ne constituent pas encore un objectif de performance.

## Benchmark de la requête

Le script `scripts/benchmarks/benchmark-family-tree.ts` sélectionne quatre
profils sans conserver leur identifiant dans le rapport :

1. un profil médian pour `both` à profondeur `3` ;
2. le profil ayant le plus d'ancêtres à profondeur `10` ;
3. le profil ayant le plus de descendants à profondeur `10` ;
4. le profil ayant la plus grande branche `both` à profondeur `10`.

Chaque profil est testé aux profondeurs `1`, `3`, `5` et `10`. Le script
exécute la méthode réelle du repository une première fois, puis cinq fois pour
mesurer les appels à chaud. Il lance ensuite
`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` sur la requête SQL capturée depuis le
repository. Une limite de cinq secondes par instruction protège la machine de
développement contre un parcours pathologique.

La commande est :

```shell
npm run benchmark:family-tree
```

### Profils sélectionnés

| Profil                 | Direction     | Profondeur de sélection | Personnes atteignables |
| ---------------------- | ------------- | ----------------------: | ---------------------: |
| Typique                | `both`        |                       3 |                     16 |
| Maximum ancêtres       | `ancestors`   |                      10 |                    934 |
| Maximum descendants    | `descendants` |                      10 |                    225 |
| Maximum bidirectionnel | `both`        |                      10 |                  3 758 |

### Résultats du 2026-07-30

Les temps du repository sont les médianes de cinq exécutions à chaud. Le temps
SQL vient de `EXPLAIN ANALYZE`. La taille correspond au résultat sérialisé du
repository, avant l'enveloppe HTTP du service.

| Profil                 | Profondeur | Repository |         SQL | Lignes récursives | Personnes retournées | Taille |
| ---------------------- | ---------: | ---------: | ----------: | ----------------: | -------------------: | -----: |
| Typique                |          1 |    4,37 ms |     3,96 ms |                10 |                    4 |   2 Ko |
| Typique                |          3 |    4,04 ms |     3,11 ms |                56 |                   16 |  10 Ko |
| Typique                |          5 |    2,32 ms |     2,07 ms |               257 |                   32 |  22 Ko |
| Typique                |         10 |   20,38 ms |    21,46 ms |            10 812 |                  298 | 206 Ko |
| Maximum ancêtres       |          1 |    0,59 ms |     0,07 ms |                 7 |                    3 |   2 Ko |
| Maximum ancêtres       |          3 |    0,57 ms |     0,18 ms |                31 |                   15 |   9 Ko |
| Maximum ancêtres       |          5 |    1,18 ms |     0,60 ms |               116 |                   61 |  36 Ko |
| Maximum ancêtres       |         10 |    7,44 ms |     5,12 ms |             1 246 |                  500 | 294 Ko |
| Maximum descendants    |          1 |    0,60 ms |     0,53 ms |                12 |                    3 |   2 Ko |
| Maximum descendants    |          3 |    1,20 ms |     0,87 ms |                90 |                   52 |  30 Ko |
| Maximum descendants    |          5 |    2,15 ms |     1,38 ms |               171 |                  124 |  73 Ko |
| Maximum descendants    |         10 |    3,65 ms |     2,10 ms |               238 |                  225 | 133 Ko |
| Maximum bidirectionnel |          1 |    1,35 ms |     1,20 ms |                20 |                    5 |   3 Ko |
| Maximum bidirectionnel |          3 |    2,23 ms |     1,88 ms |               255 |                   45 |  30 Ko |
| Maximum bidirectionnel |          5 |    9,05 ms |     7,80 ms |             2 873 |                  311 | 212 Ko |
| Maximum bidirectionnel |         10 |  929,17 ms | 1 040,92 ms |           513 482 |                  500 | 343 Ko |

Les deux parcours limités à 500 personnes ont correctement retourné
`size_limit`. Aucun scénario n'a dépassé la limite de cinq secondes.

Toutes les lectures du plan de confirmation provenaient du cache PostgreSQL :
aucun bloc n'a été lu depuis le disque. Le scénario bidirectionnel maximal à
profondeur `10` a néanmoins touché 3 345 561 blocs partagés en cache, contre
16 912 à profondeur `5`.

## Conclusion du benchmark

- La profondeur par défaut de `3` reste rapide, y compris pour le profil
  bidirectionnel le plus dense : environ `2,2 ms` dans le repository.
- Les parcours maximaux `ancestors` et `descendants` restent sous `8 ms` à
  profondeur `10`.
- Le cas problématique est `both` à profondeur `10`. Il approche une seconde
  sur la machine locale, même avec toutes les données en cache.
- La limite de 500 protège la taille de la réponse, mais intervient après le
  parcours. Elle ne limite donc pas les 513 482 chemins intermédiaires produits
  par la CTE.
- Les index existants permettent des parcours directionnels rapides. Le coût
  dominant du cas `both` vient de la multiplication des chemins avant la
  déduplication des personnes atteignables.

Avant d'envisager une utilisation intensive de `both` à grande profondeur, il
faudra comparer la requête actuelle avec une variante qui déduplique les
personnes pendant la récursion plutôt qu'après celle-ci. Cette optimisation
devra conserver les résultats fonctionnels et les informations de troncature.

Les mesures HTTP et les essais avec un cache réellement froid restent à faire.
Ils permettront d'évaluer le coût de Fastify, de la sérialisation et des
lectures disque. Ils ne devraient toutefois pas modifier le diagnostic sur la
multiplication des chemins récursifs.
