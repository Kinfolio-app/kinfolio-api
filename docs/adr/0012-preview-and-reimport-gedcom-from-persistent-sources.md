# ADR 0012 — Prévisualiser et réimporter GEDCOM depuis des sources persistantes

- **Statut :** Accepté
- **Date :** 2026-08-05

## Contexte

Un même arbre généalogique peut être exporté et importé plusieurs fois à mesure
qu'il évolue dans son logiciel d'origine. Genealaine doit reconnaître les entités
déjà importées, préserver les modifications réalisées dans l'application et
éviter qu'un nouvel envoi du même fichier crée des doublons.

Les identifiants d'enregistrement GEDCOM tels que `@I42@` et `@F7@` ne sont
uniques qu'à l'intérieur d'un fichier. Ils peuvent néanmoins rester stables
entre plusieurs exports d'un même arbre. Les identifiants `UID`, `EXID` et
`REFN` peuvent fournir des indices supplémentaires, mais leur stabilité et leur
unicité dépendent du producteur. Enfin, une ressemblance de nom, de date, de
lieu ou de parenté ne prouve pas que deux enregistrements représentent la même
personne.

Une fusion silencieuse risquerait de confondre des homonymes. À l'inverse,
créer systématiquement toutes les entités rendrait chaque réimport inutilisable.
L'import doit donc distinguer les correspondances certaines des rapprochements
qui nécessitent une décision humaine.

L'utilisateur doit également pouvoir examiner les pertes, les ambiguïtés et
les changements proposés avant que l'arbre familial soit modifié. Cette étape
peut être longue pour un fichier volumineux et doit survivre à plusieurs
requêtes du client.

## Décision

### Identifier une lignée d'imports par une source persistante

Genealaine représente chaque lignée d'exports par une source d'import persistante.
Le premier import crée une source. Un réimport cible explicitement cette source.
Un fichier envoyé sans source crée une nouvelle lignée et ne fusionne pas
automatiquement ses entités avec celles déjà présentes.

Une correspondance persistante associe au minimum :

- la source d'import ;
- le type d'enregistrement GEDCOM ;
- son identifiant dans la source, par exemple `@I42@` ou `@F7@` ;
- l'entité Genealaine correspondante ;
- les dernières valeurs importées nécessaires à la comparaison d'un réimport.

Une source appartiendra à l'espace familial qui sera introduit avec le modèle
d'autorisation. La recherche de doublons ne traverse jamais les espaces
familiaux. Avant leur implémentation, elle reste strictement limitée à la source
ciblée et aux entités explicitement proposées pour cette source.

Chaque exécution conserve également l'empreinte du fichier. Une empreinte déjà
importée avec succès pour la même source est reconnue comme un import identique
et ne produit aucune nouvelle écriture métier.

### Prévisualiser dans un brouillon côté serveur

L'analyse crée un brouillon temporaire persisté côté serveur. Ce brouillon
contient le plan d'import, les correspondances proposées, les problèmes
détectés et les décisions de l'utilisateur. Il ne crée, ne modifie et ne
supprime aucune donnée de l'arbre familial.

Le brouillon est accessible uniquement dans le périmètre de son propriétaire
ou de son futur espace familial. Sa durée de conservation est configurable. À
son expiration, le fichier reçu et les données temporaires associées sont
supprimés ; l'utilisateur doit alors produire une nouvelle prévisualisation.

Les états précis, les tables, les routes HTTP et le stockage temporaire sont
définis dans la
[note technique de l'import transactionnel](../technical/gedcom-transactional-import.md).

### Résoudre les correspondances par niveau de confiance

Genealaine applique l'ordre suivant pour une personne planifiée :

1. une correspondance déjà enregistrée pour la source et l'identifiant GEDCOM
   est réutilisée automatiquement ;
2. un `UID`, `EXID` ou `REFN` commun produit un candidat à forte confiance,
   mais nécessite une confirmation lors du premier rapprochement ;
3. le nom, les dates, les lieux et les proches peuvent produire des candidats,
   mais ne provoquent jamais de fusion automatique ;
4. sans correspondance confirmée, une nouvelle personne est proposée.

Pour chaque cas ambigu, l'utilisateur choisit de lier l'enregistrement à une
entité existante, de créer une nouvelle entité ou de l'ignorer. Une décision de
liaison est persistée afin que les réimports suivants deviennent déterministes.

Deux enregistrements rapprochés peuvent faire apparaître de nouvelles
incohérences, par exemple une auto-relation ou plusieurs filiations identiques.
Le plan est donc validé de nouveau après chaque ensemble de résolutions. Toutes
les ambiguïtés bloquantes doivent être résolues avant la confirmation.

### Protéger les modifications manuelles par une fusion à trois versions

Pour chaque champ réimporté, Genealaine compare :

- la dernière valeur importée depuis cette source ;
- la valeur actuelle dans Genealaine ;
- la nouvelle valeur du fichier GEDCOM.

La nouvelle valeur est appliquée lorsque la valeur actuelle correspond encore
à la dernière valeur importée. Une modification réalisée uniquement dans
Genealaine est conservée. Une modification réalisée uniquement dans le fichier
est appliquée. Lorsque Genealaine et le fichier ont modifié différemment la même
valeur, le brouillon contient un conflit à résoudre avant confirmation.

La stratégie détaillée pour les valeurs absentes, structurées ou non encore
persistées sera définie avec le contrat technique du rapport.

### Traiter les relations selon leur identité métier

Une filiation entre les mêmes parent et enfant peut être rapprochée de la
relation existante. Une différence de type de relation ou d'état de preuve
constitue un conflit et n'est pas arbitrée silencieusement.

Deux relations de couple entre les mêmes partenaires peuvent représenter des
unions successives. Elles ne sont donc pas fusionnées à partir des partenaires
seuls. La correspondance persistante avec l'enregistrement GEDCOM `FAM` est
prioritaire ; les événements associés peuvent seulement contribuer à une
proposition de rapprochement.

### Confirmer avant toute écriture métier

La confirmation explicite du brouillon est le seul événement qui modifie
l'arbre familial. Avant de commencer, Genealaine vérifie que le brouillon est
complet, non expiré et fondé sur des entités qui n'ont pas changé depuis sa
prévisualisation.

Les personnes, relations, événements, correspondances persistantes et le
rapport final sont ensuite écrits dans une seule transaction. Une erreur annule
l'ensemble de ces écritures.

Une entité présente lors d'un import précédent mais absente du nouveau fichier
n'est jamais supprimée automatiquement. Elle est signalée dans le rapport afin
qu'une future action explicite puisse la détacher, l'archiver ou la supprimer.

Le rapport final distingue au minimum les entités créées, mises à jour,
inchangées, rapprochées, ignorées, en conflit et absentes du réimport. Ses codes
et sa représentation sont détaillés dans la
[note technique de l'import transactionnel](../technical/gedcom-transactional-import.md).

## Conséquences

### Conséquences positives

- Le même fichier peut être envoyé plusieurs fois sans créer de doublons.
- Les réimports d'une même source deviennent déterministes après les premières
  confirmations.
- Les homonymes et les relations de couple successives ne sont pas fusionnés
  silencieusement.
- L'utilisateur connaît l'effet de l'import avant toute modification de son
  arbre.
- Les modifications manuelles peuvent être conservées sans ignorer les
  évolutions du fichier source.
- Une erreur pendant la confirmation ne laisse pas un arbre partiellement
  importé.
- Les éléments disparus d'un export ne provoquent aucune perte automatique.

### Compromis et risques

- Les sources, brouillons, correspondances et snapshots augmentent le volume
  de données et la complexité du modèle.
- Une première importation peut demander plusieurs confirmations manuelles.
- La fusion à trois versions nécessite une comparaison adaptée à chaque type
  de donnée.
- Un producteur qui renouvelle ses identifiants GEDCOM peut générer de nouveaux
  candidats à confirmer.
- La persistance temporaire du fichier et du plan contient des données privées
  et impose une expiration, une suppression et un contrôle d'accès stricts.
- Une modification concurrente après la prévisualisation peut invalider le
  brouillon et obliger à recalculer le plan.

## Alternatives envisagées

### Fusionner automatiquement les personnes similaires

Un score fondé sur le nom, la naissance, le lieu et les proches réduirait le
nombre de confirmations. Il pourrait cependant fusionner deux homonymes et
produire des relations familiales difficiles à réparer. Ces données servent
uniquement à proposer des candidats.

### Considérer chaque fichier comme un import indépendant

Cette solution éviterait de gérer les sources et les correspondances, mais
créerait de nouvelles personnes et relations à chaque export du même arbre.
Elle ne satisfait pas l'idempotence attendue.

### Conserver la prévisualisation uniquement chez le client

Le serveur pourrait renvoyer le plan sans conserver de brouillon, puis demander
au client de renvoyer le fichier et toutes ses décisions. Cette approche réduit
le stockage temporaire, mais transfère un état volumineux, répète l'analyse et
rend les résolutions en plusieurs sessions plus fragiles.

### Écrire progressivement pendant la résolution

Les entités certaines pourraient être enregistrées avant la résolution des
ambiguïtés. L'arbre deviendrait toutefois partiellement importé et chaque
annulation demanderait une compensation complexe. Genealaine attend une
confirmation unique et écrit le résultat atomiquement.

### Écraser systématiquement les valeurs lors d'un réimport

Cette solution refléterait toujours le dernier fichier, mais supprimerait des
corrections et enrichissements effectués directement dans Genealaine. La fusion à
trois versions protège ces modifications et rend les conflits visibles.
