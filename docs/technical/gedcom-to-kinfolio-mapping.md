# Correspondances GEDCOM vers Kinfolio

Cette note définit la projection du document GEDCOM normalisé vers un plan
d'import Kinfolio. Elle s'applique de manière identique aux documents produits
par les parseurs GEDCOM 5.5.1 et GEDCOM 7.0.x.

Le mapper est une fonction pure. Il ne recherche pas de doublon, ne consulte
pas PostgreSQL et ne modifie aucune donnée persistée. Son résultat décrit les
entités candidates et toutes les pertes, ambiguïtés ou incohérences détectées
pendant la projection.

## Contrat du plan d'import

Le plan contient quatre collections ordonnées et un rapport :

```ts
type GedcomImportPlan = {
    people: PlannedPerson[];
    parentChildRelationships: PlannedParentChildRelationship[];
    coupleRelationships: PlannedCoupleRelationship[];
    coupleRelationshipEvents: PlannedCoupleRelationshipEvent[];
    issues: GedcomMappingIssue[];
};
```

Les clés `person:<index>`, `parent-child:<index>`, `couple:<index>` et
`couple-event:<index>` ne sont pas des UUID. Elles relient uniquement les
éléments du plan avant la future écriture transactionnelle. L'index d'une
personne correspond à sa position dans le document normalisé ; une personne
invalide peut donc laisser un intervalle dans les clés.

Chaque élément planifié et chaque problème conserve une provenance :

```ts
type GedcomMappingProvenance = {
    gedcomId: string | null;
    path: string;
};
```

L'identifiant GEDCOM reste une information de provenance. Il ne devient ni une
clé de plan, ni un identifiant métier Kinfolio.

## Rapport de correspondance

Une issue contient un type, un code stable, un message, une provenance et un
compteur :

| Type        | Effet                                                                 |
| ----------- | --------------------------------------------------------------------- |
| `ignored`   | Donnée reconnue mais non persistée ; elle ne bloque pas l'import.     |
| `ambiguous` | Interprétation humaine nécessaire avant de poursuivre l'import.       |
| `invalid`   | Élément incohérent ou référence absente ; l'import doit être corrigé. |

Les collections du plan représentent les correspondances réussies. Elles ne
sont pas répétées dans le rapport. Une issue détaillée porte `count: 1` ; une
issue agrégée utilise le nombre d'occurrences concernées.

## Personnes

### Noms

Le premier nom marqué comme principal est utilisé, avec repli sur le premier
nom disponible. Les sous-champs structurés sont prioritaires sur la valeur
brute `NAME`.

| GEDCOM normalisé                      | Kinfolio                                 |
| ------------------------------------- | ---------------------------------------- |
| `givenNames`                          | `firstName` complet                      |
| `surnamePrefix` suivi de `surname`    | `lastName`                               |
| premier nom `BIRTH` ou `MAIDEN`       | `birthName`                              |
| séparation interne des prénoms        | aucune ; `middleNames` reste `null`      |
| noms suivants                         | ignorés et signalés                      |
| `prefix`, `suffix`, `nickname`        | ignorés et signalés                      |
| aucun prénom ou patronyme exploitable | personne invalide et absente de `people` |

La syntaxe brute `Given names /Surname/ Suffix` sert de repli. Un suffixe brut
est signalé sans être compté deux fois lorsqu'un suffixe structuré équivalent
existe. `surnamePrefix` n'est pas une partie ignorée : il appartient au
patronyme importé.

### Genre et statut de vie

| Valeur normalisée | Genre Kinfolio | Rapport                         |
| ----------------- | -------------- | ------------------------------- |
| `male`            | `male`         | aucun                           |
| `female`          | `female`       | aucun                           |
| `unknown`         | `unspecified`  | aucun                           |
| valeur absente    | `unspecified`  | aucun                           |
| `other`           | `unspecified`  | `unsupported_sex`, non bloquant |

Le mapper ne déduit jamais `non_binary`. La présence d'un événement `DEAT`
produit `deceased`, même sans date. Son absence produit `unknown` et jamais
automatiquement `living`.

### Naissance, décès et lieux

Le premier événement `BIRT` et le premier `DEAT` sont utilisés entièrement.
Le mapper ne combine pas la date d'un événement avec le lieu d'un autre. Les
événements suivants sont signalés comme ignorés.

Les dates restent des `GenealogicalDate` structurées. Seule la valeur textuelle
du lieu est projetée. Son format, ses coordonnées, sa langue et ses extensions
sont signalés comme non persistés.

Les autres événements individuels, les attributs, citations, notes et médias
sont comptabilisés dans le rapport. Les identifiants externes restent attachés
à `PlannedPerson` pour la future détection des doublons et le réimport.

## Filiations parent-enfant

Pour chaque famille, le mapper crée une relation orientée entre chaque
partenaire résolu et chaque enfant résolu. Une famille avec deux partenaires
et deux enfants produit donc quatre relations. Une famille monoparentale ne
crée jamais de parent fictif.

### Nature de la filiation

| `PEDI`               | Type Kinfolio                            |
| -------------------- | ---------------------------------------- |
| absent ou `BIRTH`    | `unspecified`                            |
| `ADOPTED`            | `adoptive`                               |
| `FOSTER`             | `foster`                                 |
| `SEALING` ou `OTHER` | `other`                                  |
| valeur inconnue      | `unspecified` avec une issue `ambiguous` |

Le mapper ne déduit jamais `biological` ou `step` à partir de `PEDI` seul.

### État de la preuve

| `STAT`          | `evidenceStatus` | Résultat                                  |
| --------------- | ---------------- | ----------------------------------------- |
| absent          | `unassessed`     | relation créée                            |
| `PROVEN`        | `proven`         | relation créée                            |
| `CHALLENGED`    | `challenged`     | relation créée                            |
| `DISPROVEN`     | aucun            | relation non créée et lien signalé        |
| valeur inconnue | `unassessed`     | relation créée avec une issue `ambiguous` |

Une référence absente et une auto-relation sont invalides. Les liens répétés
provenant de familles distinctes sont conservés pour la future détection des
doublons. Les cycles directs ou indirects restent également dans le plan, mais
produisent une issue `invalid` : le mapper ne choisit pas arbitrairement une
relation à supprimer.

## Relations de couple

Une famille contenant exactement deux partenaires distincts et résolus crée
une relation de couple. Les clés des partenaires sont ordonnées par leur index
temporaire ; `HUSB`, `WIFE` et `partner` ne déterminent ni cet ordre, ni leur
genre.

| Partenaires dans `FAM`     | Résultat                           |
| -------------------------- | ---------------------------------- |
| zéro ou un                 | aucune relation, issue `ignored`   |
| deux distincts             | une relation canonique             |
| deux fois la même personne | aucune relation, issue `invalid`   |
| plus de deux               | aucune relation, issue `ambiguous` |

Deux familles ayant les mêmes partenaires produisent deux relations. Cette
règle préserve aussi bien des unions successives que des doublons qui seront
traités dans le prochain ticket.

## Événements de couple

Les événements restent dans l'ordre GEDCOM ; ils ne sont pas triés par date.
Leur date structurée, leur lieu textuel et leur description sont conservés.

| GEDCOM                                 | Type Kinfolio |
| -------------------------------------- | ------------- |
| `ENGA`                                 | `engagement`  |
| `MARR`                                 | `marriage`    |
| `DIV`                                  | `divorce`     |
| `ANUL`                                 | `annulment`   |
| `MARB`, `MARC`, `MARL`, `MARS`, `DIVF` | `other`       |

Pour `EVEN`, la valeur `type` est comparée sans tenir compte de la casse ni des
espaces superflus.

- `civil union`, `civil partnership`, `registered partnership`,
  `domestic partnership`, `pacs`, `union civile` et `partenariat civil`
  deviennent `civil_union` ;
- `separation`, `séparation`, `legal separation`, `séparation légale`,
  `separated` et `séparés` deviennent `separation` ;
- les autres valeurs sont signalées comme non prises en charge.

`CENS`, `RESI` et les autres événements familiaux inconnus ne sont pas
transformés artificiellement en `other`. Les détails de lieu, sources, notes,
médias et extensions non persistés apparaissent dans le rapport.

## Données partagées et extensions

Les enregistrements partagés de source, dépôt, note et média sont agrégés par
catégorie comme données non persistées. Une extension dont l'URI est résolu est
`ignored`. Une extension sans URI identifiable est `ambiguous`. Les extensions
imbriquées conservent leur chemin et l'identifiant GEDCOM de leur enregistrement
porteur lorsqu'il existe.

## Déterminisme et limites

Le mapper parcourt toujours les tableaux normalisés dans leur ordre d'origine.
Les clés et les issues sont donc reproductibles pour un même document. Un
document normalisé vide produit un plan vide valide.

Cette étape ne couvre pas :

- la comparaison avec les données déjà présentes en base ;
- la fusion des doublons ;
- le réimport et l'idempotence ;
- la résolution interactive des issues bloquantes ;
- l'écriture transactionnelle et le rapport d'import final.

Ces responsabilités appartiennent aux étapes suivantes de la
[roadmap](../roadmap.md).
