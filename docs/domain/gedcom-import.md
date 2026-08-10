# Import GEDCOM

Ce document définit les versions de GEDCOM ciblées par Genealaine, le périmètre
fonctionnel du premier import et les principes d'architecture qui permettront
de faire évoluer leur prise en charge.

Il sert également de tableau de compatibilité maintenable pour les logiciels et
services susceptibles de produire les fichiers importés.

## Versions prises en charge

La première version de l'import ciblera les deux formats suivants :

| Version GEDCOM | Niveau de prise en charge prévu                                                       | Référence                                                                                              |
| -------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `5.5.1`        | Import complet du périmètre initial                                                   | [Spécification GEDCOM 5.5.1](https://gedcom.io/specifications/ged551.pdf)                              |
| `7.0`          | Import complet du périmètre initial, implémenté à partir de la spécification `7.0.18` | [Spécification FamilySearch GEDCOM 7.0.18](https://gedcom.io/specifications/FamilySearchGEDCOMv7.html) |

Le choix de ces deux familles de versions et leur isolation dans des parseurs
dédiés sont actés par
l'[ADR 0010](../adr/0010-support-gedcom-551-and-70-with-dedicated-parsers.md).

Pour GEDCOM 7, `7.0.18` désigne la révision de la spécification utilisée pour
développer et tester l'import. Les versions correctives `7.0.x` clarifient la
spécification sans modifier le format des données. L'import devra donc accepter
un en-tête déclarant `7.0` ou une version `7.0.x`, et non uniquement la chaîne
exacte `7.0.18`.

GEDCOM 5.5 et les versions antérieures ne font pas partie du contrat initial.
Elles pourront être ajoutées ultérieurement à partir de fichiers représentatifs
et sans relâcher silencieusement les règles de validation de GEDCOM 5.5.1.

## Compatibilité des logiciels et services

Ce tableau distingue les informations garanties par une documentation
officielle de celles observées dans un export. Il doit être revu lorsque l'un
des producteurs change son format.

| Producteur               | Export GEDCOM connu                                         | Import GEDCOM connu                                          | État de la vérification                                                                                   | Dernière vérification |
| ------------------------ | ----------------------------------------------------------- | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- | --------------------- |
| Heredis                  | `5.5.1`                                                     | `5.5.1` et GEDCOM 7 depuis Heredis 2023                      | [Documentation officielle](https://help.heredis.com/quest-ce-quun-gedcom/)                                | 2026-07-30            |
| MyHeritage               | `5.5.1` dans l'exemple d'export publié                      | Non précisé                                                  | [Exemple officiel](https://www.myheritage.com/wiki/How_to_work_with_GEDCOM_files)                         | 2026-07-30            |
| Geneanet                 | `5.5.1` observé ; la version n'est pas annoncée dans l'aide | Non précisé                                                  | Export représentatif à ajouter aux tests                                                                  | 2026-07-30            |
| Filae                    | Non précisé                                                 | Non précisé                                                  | Export représentatif requis                                                                               | 2026-07-30            |
| Ancestry                 | Non précisé                                                 | Non précisé                                                  | Export représentatif requis                                                                               | 2026-07-30            |
| Gramps                   | `5.5.1`                                                     | `5.5.1` ; GEDCOM 7 expérimental                              | [Documentation officielle](https://www.gramps-project.org/wiki/index.php/Features)                        | 2026-07-30            |
| Ancestris 12             | `5.5`, `5.5.1` ou `7.0` selon le fichier choisi             | `5.5`, `5.5.1` et `7.0`                                      | [Documentation officielle](https://docs.ancestris.org/books/mode-demploi/page/convertir-le-format-gedcom) | 2026-07-30            |
| FamilySearch Family Tree | Pas d'export GEDCOM direct                                  | Versions jusqu'à `5.5.1` pour le service d'envoi de fichiers | [Documentation officielle](https://www.familysearch.org/en/help/helpcenter/article/what-is-a-gedcom-file) | 2026-07-30            |

La valeur réellement déclarée par un fichier reste la source de vérité. Elle
est lue dans son en-tête :

```gedcom
0 HEAD
1 GEDC
2 VERS 5.5.1
2 FORM LINEAGE-LINKED
1 CHAR UTF-8
```

Lorsqu'un fichier représentatif est ajouté aux tests, le tableau doit être
complété avec :

- la version et le nom du logiciel producteur ;
- la valeur de `HEAD.GEDC.VERS` ;
- la valeur de `HEAD.CHAR` lorsqu'elle existe ;
- la présence de tags propriétaires ;
- le type de conteneur, par exemple `.ged`, archive ZIP classique ou GEDZIP.

Les fichiers de test doivent rester synthétiques ou préalablement anonymisés.

## Formats et encodages

La première version acceptera les flux GEDCOM contenus dans un fichier `.ged`.
Le conteneur GEDZIP `.gdz` de GEDCOM 7, qui peut embarquer des médias, est
reporté jusqu'à la prise en charge effective des médias.

GEDCOM 7 utilise exclusivement UTF-8. Pour GEDCOM 5.5.1, UTF-8 est obligatoire
dans le premier contrat. ANSEL et les encodages propriétaires comme
Windows-1252 ne sont pas pris en charge. Le site demande explicitement un
export UTF-8 et un autre encodage produit une erreur avant l'analyse des
données.

Le contrat et les diagnostics sont détaillés dans la
[note technique sur la détection des fichiers GEDCOM](../technical/gedcom-file-detection.md).

## Périmètre initial

| Catégorie           | Prise en charge initiale                                                                                           |
| ------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Personnes           | Importées : noms, genre, naissance, décès et lieux associés, dans la limite du modèle Genealaine                   |
| Filiations          | Importées sous forme de relations parent-enfant, avec une correspondance prudente de `PEDI`                        |
| Relations de couple | Importées après la conception du modèle métier Genealaine correspondant                                            |
| Événements          | Naissance, décès, mariage et divorce importés ; les autres événements sont reconnus et signalés comme non importés |
| Sources             | Analysées et comptabilisées, mais non persistées tant que leur modèle métier n'existe pas                          |
| Médias              | Références analysées et comptabilisées, mais fichiers et références non persistés dans la première version         |
| Extensions          | Détectées et présentées comme reconnues, ambiguës ou ignorées ; jamais interprétées silencieusement                |

Un fichier peut être valide tout en contenant des éléments hors périmètre.
Ceux-ci ne doivent pas provoquer une perte silencieuse : l'analyse et le
rapport final doivent indiquer leur quantité, leur emplacement et la raison
pour laquelle ils ne sont pas importés.

Le contrat HTTP, les compteurs et les règles de classement actuellement
appliquées sont détaillés dans la
[note technique sur l'analyse](../technical/gedcom-import-analysis.md).
Les choix qui transforment ensuite le document normalisé en personnes,
filiations, relations et événements Genealaine sont définis dans la
[note technique sur les correspondances](../technical/gedcom-to-genealaine-mapping.md).

## Architecture de parsing

Les deux versions partagent le pipeline d'import, mais pas toutes leurs règles
de syntaxe et de validation. Elles seront isolées derrière une interface
commune, avec des implémentations dédiées, par exemple :

```text
GedcomVersionDetector
        |
        +-- Gedcom551Parser --+
        |                    |
        +-- Gedcom7Parser ----+--> NormalizedGedcomDocument
                                      |
                                      +--> validation métier
                                      +--> analyse
                                      +--> correspondances Genealaine
                                      +--> import transactionnel
```

Le détecteur ne lit que l'en-tête nécessaire pour choisir l'implémentation. Il
ne tente pas de deviner une version absente ou invalide à partir du reste du
fichier.

Chaque parseur est responsable :

- de la grammaire propre à sa version ;
- des encodages permis par son contrat ;
- des structures et cardinalités définies par la spécification ;
- de la traduction vers un document intermédiaire normalisé ;
- de la remontée des tags inconnus ou propriétaires sans les supprimer.

Le document intermédiaire ne dépend pas de GEDCOM 5.5.1 ou 7. Il permet
d'appliquer une seule fois les validations métier, l'analyse, la
détection des doublons et l'import transactionnel.

Cette séparation doit rester explicite : une différence entre les deux normes
est traitée dans le parseur concerné, et non par une accumulation de conditions
de version dans le reste du pipeline.

Le contrat détaillé des structures intermédiaires, des diagnostics et des
parseurs est défini dans la
[note technique sur le modèle GEDCOM normalisé](../technical/gedcom-normalized-model.md).
L'implémentation et les limites propres à la première version sont détaillées
dans la [note sur le parseur GEDCOM 5.5.1](../technical/gedcom-551-parser.md).
Les écarts de syntaxe et de structure de la version moderne sont détaillés dans
la [note sur le parseur GEDCOM 7](../technical/gedcom-7-parser.md).
Le contrat commun exposé après la sélection du parseur est détaillé dans la
[note sur l'analyse d'un import](../technical/gedcom-import-analysis.md).
La projection métier commune aux deux versions est détaillée dans la
[note sur les correspondances GEDCOM vers Genealaine](../technical/gedcom-to-genealaine-mapping.md).
La prévisualisation, la détection des doublons et le réimport sont régis par
l'[ADR 0012](../adr/0012-preview-and-reimport-gedcom-from-persistent-sources.md).
Leur modèle de persistance, leur cycle de confirmation et leur stratégie de
tests sont détaillés dans la
[note technique de l'import transactionnel](../technical/gedcom-transactional-import.md).

## Mise à jour de ce document

Le tableau de compatibilité doit être revu :

- lors de l'ajout d'un fichier de test provenant d'un nouveau producteur ;
- lorsqu'une nouvelle version d'un logiciel ciblé est publiée ;
- lorsqu'une nouvelle révision de GEDCOM 7 est publiée ;
- lorsqu'un encodage, un conteneur ou une extension propriétaire est ajouté au
  contrat d'import.

Une mise à jour de la colonne « Dernière vérification » doit être accompagnée
d'une source officielle ou d'un fichier synthétique reproduisant l'en-tête et
les structures particulières observées.
