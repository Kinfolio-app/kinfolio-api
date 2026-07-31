# Détection d'un fichier GEDCOM

Cette note décrit l'étape qui valide le conteneur, la version et l'encodage
avant de transmettre un fichier à un parseur GEDCOM.

Le détecteur est indépendant de Fastify, de PostgreSQL et du contenu métier de
l'arbre. Il reçoit les octets du fichier et retourne soit un fichier GEDCOM
décodé et décrit, soit un diagnostic explicite.

## Contrat initial

Le détecteur accepte :

| Version             | Conteneur        | Encodage                          |
| ------------------- | ---------------- | --------------------------------- |
| GEDCOM 5.5.1        | Flux GEDCOM brut | UTF-8 déclaré par `HEAD.CHAR`     |
| GEDCOM 7.0 ou 7.0.x | Flux GEDCOM brut | UTF-8 imposé par la spécification |

Il refuse notamment :

- GEDCOM 5.5 et les versions antérieures ;
- GEDCOM 7.1 et les futures versions non étudiées ;
- ANSEL, UTF-16, Windows-1252 et les autres encodages non pris en charge ;
- les archives ZIP classiques ;
- GEDZIP `.gdz` ;
- un fichier sans en-tête ou sans version déclarée.

Le site devra demander un export GEDCOM UTF-8 avant l'envoi du fichier. Un
fichier 5.5.1 déclarant `CHAR ANSEL` est reconnu comme GEDCOM, mais refusé avec
un message demandant un nouvel export en UTF-8.

L'extension du nom de fichier est informative. Le serveur vérifie toujours les
octets et l'en-tête au lieu de faire confiance à `.ged` ou `.gdz`.

## Pipeline

```text
Uint8Array
    |
    v
signatures de conteneur et BOM
    |
    v
lecture ASCII compatible et bornée de HEAD
    |
    v
validation de GEDC.VERS et CHAR
    |
    v
décodage strict de l'ensemble du flux UTF-8
    |
    v
DetectedGedcomFile ou diagnostics
```

L'en-tête est lisible avant le décodage complet, car les nombres de niveaux,
les tags, les valeurs de version et les noms d'encodage utilisent des octets
ASCII dans les formats ciblés. Cette lecture préliminaire permet notamment de
signaler ANSEL avant qu'un octet ANSEL soit pris à tort pour un UTF-8 invalide.

## Conteneur et marque d'ordre des octets

Le détecteur reconnaît les signatures ZIP usuelles commençant par `PK`. Elles
produisent `unsupported_container` sans tenter de décompresser l'entrée.

Un BOM UTF-8 est accepté et indiqué dans le descripteur. Les BOM UTF-16 petit
et grand-boutistes produisent `unsupported_character_encoding`.

Après l'éventuel BOM UTF-8, la première ligne doit être un enregistrement
`0 HEAD`. Les lignes vides ou un autre contenu avant `HEAD` ne sont pas
acceptés.

## Lecture bornée de l'en-tête

La lecture préliminaire inspecte au maximum :

- 64 Kio ;
- 1 000 lignes.

Ces limites empêchent un en-tête anormal de provoquer un parcours non borné
avant même la sélection du parseur. Si une information requise ne peut pas être
trouvée dans cette fenêtre, le détecteur retourne `header_limit_exceeded` au
lieu de conclure qu'elle est absente.

Le détecteur cherche précisément :

```gedcom
0 HEAD
1 GEDC
2 VERS 5.5.1
1 CHAR UTF-8
```

`VERS` n'est reconnu que sous `HEAD.GEDC`. `CHAR` n'est reconnu que comme
sous-structure directe de `HEAD`.

La validation complète de la grammaire et des cardinalités appartient au
parseur sélectionné. Le détecteur ne remplace pas cette validation.

## Versions

Les valeurs suivantes sont acceptées :

- `5.5.1` ;
- `7.0` ;
- `7.0.x`, avec un numéro correctif numérique sans zéro non significatif.

Une valeur absente produit `missing_gedcom_version`. Une valeur présente mais
non prise en charge produit `unsupported_gedcom_version`. Le détecteur ne tente
jamais de deviner une version à partir des enregistrements généalogiques.

Pour GEDCOM 5.5.1, `HEAD.CHAR` est obligatoire et doit valoir exactement
`UTF-8`. Pour GEDCOM 7, `HEAD.CHAR` ne fait plus partie de la spécification : sa
présence produit `version_encoding_mismatch` même si sa valeur est `UTF-8`.

## Décodage UTF-8

Après validation de l'en-tête, l'ensemble du flux est décodé en mode strict.
Une séquence invalide produit `invalid_utf8` ; aucun caractère de remplacement
n'est inséré silencieusement.

Le contenu décodé est retourné avec le descripteur afin que le futur parseur ne
répète pas le décodage :

```ts
type GedcomFileDescriptor = {
    container: 'gedcom';
    version: '5.5.1' | '7.0' | `7.0.${number}`;
    characterEncoding: 'utf-8';
    hasByteOrderMark: boolean;
};

type DetectedGedcomFile = {
    descriptor: GedcomFileDescriptor;
    content: string;
};
```

## Diagnostics

Le détecteur utilise des codes stables :

| Code                             | Situation                                          |
| -------------------------------- | -------------------------------------------------- |
| `unsupported_container`          | Archive ZIP ou GEDZIP                              |
| `missing_header`                 | Première ligne différente de `0 HEAD`              |
| `invalid_header`                 | En-tête structurellement ambigu pour la détection  |
| `missing_gedcom_version`         | `HEAD.GEDC.VERS` absent                            |
| `unsupported_gedcom_version`     | Version déclarée mais non prise en charge          |
| `missing_character_encoding`     | `HEAD.CHAR` absent en GEDCOM 5.5.1                 |
| `unsupported_character_encoding` | ANSEL, UTF-16 ou autre encodage refusé             |
| `invalid_utf8`                   | Séquence d'octets UTF-8 invalide                   |
| `header_limit_exceeded`          | Métadonnée requise hors de la fenêtre d'inspection |
| `version_encoding_mismatch`      | `HEAD.CHAR` présent en GEDCOM 7                    |

Chaque diagnostic contient une sévérité, un code, un message anglais stable et
le numéro de ligne lorsqu'il est connu. La future route d'import pourra
traduire le message destiné à l'utilisateur sans modifier le code traité par
les clients.

## Responsabilités reportées

Le détecteur ne gère pas :

- la limite de taille du fichier envoyé, qui appartient à la route et à la
  configuration du serveur ;
- la grammaire GEDCOM complète ;
- les références entre enregistrements ;
- les tags propriétaires ;
- la prévisualisation du contenu ;
- l'import en base de données.

Ces responsabilités sont prises en charge par les étapes suivantes du pipeline
d'import.
