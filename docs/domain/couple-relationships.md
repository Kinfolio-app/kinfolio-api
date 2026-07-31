# Relations de couple

Ce document décrit le modèle métier des relations de couple de Kinfolio et leur
interaction avec les familles GEDCOM.

## Principes

Une relation de couple relie exactement deux personnes. Les partenaires ont des
rôles neutres :

- `partner1Id` identifie l'un des partenaires ;
- `partner2Id` identifie l'autre partenaire ;
- aucun rôle ne permet de déduire le genre d'une personne.

L'ordre des partenaires n'a pas de sens métier. Une représentation canonique
des deux identifiants sera utilisée pour produire des réponses et des
contraintes déterministes.

La relation représente l'existence d'un lien entre deux personnes. Sa nature et
son évolution sont décrites par des événements distincts. L'absence
d'événement de mariage ne signifie donc pas que la relation est invalide, et
l'absence de séparation ou de divorce ne permet pas d'affirmer qu'elle est
encore active.

Les enfants ne sont pas stockés dans la relation de couple. Ils restent reliés
individuellement à leurs parents par les liens parent-enfant existants.

## Modèle envisagé

### Relation

Une relation de couple contient :

| Champ        | Rôle                                                    |
| ------------ | ------------------------------------------------------- |
| `id`         | Identifiant UUID de la relation.                        |
| `partner1Id` | Référence vers l'un des deux partenaires.               |
| `partner2Id` | Référence vers l'autre partenaire.                      |
| `createdAt`  | Date technique de création de la relation.              |
| `updatedAt`  | Date technique de dernière modification de la relation. |

Une personne ne peut pas être son propre partenaire. Les deux personnes doivent
exister et ne pas être supprimées logiquement au moment de la création.

Plusieurs relations entre les mêmes personnes sont autorisées. Cette règle
permet de représenter une séparation suivie d'une nouvelle union et de
préserver, avant la détection des doublons, plusieurs familles GEDCOM
déclarant les mêmes partenaires.

### Événements

Un événement de couple contient :

| Champ                  | Rôle                                                    |
| ---------------------- | ------------------------------------------------------- |
| `id`                   | Identifiant UUID de l'événement.                        |
| `coupleRelationshipId` | Relation de couple concernée.                           |
| `eventType`            | Nature de l'événement.                                  |
| `date`                 | Date généalogique structurée, éventuellement absente.   |
| `place`                | Lieu textuel, éventuellement absent.                    |
| `description`          | Précision libre, éventuellement absente.                |
| `createdAt`            | Date technique de création de l'événement.              |
| `updatedAt`            | Date technique de dernière modification de l'événement. |

Les dates utilisent la représentation définie par
l'[ADR 0009](../adr/0009-represent-genealogical-dates-as-structured-values.md).

Les types initiaux sont :

| Valeur        | Signification                                       |
| ------------- | --------------------------------------------------- |
| `engagement`  | Engagement ou fiançailles.                          |
| `marriage`    | Mariage.                                            |
| `civil_union` | Union civile ou partenariat légal.                  |
| `separation`  | Séparation sans dissolution nécessaire de l'union.  |
| `divorce`     | Divorce.                                            |
| `annulment`   | Annulation juridique ou religieuse de l'union.      |
| `other`       | Événement connu hors de la classification initiale. |

Un même type d'événement peut apparaître plusieurs fois dans une relation. Les
événements sont ordonnés pour l'affichage, mais leur ordre ne constitue pas une
contrainte métier : des dates peuvent manquer, être partielles ou se
contredire.

Le modèle ne stocke pas de statut calculé comme `active` ou `ended`. Un tel
statut pourrait être présenté ultérieurement comme une projection, mais ne doit
pas transformer une absence d'information en fait généalogique.

## Correspondance avec GEDCOM

Un enregistrement `FAM` représente un groupe familial et non nécessairement un
mariage. Son traitement initial suit ces règles :

- une famille contenant deux partenaires crée une relation de couple ;
- `HUSB` et `WIFE` identifient des partenaires, sans imposer leur genre dans
  Kinfolio ;
- une famille contenant un seul partenaire et des enfants ne crée pas de
  partenaire fictif ni de relation de couple incomplète ;
- chaque `CHIL` produit les relations parent-enfant nécessaires avec les
  partenaires présents ;
- l'identifiant GEDCOM tel que `@F1@` sert à la correspondance pendant l'import,
  mais ne devient pas l'identifiant métier de la relation.

Les premières correspondances d'événements sont :

| GEDCOM                                                  | Kinfolio      |
| ------------------------------------------------------- | ------------- |
| `ENGA`                                                  | `engagement`  |
| `MARR`                                                  | `marriage`    |
| `DIV`                                                   | `divorce`     |
| `ANUL`                                                  | `annulment`   |
| `EVEN` avec un type d'union civile reconnu              | `civil_union` |
| `EVEN` avec un type de séparation reconnu               | `separation`  |
| autre événement familial pris en charge mais non classé | `other`       |

Les événements GEDCOM hors du périmètre initial sont comptabilisés dans la
prévisualisation. Ils ne sont pas transformés silencieusement en `other` si
leur sens est inconnu ou ambigu.

GEDCOM 5.5.1 emploie historiquement les noms `HUSB` et `WIFE`. Leur présence ne
doit pas écraser le genre déjà enregistré sur une personne ni empêcher de
représenter un couple de même genre.

## Contraintes et suppression logique

PostgreSQL devra garantir :

- les clés étrangères vers les personnes et la relation de couple ;
- l'interdiction d'une relation d'une personne avec elle-même ;
- les valeurs permises pour les types d'événements.

Le service métier vérifiera :

- que les deux personnes sont actives lors de la création ;
- que les événements ciblent une relation existante ;
- que les violations sont transformées en erreurs API cohérentes.

Lorsqu'une personne est supprimée logiquement, ses relations et événements de
couple sont conservés pour permettre une restauration, mais ils ne sont plus
exposés par l'API publique.

La suppression définitive d'une personne devra rester protégée par des clés
étrangères utilisant `ON DELETE RESTRICT`.

## Points volontairement reportés

La conception initiale ne définit pas encore :

- les routes de création, consultation, modification ou suppression ;
- la stratégie de fusion de relations dupliquées ;
- la gestion détaillée des sources, citations et médias d'un événement ;
- la conversion automatique entre calendriers ;
- les événements familiaux autres que ceux nécessaires au premier import ;
- le calcul d'un statut courant de la relation.

Ces éléments seront précisés avec les étapes correspondantes de la roadmap.
