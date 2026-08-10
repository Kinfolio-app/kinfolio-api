# ADR 0010 — Prendre en charge GEDCOM 5.5.1 et 7.0.x avec des parseurs dédiés

- **Statut :** Accepté
- **Date :** 2026-07-31

## Contexte

L'import GEDCOM doit permettre aux familles de reprendre un arbre créé dans un
logiciel ou un service existant. La version actuelle du standard est GEDCOM 7,
mais les formats réellement exportés par l'écosystème ne sont pas homogènes.

Heredis exporte notamment en GEDCOM 5.5.1, comme plusieurs autres logiciels
largement utilisés. Limiter Genealaine à GEDCOM 7 empêcherait donc l'import de
fichiers qui constituent une cible prioritaire du produit.

GEDCOM 7 apporte une spécification plus claire, un encodage UTF-8 obligatoire,
une meilleure représentation des médias et des mécanismes explicites pour les
extensions. L'ignorer au profit du seul format 5.5.1 créerait une nouvelle
dette de compatibilité et empêcherait de traiter les fichiers produits dans le
format moderne.

GEDCOM 5.5.1 et GEDCOM 7 ne sont pas rétrocompatibles. Ils partagent de nombreux
concepts et une forme hiérarchique proche, mais diffèrent sur leur grammaire,
leurs cardinalités, leurs types de données, leurs encodages et la sémantique de
certaines structures.

La version des producteurs ciblés et les sources correspondantes sont suivies
dans le [document de cadrage de l'import](../domain/gedcom-import.md).

## Décision

Genealaine prend en charge :

- GEDCOM 5.5.1 ;
- GEDCOM 7.0 et ses révisions correctives 7.0.x.

L'implémentation de GEDCOM 7 utilise la spécification 7.0.18 comme référence
actuelle. Une révision corrective 7.0.x clarifie la spécification sans modifier
le format des données. Le parseur accepte donc `7.0` et les valeurs `7.0.x`
valides au lieu d'exiger la chaîne exacte `7.0.18`.

Chaque famille de versions possède une implémentation dédiée derrière une
interface commune :

```text
GedcomParser
├── Gedcom551Parser
└── Gedcom7Parser
```

Le détecteur de version sélectionne l'implémentation avant le parsing. Une
version absente, invalide ou non prise en charge produit une erreur explicite ;
Genealaine ne tente pas de la deviner à partir du contenu généalogique.

Les parseurs peuvent partager des composants de bas niveau, par exemple la
lecture des lignes, la construction de l'arbre hiérarchique, la gestion des
positions et certains mécanismes de références. Une règle de grammaire, de
cardinalité ou de sémantique n'est mutualisée que si sa compatibilité avec les
deux spécifications est établie et testée.

Les deux implémentations produisent le même document GEDCOM intermédiaire. Son
contrat est défini dans la
[note technique sur le modèle normalisé](../technical/gedcom-normalized-model.md).
L'analyse, les correspondances vers Genealaine, la détection des
doublons et l'import transactionnel ne dépendent ainsi d'aucune version GEDCOM.

GEDCOM 5.5 et les versions antérieures ne font pas partie du contrat initial.
Une future prise en charge devra être décidée à partir de fichiers
représentatifs et ne devra pas affaiblir la validation de GEDCOM 5.5.1.

## Conséquences

### Conséquences positives

- Les exports Heredis 5.5.1 peuvent être importés sans conversion préalable.
- Genealaine reste compatible avec la version moderne du standard.
- Chaque parseur applique clairement les règles de sa propre spécification.
- Le reste du pipeline ne contient pas de conditions dispersées sur la version.
- Une révision corrective GEDCOM 7 ne nécessite pas un nouveau parseur.
- Les composants réellement communs peuvent être réutilisés sans confondre les
  deux formats.

### Compromis et risques

- Deux ensembles de règles doivent être développés et maintenus.
- Les fichiers de test doivent couvrir le même périmètre fonctionnel dans les
  deux versions.
- Une structure similaire peut avoir des contraintes ou un sens différents
  selon la version.
- La mutualisation excessive pourrait réintroduire des conditions de version
  difficiles à suivre dans les composants partagés.
- Le tableau de compatibilité des producteurs doit être maintenu à mesure que
  leurs formats d'export évoluent.

## Alternatives envisagées

### Prendre en charge uniquement GEDCOM 7

Cette solution réduirait la quantité de code et ciblerait le standard actuel,
mais elle rendrait incompatibles les exports 5.5.1 de Heredis et d'autres
producteurs importants. Elle ne répond pas au parcours d'adoption visé.

### Prendre en charge uniquement GEDCOM 5.5.1

Cette solution couvrirait une grande partie des fichiers existants, mais
reporterait le support du standard moderne et de ses améliorations. Elle
créerait une migration technique inévitable lors de l'arrivée de fichiers
GEDCOM 7.

### Convertir GEDCOM 5.5.1 vers GEDCOM 7 avant le parsing

Une conversion préalable permettrait de n'écrire qu'un parseur sémantique, mais
la conversion elle-même devrait comprendre et valider entièrement GEDCOM 5.5.1.
Elle pourrait également modifier ou perdre des informations avant l'analyse,
ce qui rendrait les diagnostics moins transparents.

### Utiliser un parseur unique avec des conditions de version

Les deux formats partagent suffisamment de syntaxe pour rendre cette approche
séduisante au départ. Cependant, les différences de cardinalité, d'encodage et
de sémantique accumuleraient des branches conditionnelles dans tout le parseur.
Des implémentations dédiées rendent ces différences visibles et testables tout
en permettant la réutilisation de composants internes vérifiés.
