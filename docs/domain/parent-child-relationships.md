# Liens parent-enfant

Ce document décrit le modèle métier des liens parent-enfant de Genealaine. Il
évoluera avec les besoins du produit, notamment lorsque les contraintes
d'intégrité et les opérations de l'API seront précisées.

## Direction d'une relation

Une relation est toujours orientée :

- `parentId` identifie le parent ;
- `childId` identifie l'enfant ;
- `relationshipType` décrit la nature du lien ;
- `evidenceStatus` décrit l'état de la preuve disponible.

Les termes père, mère, fils et fille ne constituent pas des types de relation.
L'API pourra les déterminer pour l'affichage à partir de la direction du lien
et du genre des personnes.

## Périmètre

Les relations de couple, comme le mariage ou l'union civile, seront nécessaires
pour représenter les conjoints dans l'arbre familial. Elles devront utiliser un
modèle distinct des liens parent-enfant afin de prendre en charge leur nature,
leurs dates et leur éventuelle fin.

Ce modèle distinct est décrit dans la
[note métier sur les relations de couple](couple-relationships.md).

## Types pris en charge

| Valeur        | Signification                                                           |
| ------------- | ----------------------------------------------------------------------- |
| `biological`  | Filiation biologique connue ou déclarée.                                |
| `adoptive`    | Filiation établie par une adoption.                                     |
| `step`        | Lien avec un beau-parent ou une belle-mère dans une famille recomposée. |
| `foster`      | Lien avec une famille d'accueil ou un responsable de tutelle.           |
| `other`       | Nature connue, mais non représentée par les autres valeurs.             |
| `unspecified` | Lien parental connu dont la nature n'est pas connue ou renseignée.      |

`other` et `unspecified` ne sont pas interchangeables. `other` indique que la
nature du lien est connue mais absente de la classification actuelle, tandis
que `unspecified` indique que cette nature est inconnue.

## État de la preuve

| Valeur       | Signification                                                |
| ------------ | ------------------------------------------------------------ |
| `unassessed` | La preuve n'a pas été évaluée ou n'est pas renseignée.       |
| `proven`     | Le fichier ou l'utilisateur déclare le lien comme prouvé.    |
| `challenged` | Le lien existe dans le graphe, mais sa preuve est contestée. |

L'état de la preuve ne remplace pas la nature de la relation. Une filiation
peut par exemple être `adoptive` et `challenged`.

## Stockage

Les relations sont stockées dans la table `parent_child_relationships` :

| Colonne             | Rôle                                                |
| ------------------- | --------------------------------------------------- |
| `id`                | Identifiant UUID de la relation.                    |
| `parent_id`         | Référence vers la personne qui joue le rôle parent. |
| `child_id`          | Référence vers la personne qui joue le rôle enfant. |
| `relationship_type` | Nature du lien, avec `unspecified` par défaut.      |
| `evidence_status`   | État de la preuve, avec `unassessed` par défaut.    |
| `created_at`        | Date de création de la relation.                    |
| `updated_at`        | Date de dernière modification de la relation.       |

Les clés étrangères utilisent `ON DELETE RESTRICT` afin qu'une future purge
physique d'une personne ne puisse pas supprimer silencieusement ses relations.
Un index sur `child_id` complète l'index créé par l'unicité de
`(parent_id, child_id)` pour permettre les parcours dans les deux directions.

## Compatibilité avec GEDCOM

Le modèle métier de Genealaine ne reprend pas directement les valeurs de
`PEDI` définies par GEDCOM 7. La valeur GEDCOM `BIRTH` est ambiguë : elle peut
désigner une filiation génétique ou une relation sociale au moment de la
naissance. Elle ne doit donc pas être automatiquement interprétée comme une
filiation biologique.

L'import GEDCOM applique les correspondances prudentes suivantes :

| GEDCOM                | Genealaine    |
| --------------------- | ------------- |
| `ADOPTED`             | `adoptive`    |
| `FOSTER`              | `foster`      |
| `BIRTH`               | `unspecified` |
| `OTHER`               | `other`       |
| `SEALING`             | `other`       |
| valeur `PEDI` absente | `unspecified` |

Une valeur `BIRTH` ne pourra devenir `biological` que si une autre information
fiable permet de confirmer explicitement la filiation biologique.

Le champ GEDCOM `STAT` est projeté séparément : absence vers `unassessed`,
`PROVEN` vers `proven` et `CHALLENGED` vers `challenged`. Un lien `DISPROVEN`
n'est pas planifié. Une valeur inconnue reste `unassessed` et produit une
ambiguïté à résoudre. Les règles complètes et les diagnostics sont décrits dans
la [note technique de correspondance](../technical/gedcom-to-genealaine-mapping.md).

La définition officielle de `PEDI` est disponible dans la
[spécification FamilySearch GEDCOM 7](https://gedcom.io/specifications/FamilySearchGEDCOMv7.html).

## Contraintes métier

Une relation ne peut être créée que si le parent et l'enfant existent et ne
sont pas supprimés logiquement.

Les règles suivantes s'appliquent :

- une personne ne peut pas être son propre parent ;
- une seule relation peut exister pour un couple orienté
  `(parentId, childId)` ;
- deux personnes ne peuvent donc pas cumuler plusieurs types de relation dans
  la même direction ;
- le nombre total de parents d'une personne n'est pas limité ;
- les dates de naissance et de décès ne bloquent pas la création d'une
  relation, car les données généalogiques peuvent être absentes, approximatives
  ou contradictoires ;
- une relation qui créerait un cycle direct ou indirect est interdite.

Une tentative de créer une relation existante ou cyclique produit une erreur
`409 Conflict`.

Lorsqu'une personne est supprimée logiquement, ses relations sont conservées en
base pour permettre une future restauration, mais elles ne sont plus exposées
par l'API publique.

## Détection des cycles

Seules les relations directes sont stockées. Avant d'insérer une relation
`parentId → childId`, le service recherche récursivement tous les descendants
de `childId`. Si `parentId` en fait déjà partie, l'insertion est refusée.

Cette recherche utilisera une CTE récursive PostgreSQL avec `WITH RECURSIVE`.
La vérification et l'insertion seront exécutées dans une même transaction. Un
verrou transactionnel protégera également cette opération afin que deux
insertions concurrentes ne puissent pas former ensemble un cycle.

## Répartition des garanties

PostgreSQL garantira :

- les clés étrangères vers `persons` ;
- l'interdiction de l'auto-relation avec `parent_id <> child_id` ;
- l'unicité du couple `(parent_id, child_id)`.

Le service métier vérifiera :

- que les deux personnes sont actives ;
- que la nouvelle relation ne crée pas de cycle ;
- que les violations sont transformées en erreurs HTTP cohérentes.

## Opérations de l'API

La première version expose les opérations suivantes :

| Méthode | Route                                    | Rôle                                          |
| ------- | ---------------------------------------- | --------------------------------------------- |
| `POST`  | `/parent-child-relationships`            | Créer une relation.                           |
| `GET`   | `/parent-child-relationships/:id`        | Consulter une relation.                       |
| `GET`   | `/people/:id/parent-child-relationships` | Lister les relations directes d'une personne. |

La collection des relations d'une personne utilise la pagination commune de
l'API. Elle contient les liens directs dans lesquels la personne est parent ou
enfant. Le parcours des ancêtres et descendants indirects appartient à la phase
de consultation de l'arbre familial.
