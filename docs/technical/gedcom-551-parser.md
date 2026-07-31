# Parseur GEDCOM 5.5.1

Cette note décrit la première implémentation du parseur GEDCOM 5.5.1. Elle
complète le [contrat d'import](../domain/gedcom-import.md), la
[détection du fichier](gedcom-file-detection.md) et le
[modèle intermédiaire normalisé](gedcom-normalized-model.md).

Le parseur ne reçoit qu'un fichier déjà détecté comme GEDCOM 5.5.1 encodé en
UTF-8. Il analyse et valide son contenu en mémoire, puis produit un document
normalisé. Il ne lit et ne modifie jamais la base de données.

## Pipeline

Le traitement comporte quatre étapes :

1. analyser chaque ligne en conservant son niveau, son tag, sa valeur, son
   identifiant éventuel et son numéro de ligne ;
2. construire l'arbre correspondant aux niveaux GEDCOM ;
3. indexer les enregistrements et résoudre les pointeurs, y compris les
   références vers un enregistrement déclaré plus loin dans le fichier ;
4. normaliser les personnes, familles, événements, sources, dépôts, notes et
   médias dans le contrat commun.

Une erreur produit `document: null`. Un avertissement n'empêche pas de fournir
le document normalisé.

## Structures reconnues

Le périmètre comprend notamment :

- les enregistrements `HEAD`, `INDI`, `FAM`, `SOUR`, `REPO`, `NOTE`, `OBJE` et
  `TRLR` ;
- les noms structurés, le sexe déclaré et les identifiants d'une personne ;
- les événements et attributs individuels ou familiaux ;
- les liens `FAMC`, `FAMS`, `HUSB`, `WIFE` et `CHIL` ;
- les lieux, citations de sources, notes en ligne ou partagées et références
  de médias ;
- les continuations textuelles `CONT` et `CONC` ;
- les dates exactes ou partielles, qualifiées, interprétées, comprises entre
  deux bornes ou exprimées comme une période ;
- les calendriers grégorien, julien, hébraïque et républicain français définis
  par GEDCOM 5.5.1.

Les rôles historiques `HUSB` et `WIFE` sont conservés comme rôles de source.
Ils ne servent pas à déduire le genre d'une personne.

## Validation et diagnostics

La validation couvre :

- la syntaxe des lignes et la hiérarchie des niveaux ;
- la présence et la position uniques de `HEAD` et `TRLR` ;
- les identifiants obligatoires ou dupliqués ;
- les pointeurs invalides, absents ou visant un type d'enregistrement
  incompatible ;
- certaines cardinalités indispensables, par exemple un seul `SEX`, `HUSB`,
  `WIFE`, `DATE`, `PLAC` ou `TYPE` dans leur contexte ;
- la syntaxe et les bornes des dates ;
- la cohérence dans les deux directions entre les liens familiaux d'un
  individu et ceux de la famille.

Les diagnostics contiennent un code stable, une sévérité, le numéro de ligne,
l'identifiant de l'enregistrement concerné et un chemin lorsque ces
informations sont disponibles.

La validation des pointeurs dépend du contexte. Par exemple, `FAM.HUSB`
contient une référence vers un individu, tandis que `FAM.MARR.HUSB` est une
sous-structure décrivant le conjoint dans l'événement et ne contient pas ce
type de pointeur.

## Conservation et limites

Les sous-structures non normalisées sont conservées comme extensions avec leur
valeur, leur position et leurs enfants. Elles ne sont ni interprétées ni
supprimées silencieusement. Leur classement détaillé comme reconnu, ignoré ou
ambigu appartient à l'étape de prévisualisation.

Ce point de la roadmap ne comprend pas encore :

- le parseur GEDCOM 7.0.x ;
- la prévisualisation commune ;
- la correspondance avec les entités Kinfolio ;
- la détection des doublons et le réimport ;
- la persistance transactionnelle ;
- la prise en charge d'ANSEL, de GEDZIP ou des fichiers médias eux-mêmes.

## Tests

Les tests synthétiques couvrent le lecteur de lignes, la construction de
l'arbre, les principales formes de dates, la normalisation, les références en
avant, les mauvais types de référence, les identifiants dupliqués, les
documents incomplets et les incohérences significatives.

Les exports représentatifs anonymisés de Heredis et d'autres producteurs
seront ajoutés dans le point transversal de la roadmap consacré aux fichiers
réels et volumineux. Chaque ajout devra aussi mettre à jour le tableau de
compatibilité du [contrat d'import](../domain/gedcom-import.md).
