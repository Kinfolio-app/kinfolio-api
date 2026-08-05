# Modèle GEDCOM intermédiaire normalisé

Cette note définit la représentation intermédiaire commune produite par les
parseurs GEDCOM 5.5.1 et GEDCOM 7.0.x.

Ce modèle permet de séparer trois responsabilités :

- comprendre la syntaxe et les règles propres à chaque version de GEDCOM ;
- conserver les informations reconnues sans les adapter prématurément à
  Kinfolio ;
- préparer la validation, l'analyse et les correspondances vers le
  domaine Kinfolio.

Le modèle est temporaire. Il existe pendant l'analyse et l'import d'un fichier,
mais ne constitue pas un schéma de base de données.

Les règles qui sélectionnent et transforment ensuite ces données sont décrites
séparément dans la
[note sur les correspondances GEDCOM vers Kinfolio](gedcom-to-kinfolio-mapping.md).

## Principes

Le modèle intermédiaire :

- est indépendant de GEDCOM 5.5.1 et GEDCOM 7.0.x ;
- ne contient aucun UUID ou identifiant de base de données Kinfolio ;
- conserve les identifiants GEDCOM dans la portée du document ;
- préserve les structures et extensions non interprétées ;
- ne choisit pas les informations qui remplaceront les champs Kinfolio ;
- ne détecte ni ne fusionne les doublons ;
- ne modifie jamais la base de données ;
- produit un ordre déterministe pour faciliter les tests et les rapports.

Le parsing utilise deux niveaux : un arbre syntaxique brut, puis un document
normalisé.

## Arbre syntaxique brut

L'arbre syntaxique représente fidèlement les lignes du fichier après son
décodage :

```ts
type GedcomNode = {
    level: number;
    tag: string;
    xref: string | null;
    value: string | null;
    children: GedcomNode[];
    location: GedcomSourceLocation;
};

type GedcomSourceLocation = {
    line: number;
    column: number;
};
```

Il conserve notamment :

- le niveau de chaque ligne ;
- le tag dans son contexte hiérarchique ;
- l'identifiant de référence éventuel ;
- la valeur textuelle telle qu'elle apparaît après décodage ;
- les sous-structures ;
- la position dans le fichier.

Ce niveau permet de signaler précisément une erreur et de préserver un tag
propriétaire ou inconnu. Il reste interne à l'implémentation des parseurs et
n'est pas exposé aux services métier.

Les versions peuvent partager un lecteur de lignes et des utilitaires de
construction d'arbre. Leurs règles de grammaire, de cardinalité et de
sémantique restent toutefois appliquées par l'implémentation propre à chaque
version.

## Résultat du parsing

Un parseur retourne le document normalisé et les diagnostics produits pendant
la lecture, la validation structurelle et la résolution des références :

```ts
type GedcomParseResult = {
    document: NormalizedGedcomDocument | null;
    diagnostics: GedcomDiagnostic[];
};
```

`document` vaut `null` lorsque des erreurs empêchent de construire un document
cohérent. Un document peut néanmoins être retourné avec des avertissements ou
des informations.

## Document normalisé

```ts
type NormalizedGedcomDocument = {
    metadata: GedcomMetadata;
    individuals: NormalizedIndividual[];
    families: NormalizedFamily[];
    sources: NormalizedSource[];
    repositories: NormalizedRepository[];
    media: NormalizedMedia[];
    sharedNotes: NormalizedNote[];
    extensions: NormalizedExtension[];
};
```

Les tableaux restent sérialisables et conservent un ordre déterministe. Des
index temporaires de type `Map` peuvent être construits pendant la
normalisation et les étapes suivantes, sans faire partie du contrat.

## Métadonnées

```ts
type SupportedGedcomVersion = '5.5.1' | '7.0' | `7.0.${number}`;

type GedcomMetadata = {
    version: SupportedGedcomVersion;
    sourceProduct: string | null;
    sourceProductVersion: string | null;
    characterEncoding: string;
    language: string | null;
    fileName: string | null;
};
```

`version` contient la valeur validée de `HEAD.GEDC.VERS`.
`characterEncoding` décrit l'encodage effectivement appliqué au flux. Pour
GEDCOM 7, il vaut toujours UTF-8.

Les métadonnées d'import techniques, comme le nom du fichier envoyé, sa taille,
son empreinte ou l'utilisateur à l'origine de l'import, n'appartiennent pas au
document GEDCOM. Elles seront portées par le contexte d'import.

## Individus

```ts
type NormalizedIndividual = {
    id: string | null;
    names: NormalizedName[];
    sex: NormalizedSex | null;
    events: NormalizedEvent[];
    attributes: NormalizedAttribute[];
    parentFamilyLinks: NormalizedParentFamilyLink[];
    partnerFamilyIds: string[];
    sourceCitations: NormalizedSourceCitation[];
    noteReferences: NormalizedNoteReference[];
    mediaReferences: NormalizedMediaReference[];
    identifiers: NormalizedIdentifier[];
    extensions: NormalizedExtension[];
};
```

`id` contient l'identifiant GEDCOM dans sa forme originale, par exemple `@I1@`,
sans lui donner la sémantique d'un identifiant Kinfolio. Il peut être `null`
pour un enregistrement GEDCOM 7 non référencé, car cette version n'impose pas
d'identifiant dans ce cas. Le parseur n'en invente jamais un.

Les événements regroupent notamment la naissance et le décès. Les attributs
regroupent les informations décrivant un état ou une caractéristique, comme
une profession ou une résidence.

### Noms

```ts
type NormalizedName = {
    value: string;
    type: string | null;
    givenNames: string | null;
    surname: string | null;
    surnamePrefix: string | null;
    prefix: string | null;
    suffix: string | null;
    nickname: string | null;
    isPrimary: boolean;
    extensions: NormalizedExtension[];
};
```

Tous les noms reconnus sont conservés. Le premier nom conforme est marqué
comme principal lorsque le fichier ne fournit pas une indication plus précise.
Le choix du nom qui alimentera `firstName`, `lastName` ou `birthName` appartient
à la correspondance vers Kinfolio.

### Sexe déclaré

```ts
type NormalizedSex = {
    value: 'male' | 'female' | 'other' | 'unknown';
    originalValue: string;
};
```

La valeur normalisée facilite la comparaison entre versions, tandis que
`originalValue` préserve la valeur réellement rencontrée. La conversion vers
le genre Kinfolio reste une décision de correspondance séparée.

### Liens familiaux d'un individu

```ts
type NormalizedParentFamilyLink = {
    familyId: string;
    pedigree: string | null;
    status: string | null;
    extensions: NormalizedExtension[];
};
```

Cette structure conserve notamment les informations `PEDI` et `STAT` portées
par le lien d'un individu vers sa famille d'origine. La normalisation les
rattache ensuite à l'enfant correspondant dans la famille.

## Familles

```ts
type NormalizedFamily = {
    id: string | null;
    partners: NormalizedFamilyPartner[];
    children: NormalizedFamilyChild[];
    events: NormalizedEvent[];
    sourceCitations: NormalizedSourceCitation[];
    noteReferences: NormalizedNoteReference[];
    mediaReferences: NormalizedMediaReference[];
    extensions: NormalizedExtension[];
};
```

```ts
type NormalizedFamilyPartner = {
    individualId: string;
    sourceRole: 'husband' | 'wife' | 'partner';
};

type NormalizedFamilyChild = {
    individualId: string;
    pedigree: string | null;
    status: string | null;
};
```

`sourceRole` préserve le rôle exprimé par le fichier, notamment au moyen des
tags historiques `HUSB` et `WIFE`. Il ne détermine pas le genre de la personne
et n'est pas directement recopié dans le modèle de
[relation de couple](../domain/couple-relationships.md).

Les enfants sont normalisés à partir des références de la famille et des liens
vers la famille portés par les individus. Une incohérence entre ces deux
directions produit un diagnostic au lieu d'être corrigée silencieusement.

## Événements et attributs

```ts
type NormalizedEvent = {
    tag: string;
    type: string | null;
    value: string | null;
    date: GenealogicalDate | null;
    place: NormalizedPlace | null;
    description: string | null;
    sourceCitations: NormalizedSourceCitation[];
    noteReferences: NormalizedNoteReference[];
    mediaReferences: NormalizedMediaReference[];
    extensions: NormalizedExtension[];
};

type NormalizedAttribute = {
    tag: string;
    type: string | null;
    value: string | null;
    date: GenealogicalDate | null;
    place: NormalizedPlace | null;
    sourceCitations: NormalizedSourceCitation[];
    noteReferences: NormalizedNoteReference[];
    extensions: NormalizedExtension[];
};
```

`tag` conserve le tag standard, par exemple `BIRT`, `DEAT`, `MARR`, `DIV`,
`OCCU` ou `RESI`. `type` conserve une classification complémentaire portée par
GEDCOM.

Les dates utilisent le modèle défini dans
l'[ADR 0009](../adr/0009-represent-genealogical-dates-as-structured-values.md).
Elles ne sont jamais transformées en objet JavaScript `Date`, car celui-ci ne
représente ni les dates partielles ni les qualificatifs généalogiques.

### Lieux

```ts
type NormalizedPlace = {
    value: string;
    format: string[] | null;
    latitude: string | null;
    longitude: string | null;
    language: string | null;
    extensions: NormalizedExtension[];
};
```

La première correspondance Kinfolio peut n'utiliser que `value`, mais les
autres composantes restent disponibles dans l'analyse et pour les
évolutions futures.

## Sources, dépôts, notes et médias

Ces éléments sont normalisés même lorsqu'ils ne sont pas encore persistés dans
Kinfolio. Cette représentation permet de les compter, de vérifier leurs
références et d'expliquer leur traitement dans l'analyse.

```ts
type NormalizedSource = {
    id: string | null;
    title: string | null;
    author: string | null;
    publication: string | null;
    repositoryReferences: NormalizedRepositoryReference[];
    noteReferences: NormalizedNoteReference[];
    mediaReferences: NormalizedMediaReference[];
    extensions: NormalizedExtension[];
};

type NormalizedRepository = {
    id: string | null;
    name: string | null;
    address: string | null;
    extensions: NormalizedExtension[];
};

type NormalizedMedia = {
    id: string | null;
    files: NormalizedMediaFile[];
    title: string | null;
    extensions: NormalizedExtension[];
};

type NormalizedMediaFile = {
    path: string;
    mediaType: string | null;
    title: string | null;
    extensions: NormalizedExtension[];
};

type NormalizedNote = {
    id: string | null;
    text: string;
    language: string | null;
    mediaType: string | null;
    extensions: NormalizedExtension[];
};
```

Les structures de référence et de citation restent distinctes des
enregistrements ciblés :

```ts
type NormalizedSourceCitation = {
    sourceId: string | null;
    page: string | null;
    data: string | null;
    quality: string | null;
    extensions: NormalizedExtension[];
};

type NormalizedRepositoryReference = {
    repositoryId: string;
    callNumber: string | null;
};

type NormalizedNoteReference = {
    noteId: string | null;
    inlineNote: NormalizedNote | null;
};

type NormalizedMediaReference = {
    mediaId: string | null;
    inlineMedia: NormalizedMedia | null;
};

type NormalizedIdentifier = {
    type: string;
    value: string;
};
```

Une structure définie directement sous un individu ou un événement reste
représentable sans inventer un identifiant partagé.

## Extensions et structures non interprétées

```ts
type NormalizedExtension = {
    tag: string;
    uri: string | null;
    value: string | null;
    path: string;
    location: GedcomSourceLocation;
    children: NormalizedExtension[];
};
```

Pour GEDCOM 7, `uri` contient l'identifiant déclaré dans `HEAD.SCHMA` lorsqu'il
peut être résolu. Pour GEDCOM 5.5.1 ou une extension non documentée, il peut
rester absent.

Une structure inconnue n'est pas automatiquement invalide. Elle est conservée
avec sa position et sera classée comme reconnue, ignorée ou ambiguë par la
[analyse commune](gedcom-import-analysis.md).

## Diagnostics

```ts
type GedcomDiagnostic = {
    severity: 'error' | 'warning' | 'information';
    code: string;
    message: string;
    location: GedcomSourceLocation | null;
    recordId: string | null;
    path: string | null;
};
```

Les codes sont stables et indépendants du texte affiché. Ils permettront aux
tests, à l'API et aux clients de traiter une catégorie de problème sans
comparer son message.

Les diagnostics du parseur couvrent :

- les erreurs de syntaxe ;
- les cardinalités invalides ;
- les identifiants dupliqués ;
- les références absentes ou visant un mauvais type d'enregistrement ;
- les incohérences entre les liens familiaux ;
- les valeurs standard inconnues ;
- les extensions rencontrées.

La décision d'importer, d'ignorer ou de rapprocher un élément appartient aux
étapes suivantes. Elle ne doit pas être encodée dans un diagnostic syntaxique.

## Interface des parseurs

```ts
type DecodedGedcomInput = {
    content: string;
    version: SupportedGedcomVersion;
    characterEncoding: string;
};

interface GedcomParser {
    supports(version: SupportedGedcomVersion): boolean;

    parse(input: DecodedGedcomInput): GedcomParseResult;
}
```

Les implémentations initiales sont :

```text
GedcomParser
├── Gedcom551Parser
└── Gedcom7Parser
```

Le détecteur de version et d'encodage sélectionne le parseur avant l'appel à
`parse`. Un parseur refuse une version pour laquelle `supports` retourne
`false`. Cette méthode permet à `Gedcom7Parser` d'accepter les révisions
correctives `7.0.x` sans devoir en maintenir une liste exhaustive.

Les implémentations peuvent partager des composants internes pour la lecture
des lignes, les références et les diagnostics. Elles ne partagent pas
implicitement une règle dont la compatibilité entre les deux spécifications
n'a pas été vérifiée.

## Pipeline

```text
fichier reçu
    |
    v
détection du conteneur, de la version et de l'encodage
    |
    v
décodage du flux
    |
    v
sélection de Gedcom551Parser ou Gedcom7Parser
    |
    v
arbre syntaxique brut
    |
    v
document GEDCOM normalisé + diagnostics
    |
    +--> analyse
    +--> correspondances Kinfolio
    +--> détection des doublons
    +--> import transactionnel
```

## Résolution des références

GEDCOM autorise une référence vers un enregistrement défini plus loin dans le
fichier. La normalisation se déroule donc en plusieurs passes :

1. construire les enregistrements et collecter leurs identifiants ;
2. détecter les identifiants dupliqués ;
3. construire les index temporaires par type d'enregistrement ;
4. résoudre les références ;
5. rapprocher les liens familiaux présents dans les deux directions ;
6. produire les diagnostics de références et le document final.

Une référence absente n'est jamais remplacée par une personne, une famille ou
une ressource fictive.

## Frontière avec Kinfolio

Le document normalisé décrit ce que contient le fichier. Il ne décide pas :

- quel nom devient le nom principal Kinfolio ;
- comment une valeur GEDCOM de sexe devient un genre Kinfolio ;
- si deux individus représentent la même personne ;
- si une famille représente une relation déjà existante ;
- si une source ou un média peut être persisté ;
- si une donnée ambiguë doit être acceptée par l'utilisateur.

Ces décisions appartiennent au service de correspondance et au plan d'import.
Cette frontière permet de tester les parseurs sans PostgreSQL et de réutiliser
la même [analyse](gedcom-import-analysis.md) pour GEDCOM 5.5.1 et
GEDCOM 7.0.x.
