# ADR 0009 — Représenter les dates généalogiques par des valeurs structurées

- **Statut :** Accepté
- **Date :** 2026-07-30

## Contexte

Le modèle initial des personnes stocke `birth_date` et `death_date` dans des
colonnes PostgreSQL de type `DATE`. Cette représentation convient à une date
grégorienne complète, mais elle ne couvre pas les informations courantes dans
un arbre généalogique :

- une année ou un mois sans jour connu ;
- une date approximative, calculée ou estimée ;
- une date antérieure ou postérieure à une borne ;
- un événement situé entre deux dates ;
- un état qui commence ou se termine à une date donnée ;
- une date exprimée dans un calendrier non grégorien ;
- une phrase qui ne peut pas être convertie sans perte.

GEDCOM 5.5.1 et GEDCOM 7 représentent explicitement ces situations. Ils
distinguent notamment les formes `ABT`, `CAL`, `EST`, `BEF`, `AFT`, `BET ...
AND ...` et `FROM ... TO ...`. GEDCOM 7 prend également en charge les
calendriers grégorien, julien, hébraïque et républicain français ainsi que des
calendriers d'extension.

Les détails sont définis dans les spécifications
[GEDCOM 5.5.1](https://gedcom.io/specifications/ged551.pdf) et
[FamilySearch GEDCOM 7.0.18](https://gedcom.io/specifications/FamilySearchGEDCOMv7.html).

Transformer `1900`, `ABT 1900` ou `BEF 1900` en `1900-01-01` créerait une
précision inexistante et modifierait le sens de la donnée. Conserver uniquement
le texte original empêcherait en revanche de valider, comparer et exploiter la
date dans Kinfolio.

Ce besoin concerne les naissances et décès, mais également les relations de
couple, les événements familiaux et les futurs contenus généalogiques.

## Décision

Kinfolio représente une date généalogique par une valeur structurée commune à
tous les modules.

Le modèle conceptuel comprend :

```text
GenealogicalDate
├── kind
├── first
├── second
├── phrase
└── originalText

GenealogicalDatePoint
├── calendar
├── calendarTag
├── year
├── month
├── monthTag
├── day
├── epoch
└── epochTag
```

`kind` décrit la sémantique de la valeur :

| Valeur        | Signification                                  | Exemple GEDCOM            |
| ------------- | ---------------------------------------------- | ------------------------- |
| `exact`       | Date connue avec la précision fournie          | `12 MAR 1900`, `MAR 1900` |
| `about`       | Date approximative                             | `ABT 1900`                |
| `calculated`  | Date calculée à partir d'autres informations   | `CAL 1900`                |
| `estimated`   | Date estimée                                   | `EST 1900`                |
| `interpreted` | Date interprétée avec l'explication conservée  | `INT 1900 (recensement)`  |
| `before`      | Date antérieure à une borne                    | `BEF 1900`                |
| `after`       | Date postérieure à une borne                   | `AFT 1900`                |
| `between`     | Événement ponctuel situé entre deux bornes     | `BET 1900 AND 1905`       |
| `period`      | État ou situation couvrant une période         | `FROM 1900 TO 1905`       |
| `phrase`      | Expression non convertible sans interprétation | `au printemps de 1900`    |

`first` contient le point unique, la première borne ou le début d'une période.
`second` contient la seconde borne ou la fin d'une période lorsqu'elle existe.
Un point conserve séparément l'année, le mois et le jour : une année seule
n'est jamais complétée artificiellement avec le 1er janvier.

Une période ouverte peut omettre son début (`TO 1905`) ou sa fin (`FROM 1900`).
Une date exprimée uniquement par une phrase n'a aucun point. L'union
discriminée définit ces absences explicitement au lieu de leur attribuer une
date artificielle.

`calendar` identifie le calendrier de chaque point. La première version du
domaine reconnaît au minimum les calendriers définis par GEDCOM 7 :

- `gregorian` ;
- `julian` ;
- `french_republican` ;
- `hebrew` ;
- `extension`.

`calendarTag`, `monthTag` et `epochTag` conservent les identifiants textuels
déclarés par GEDCOM 7. Ils sont particulièrement importants pour un calendrier
ou une époque d'extension, dont la sémantique ne doit pas être inventée par le
parseur. Pour les calendriers connus, `month` contient en parallèle le numéro
normalisé du mois.

`epoch` permet notamment de distinguer les années de l'ère commune et celles
qui la précèdent. Les valeurs précises des mois restent liées au calendrier et
ne sont pas converties silencieusement en mois grégoriens.

`phrase` conserve l'expression humaine associée à la date ou constitue la
valeur principale lorsque `kind` vaut `phrase`.

`originalText` conserve, lorsqu'elle existe, la représentation reçue de la
source. Elle sert à l'audit et à la prévisualisation, mais la logique métier ne
doit pas l'analyser de nouveau pour retrouver la sémantique déjà présente dans
les champs structurés.

La représentation applicative utilise une union discriminée afin que les
combinaisons invalides soient impossibles ou explicitement rejetées. Par
exemple, `between` exige deux bornes, tandis que `before` n'en accepte qu'une.

La persistance PostgreSQL doit conserver les composantes structurées et leurs
contraintes. Le texte original ou un document JSON ne peut pas être l'unique
source de vérité. Le choix entre des groupes de colonnes appartenant à la
ressource et une table de valeurs dédiée sera précisé lors de la migration,
sans modifier le contrat du domaine défini ici.

Les bornes grégoriennes éventuellement calculées pour le tri ou la recherche
sont des données dérivées. Elles ne remplacent jamais les points, le calendrier
et le qualificatif d'origine.

Les champs `birthDate` et `deathDate` des personnes évolueront vers cette
représentation structurée. Le projet étant encore avant l'utilisation de
données privées réelles, cette évolution du contrat est réalisée avant de
stabiliser durablement l'API.

Une contrainte chronologique entre deux dates ne doit bloquer une opération que
si leur comparaison est certaine. Une contradiction impliquant une date
partielle, approximative, une période ou des calendriers non comparables doit
être signalée sans inventer un ordre exact.

## Exemples

Une année connue sans mois ni jour :

```json
{
    "kind": "exact",
    "first": {
        "calendar": "gregorian",
        "year": 1900,
        "month": null,
        "day": null,
        "epoch": "common"
    },
    "second": null,
    "phrase": null,
    "originalText": "1900"
}
```

Une date approximative :

```json
{
    "kind": "about",
    "first": {
        "calendar": "gregorian",
        "year": 1900,
        "month": 3,
        "day": null,
        "epoch": "common"
    },
    "second": null,
    "phrase": null,
    "originalText": "ABT MAR 1900"
}
```

Une période :

```json
{
    "kind": "period",
    "first": {
        "calendar": "gregorian",
        "year": 1900,
        "month": null,
        "day": null,
        "epoch": "common"
    },
    "second": {
        "calendar": "gregorian",
        "year": 1905,
        "month": null,
        "day": null,
        "epoch": "common"
    },
    "phrase": null,
    "originalText": "FROM 1900 TO 1905"
}
```

## Conséquences

### Conséquences positives

- Les dates partielles et incertaines ne gagnent pas une fausse précision.
- Les deux versions de GEDCOM peuvent produire le même modèle métier.
- Les dates deviennent réutilisables pour les personnes, couples et événements.
- La valeur d'origine reste consultable dans les rapports d'import.
- Les recherches chronologiques pourront s'appuyer sur des composantes et des
  bornes dérivées explicites.

### Compromis et risques

- Les schémas de base de données et d'API deviennent plus complexes qu'un
  simple champ `DATE`.
- Les contraintes dépendent du type de date et du calendrier.
- Le tri de dates de précisions différentes demande une règle explicite.
- Les champs existants des personnes et leurs tests devront être migrés.
- La conversion entre calendriers devra être développée ou déléguée à une
  bibliothèque fiable avant d'être proposée.

## Alternatives envisagées

### Conserver uniquement PostgreSQL `DATE`

Cette solution est simple et permet les comparaisons natives, mais elle oblige
à inventer un mois ou un jour et perd les qualificatifs, périodes et
calendriers.

### Conserver uniquement la valeur GEDCOM originale

Le texte préserve la source, mais il mélange la syntaxe d'échange et le domaine.
Il impose de reparsing la valeur pour chaque validation, recherche ou
présentation et ne couvre pas les dates saisies directement dans Kinfolio.

### Stocker uniquement un intervalle calculé

Un intervalle facilite certaines recherches, mais ne distingue pas une date
approximative d'un événement situé entre deux bornes ni une période pendant
laquelle un état a duré. Il doit rester une projection dérivée.

### Utiliser uniquement un document JSON

JSON représente facilement les variantes, mais utilisé seul il affaiblit les
contraintes relationnelles et rend les requêtes chronologiques plus complexes.
Il pourra servir de forme de transport, mais pas d'unique vérité persistée.
