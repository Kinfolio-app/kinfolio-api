# Parseur GEDCOM 7.0.x

Cette note décrit l'implémentation du parseur GEDCOM 7.0.x fondée sur la
[spécification officielle 7.0.18](https://gedcom.io/specifications/FamilySearchGEDCOMv7.html).
Elle complète le [contrat d'import](../domain/gedcom-import.md), la
[détection des fichiers](gedcom-file-detection.md) et le
[modèle intermédiaire normalisé](gedcom-normalized-model.md).

Le parseur accepte un fichier préalablement détecté avec un en-tête déclarant
`7.0` ou `7.0.x`. Il produit un document normalisé et des diagnostics sans lire
ni modifier la base de données.

## Organisation du module

Le code est séparé par responsabilité et par dialecte :

```text
gedcom-import/
├── common/  types et utilitaires réellement communs
├── v5/      grammaire, dates et parseur GEDCOM 5.5.1
├── v7/      grammaire, dates et parseur GEDCOM 7
└── gedcom-parser-selector.ts
```

`GedcomParserSelector` choisit l'implémentation à partir de la version validée
par le détecteur. Un script et une route API peuvent ainsi utiliser le même
pipeline sans connaître les classes concrètes.

## Syntaxe des lignes

Le lecteur GEDCOM 7 applique notamment les règles suivantes :

- un seul espace sépare les composants d'une ligne ;
- les tags standard commencent par une lettre majuscule et les extensions par
  `_` ;
- les anciennes limites de longueur des tags et identifiants ne sont pas
  réintroduites ;
- `@VOID@` est accepté comme pointeur, mais jamais comme identifiant ;
- un `@` initial appartenant à une chaîne est décodé depuis la forme `@@` ;
- un identifiant de référence est interdit sur une sous-structure ;
- `CONC` est rejeté ;
- chaque `CONT` est fusionné dans le payload précédent et n'apparaît pas dans
  l'arbre syntaxique.

Une limite défensive de 1 000 niveaux empêche un fichier hostile de provoquer
une allocation excessive. Elle reste très supérieure aux profondeurs permises
par les structures standard.

## Structures propres à GEDCOM 7

Le parseur reconnaît notamment :

- `HEAD.SCHMA.TAG` et associe les extensions documentées à leur URI lorsque le
  tag permet une résolution non ambiguë ;
- les notes en ligne `NOTE` et les notes partagées `SNOTE` ;
- les valeurs de `SEX` `M`, `F`, `X` et `U` ;
- les traductions `TRAN`, conservées dans les extensions du nom, du lieu, de
  la note ou du fichier média concerné ;
- les liens de médias vers un enregistrement `OBJE`, avec au moins un `FILE`
  et exactement un `FORM` par fichier ;
- les références en avant, `@VOID@` et les contrôles du type de la cible ;
- les liens familiaux dans les deux directions.

Les rôles `HUSB` et `WIFE` restent des rôles déclarés par la source. Ils ne
servent pas à déduire le genre. Leur signification dépend aussi du contexte :
`FAM.HUSB` est un pointeur, tandis que `FAM.MARR.HUSB` décrit la participation
du conjoint à l'événement.

GEDCOM 7 permet à un enregistrement qui n'est ciblé par aucun pointeur de ne
pas avoir d'identifiant. Le modèle normalisé conserve alors `id: null` ; aucun
identifiant artificiel n'est généré.

## Dates

Le parseur de dates prend en charge :

- les dates exactes ou partielles ;
- `ABT`, `CAL`, `EST`, `BEF`, `AFT`, `BET ... AND`, `FROM ... TO`, `FROM` et
  `TO` ;
- les calendriers `GREGORIAN`, `JULIAN`, `FRENCH_R` et `HEBREW` ;
- l'époque `BCE` pour les calendriers qui l'autorisent ;
- les calendriers, mois et époques d'extension ;
- la sous-structure `PHRASE`, y compris lorsqu'aucune date structurée n'est
  disponible ;
- un `DateValue` vide, autorisé par la norme.

Les jours sont contrôlés selon les bornes des calendriers connus. Les tags
d'extension sont conservés avec le texte original afin de ne pas attribuer une
sémantique non documentée.

## Validation et limites

Les diagnostics couvrent la syntaxe, la hiérarchie, `HEAD`, `TRLR`, les
cardinalités principales, les identifiants dupliqués, les pointeurs invalides,
les cibles absentes ou incompatibles, les dates et les incohérences familiales.
Une erreur empêche la production du document ; un avertissement laisse le
document disponible.

Le classement des extensions conservées est réalisé par la
[analyse commune](gedcom-import-analysis.md). Les responsabilités
suivantes restent hors du parseur GEDCOM 7 :

- GEDZIP et l'extraction des fichiers médias ;
- la correspondance avec les entités Kinfolio ;
- la détection des doublons et le réimport ;
- la persistance transactionnelle.

Les structures reconnues mais non projetées dans un champ dédié restent
attachées au document comme extensions. Les fichiers représentatifs anonymisés
de producteurs réels seront ajoutés au point transversal de la roadmap consacré
aux tests multi-producteurs et volumineux.
