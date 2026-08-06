# Import GEDCOM transactionnel

Cette note décrit l'implémentation de la prévisualisation, de la détection des
doublons, du réimport et de l'écriture transactionnelle d'un plan GEDCOM. Elle
applique les décisions de
l'[ADR 0012](../adr/0012-preview-and-reimport-gedcom-from-persistent-sources.md)
au document normalisé et au
[plan d'import Kinfolio](gedcom-to-kinfolio-mapping.md) communs à GEDCOM 5.5.1
et GEDCOM 7.0.x.

## Objectifs

La première implémentation doit garantir que :

- un fichier peut être prévisualisé sans modifier l'arbre familial ;
- un réimport cible explicitement une source persistante ;
- le même fichier confirmé deux fois ne crée aucune nouvelle donnée ;
- une correspondance incertaine n'est jamais appliquée sans confirmation ;
- les modifications manuelles sont protégées lors d'un réimport ;
- toutes les écritures métier réussissent ou échouent ensemble ;
- les données temporaires privées sont supprimées après confirmation,
  annulation ou expiration ;
- le résultat final reste explicable par un rapport déterministe.

Cette étape n'ajoute pas de fusion générale entre personnes Kinfolio. Elle
résout uniquement les correspondances nécessaires à une source GEDCOM donnée.

## Prérequis métier et techniques

Les dates généalogiques structurées des personnes sont désormais persistées
sans conversion silencieuse en dates grégoriennes exactes. Le plan contient
encore des relations et événements de couple dont les tables, repositories et
services ne sont pas implémentés.

Cette capacité restante doit être réalisée avant l'écriture transactionnelle
du périmètre GEDCOM complet. L'import ne supprime pas les relations de couple
du plan pour contourner l'absence de persistance.

La prévisualisation, le stockage des brouillons et la résolution des personnes
peuvent être développés avant ces prérequis. La confirmation reste désactivée
tant que le plan contient une entité que le modèle persistant ne peut pas
représenter fidèlement.

## Vue d'ensemble du traitement

```text
fichier
  |
  v
détection -> parsing -> document normalisé -> plan Kinfolio
                                                |
                                                v
                              recherche des correspondances
                                                |
                                                v
                                   brouillon persistant
                                  /          |          \
                                 /           |           \
                         résolutions     validation     expiration
                                 \           |
                                  \          v
                                   +---- confirmation
                                                |
                                                v
                                  transaction PostgreSQL
                                                |
                              +-----------------+-----------------+
                              |                                   |
                           rapport                        arbre + liens
```

L'analyse existante reste utilisable pour obtenir un diagnostic sans créer de
brouillon. La prévisualisation réutilise le même détecteur, les mêmes parseurs
et le même mapper ; elle ajoute la comparaison avec PostgreSQL et la
persistance temporaire.

## Modèle de persistance

Les noms ci-dessous expriment les responsabilités attendues. Les migrations
peuvent ajuster un nom si le vocabulaire final du module l'exige, sans réunir
des responsabilités distinctes dans une même table.

### Sources d'import

`gedcom_import_sources` représente une lignée d'exports d'un même arbre.

| Colonne      | Rôle                                                        |
| ------------ | ----------------------------------------------------------- |
| `id`         | UUID stable de la source.                                   |
| `name`       | Nom choisi par l'utilisateur.                               |
| `created_at` | Date de création.                                           |
| `updated_at` | Date de dernière modification des métadonnées de la source. |

Une future migration ajoutera la clé étrangère de l'espace familial. Toutes
les requêtes de correspondance devront alors inclure cet espace. Dans le
modèle transitoire sans espaces familiaux, aucune correspondance n'est cherchée
hors de la source, sauf pour présenter explicitement des personnes existantes
comme candidats à confirmer.

Une source créée pour un brouillon abandonné peut être supprimée lorsque :

- elle ne possède aucun import terminé ;
- elle ne possède aucune correspondance persistante ;
- aucun autre brouillon actif ne la référence.

### Brouillons

`gedcom_import_drafts` conserve la prévisualisation côté serveur.

| Colonne          | Rôle                                                                |
| ---------------- | ------------------------------------------------------------------- |
| `id`             | UUID du brouillon.                                                  |
| `source_id`      | Source associée à la prévisualisation.                              |
| `status`         | `blocked`, `needs_resolution` ou `ready`.                           |
| `file_sha256`    | Empreinte SHA-256 des octets reçus.                                 |
| `file_content`   | Contenu temporaire du fichier sous forme `BYTEA`.                   |
| `gedcom_version` | Version détectée.                                                   |
| `plan`           | Plan immuable produit par le mapper, stocké en `JSONB`.             |
| `resolutions`    | Décisions de rapprochement et de conflit, stockées en `JSONB`.      |
| `base_versions`  | Versions observées des entités candidates, stockées en `JSONB`.     |
| `revision`       | Entier utilisé pour le contrôle de concurrence optimiste du client. |
| `expires_at`     | Date après laquelle le brouillon ne peut plus être utilisé.         |
| `created_at`     | Date de création.                                                   |
| `updated_at`     | Date de dernière résolution.                                        |

PostgreSQL `BYTEA` est retenu initialement pour que le brouillon fonctionne
sur plusieurs instances de l'API sans dépendre du disque local. La route impose
une taille maximale avant de conserver le contenu. Si les fichiers avec médias
ou les limites produit rendent ce stockage inadapté, `file_content` sera
remplacé par une référence vers un stockage chiffré derrière une abstraction
dédiée.

Le plan est immuable. Une résolution ne le réécrit pas ; elle ajoute ou remplace
une décision dans `resolutions`, incrémente `revision`, puis recalcule le statut
et le rapport de prévisualisation. Cette séparation permet de reproduire les
propositions à partir du plan initial.

Une erreur de détection ou de parsing qui empêche de produire un document
normalisé répond immédiatement avec ses diagnostics et ne crée pas de
brouillon. Lorsqu'un plan a pu être construit, le brouillon est :

- `blocked` lorsque le fichier ou le plan contient un problème non résoluble
  dans l'interface, par exemple une référence absente ou un cycle ;
- `needs_resolution` lorsqu'au moins une correspondance ou un conflit attend
  une décision ;
- `ready` lorsque le plan résolu peut être confirmé.

L'expiration est déterminée par `expires_at` plutôt que conservée comme état.
Une tâche de nettoyage supprime les brouillons expirés. Une lecture ou une
confirmation après expiration répond comme pour une ressource expirée, même si
le nettoyage physique n'a pas encore eu lieu.

### Exécutions terminées

`gedcom_import_runs` conserve uniquement les confirmations réussies.

| Colonne          | Rôle                                  |
| ---------------- | ------------------------------------- |
| `id`             | UUID de l'exécution.                  |
| `source_id`      | Source réimportée.                    |
| `file_sha256`    | Empreinte du fichier confirmé.        |
| `gedcom_version` | Version détectée.                     |
| `report`         | Rapport final en `JSONB`.             |
| `created_at`     | Date de validation de la transaction. |

Une contrainte unique sur `(source_id, file_sha256)` garantit l'idempotence au
niveau de PostgreSQL. Une erreur de confirmation ne crée pas d'exécution : la
transaction est annulée et le brouillon reste disponible jusqu'à son
expiration. Le diagnostic de l'erreur est renvoyé au client sans être présenté
comme un rapport d'import réussi.

Le fichier brut et le plan temporaire ne sont pas conservés dans l'exécution.
Après un succès, le brouillon est supprimé et seuls le rapport, l'empreinte et
les snapshots nécessaires au prochain réimport subsistent.

### Correspondances de personnes

`gedcom_individual_links` associe un enregistrement `INDI` à une personne.

| Colonne              | Rôle                                             |
| -------------------- | ------------------------------------------------ |
| `source_id`          | Source de l'identifiant GEDCOM.                  |
| `gedcom_id`          | Identifiant tel que `@I42@`.                     |
| `person_id`          | Personne Kinfolio associée.                      |
| `identifiers`        | Derniers `UID`, `EXID` et `REFN` observés.       |
| `last_imported_data` | Snapshot des dernières valeurs importées.        |
| `last_seen_run_id`   | Dernière exécution contenant cet enregistrement. |
| `created_at`         | Date de création de la correspondance.           |
| `updated_at`         | Date de sa dernière mise à jour.                 |

La clé primaire est `(source_id, gedcom_id)`. Plusieurs identifiants GEDCOM
peuvent être liés à la même personne après confirmation d'un doublon interne au
fichier ; aucune contrainte unique n'est donc ajoutée sur
`(source_id, person_id)`.

`last_imported_data` contient uniquement les champs couverts par l'import. Il
est mis à jour avec les dernières valeurs observées et confirmées dans le
fichier, y compris lorsqu'une valeur Kinfolio modifiée manuellement a été
conservée. Ce snapshot représente l'état de la source, pas une copie de l'état
courant de la personne.

### Correspondances de familles et de relations

Un enregistrement `FAM` existe même lorsqu'il ne produit aucune relation de
couple. `gedcom_family_links` conserve donc son identité indépendamment de la
relation de couple optionnelle.

| Colonne                  | Rôle                                                 |
| ------------------------ | ---------------------------------------------------- |
| `source_id`              | Source de l'enregistrement.                          |
| `gedcom_id`              | Identifiant tel que `@F7@`.                          |
| `couple_relationship_id` | Relation de couple associée, éventuellement absente. |
| `last_imported_data`     | Dernier snapshot familial accepté.                   |
| `last_seen_run_id`       | Dernière exécution contenant la famille.             |

La clé primaire est `(source_id, gedcom_id)`. Plusieurs familles peuvent
contenir les mêmes partenaires sans partager la même relation de couple.

Une table de provenance des filiations relie la source, la famille, les
identifiants GEDCOM du parent et de l'enfant, et la relation parent-enfant
Kinfolio. Plusieurs provenances peuvent désigner la même relation lorsque le
fichier répète le lien dans plusieurs familles.

Les événements familiaux n'ont généralement pas d'identifiant GEDCOM propre.
Leur clé de provenance combine la famille, le type de structure et son rang
d'occurrence. Au réimport :

1. une provenance stable est réutilisée si son type reste compatible ;
2. une empreinte du contenu permet de reconnaître un événement seulement
   déplacé ;
3. plusieurs correspondances possibles produisent une ambiguïté ;
4. aucune correspondance ne provoque la proposition d'un nouvel événement.

La table exacte des correspondances d'événements sera créée avec leur modèle
persistant afin de conserver une véritable clé étrangère. Une table
polymorphique contenant seulement un UUID et un type d'entité n'est pas
retenue, car PostgreSQL ne pourrait pas garantir l'intégrité de cette référence.

## Construction de la prévisualisation

### Création ou sélection de la source

Le client fournit soit l'identifiant d'une source existante, soit le nom d'une
nouvelle source. Une source existante est vérifiée dans le périmètre
d'autorisation courant. Pour un premier import, la nouvelle source et le
brouillon sont créés ensemble après la construction réussie du plan. Une erreur
de détection ou de parsing ne laisse donc aucune source vide. Un fichier envoyé
sans source existante ne réutilise aucune correspondance d'une autre source.

Après calcul de l'empreinte, l'API recherche une exécution terminée possédant le
même couple `(source_id, file_sha256)`. Si elle existe, la réponse référence
l'exécution précédente et ne crée pas de nouveau brouillon.

### Recherche des personnes

Les correspondances sont évaluées dans cet ordre :

1. le couple `(source_id, gedcom_id)` fournit une correspondance automatique ;
2. chaque identifiant externe exactement égal, après normalisation de son type
   et de sa valeur, fournit un candidat à forte confiance ;
3. les noms, dates, lieux et liens familiaux fournissent seulement des
   candidats biographiques ;
4. sans candidat confirmé, le plan propose une création.

Un identifiant externe ne devient jamais une clé unique globale de `persons`.
Deux producteurs peuvent réutiliser une valeur et un export peut la dupliquer.
Lorsque plusieurs personnes correspondent au même identifiant externe, toutes
sont présentées comme ambiguës.

La normalisation biographique sert uniquement à retrouver des candidats. Elle
peut notamment ignorer la casse et les accents pour la recherche, sans modifier
la valeur qui sera persistée. Aucun score, même élevé, ne transforme un candidat
biographique en correspondance automatique.

### Résolutions possibles

Une personne ambiguë accepte trois décisions :

- `link`, avec l'identifiant de la personne Kinfolio choisie ;
- `create` ;
- `ignore`.

Ignorer une personne ignore également les filiations, relations de couple et
événements qui ne peuvent plus être construits. Chaque élément dépendant reste
présent dans le rapport avec la raison de son exclusion.

Après application logique des résolutions, le service reconstruit les clés de
personnes et valide de nouveau :

- les auto-relations ;
- les cycles de filiation ;
- les filiations répétées et leurs attributs ;
- les partenaires identiques ;
- les événements devenus orphelins.

Deux filiations identiques par leurs personnes, leur type et leur état de
preuve sont regroupées avec plusieurs provenances. Des attributs différents
produisent un conflit. Deux familles possédant les mêmes partenaires restent
deux relations de couple, sauf si une correspondance de famille préexistante ou
une décision humaine les relie explicitement.

### Contrôle de concurrence des résolutions

Chaque modification du brouillon fournit la `revision` lue par le client. La
mise à jour n'est acceptée que si cette valeur correspond encore à celle de
PostgreSQL. Une révision obsolète produit une erreur de concurrence et oblige le
client à recharger la prévisualisation, ce qui évite d'écraser une résolution
enregistrée dans une autre session.

## Fusion à trois versions

Pour un champ, les symboles suivants sont utilisés :

- `P` : valeur du snapshot importé précédemment ;
- `C` : valeur courante dans Kinfolio ;
- `I` : valeur proposée par le nouveau fichier.

| Situation                 | Résultat                                                 |
| ------------------------- | -------------------------------------------------------- |
| `C = P` et `I` diffère    | Appliquer `I`.                                           |
| `I = P` et `C` diffère    | Conserver `C`.                                           |
| `C = I`                   | Conserver la valeur, sans conflit.                       |
| `C`, `P` et `I` diffèrent | Demander une résolution.                                 |
| Aucun snapshot précédent  | Présenter la fusion lors de la première liaison.         |
| `I` est absent ou `null`  | Conserver `C` et signaler la donnée absente du réimport. |

Une absence dans un export ne supprime donc pas automatiquement une valeur
existante. Une future interface pourra proposer explicitement une suppression,
mais la première version privilégie la conservation.

Les comparaisons utilisent la forme métier canonique de chaque champ : texte
normalisé selon les règles de l'entité, valeur structurée complète pour une
date généalogique et valeur d'énumération pour les types. La représentation
JSON ou l'ordre des propriétés ne doivent pas créer un faux changement.

Lors d'une première liaison vers une personne existante, chaque différence est
visible dans la prévisualisation. Le choix de liaison ne suffit pas à écraser
implicitement les valeurs existantes ; les conflits de champs doivent aussi
être résolus.

## Confirmation transactionnelle

La confirmation exécute les opérations suivantes :

1. ouvrir une transaction PostgreSQL ;
2. charger le brouillon avec `SELECT ... FOR UPDATE` ;
3. vérifier son expiration, son statut et sa révision ;
4. verrouiller la source afin qu'un seul réimport soit confirmé à la fois ;
5. rechercher de nouveau une exécution portant la même empreinte ;
6. verrouiller les entités existantes ciblées par le plan ;
7. comparer leur `updated_at` et leur contenu avec `base_versions` ;
8. reconstruire et valider le plan résolu côté serveur ;
9. créer ou mettre à jour les personnes ;
10. créer ou mettre à jour les filiations ;
11. créer ou mettre à jour les relations et événements de couple ;
12. mettre à jour les correspondances et leurs snapshots ;
13. produire le rapport final et créer l'exécution terminée ;
14. supprimer le brouillon et son fichier ;
15. valider la transaction.

Le client ne fournit jamais directement les écritures finales. Il fournit des
résolutions référencées par les clés du plan ; le serveur reconstruit les
commandes à partir du plan immuable et des règles métier.

Si une entité a changé depuis la prévisualisation, la transaction est annulée.
Le brouillon repasse par le calcul des correspondances et des fusions avant une
nouvelle confirmation. Kinfolio ne tente pas de fusionner avec un état que
l'utilisateur n'a pas prévisualisé.

La contrainte unique de l'exécution rend deux confirmations concurrentes du
même fichier inoffensives. Deux brouillons distincts pour la même source et la
même empreinte convergent vers la première exécution créée. Deux confirmations
du même brouillon sont sérialisées par son verrou : après le succès de la
première, la seconde constate que le brouillon n'existe plus. Dans aucun cas les
écritures métier ne sont répétées.

Les entités et correspondances non vues dans le nouveau fichier conservent leur
état. Leur absence est calculée avant la mise à jour de `last_seen_run_id` et
apparaît dans le rapport.

## Rapport

La prévisualisation et l'exécution finale partagent des codes stables. Leur
enveloppe distingue au minimum :

| Catégorie                | Signification                                                   |
| ------------------------ | --------------------------------------------------------------- |
| `created`                | Nouvelle entité Kinfolio.                                       |
| `updated`                | Entité existante modifiée par le fichier.                       |
| `unchanged`              | Entité reconnue sans changement.                                |
| `linked`                 | Nouvelle correspondance vers une entité existante.              |
| `ignored`                | Élément volontairement exclu ou hors périmètre.                 |
| `conflicted`             | Choix nécessaire avant confirmation.                            |
| `missing_from_reimport`  | Entité précédemment importée, absente du nouveau fichier.       |
| `retained_manual_change` | Valeur Kinfolio conservée face à une ancienne valeur importée.  |
| `retained_missing_value` | Valeur conservée parce que le nouvel export ne la fournit plus. |

Chaque entrée détaillée possède une provenance GEDCOM, la clé du plan, l'action
proposée ou réalisée et, lorsqu'elle existe, l'entité Kinfolio concernée. Les
compteurs agrégés sont calculés à partir de ces entrées afin d'éviter deux
sources de vérité.

Le rapport final ne conserve pas le fichier ni des copies inutiles de données
privées. Les valeurs d'un conflit peuvent être présentes dans le brouillon pour
permettre la décision, puis supprimées avec lui. Le rapport final conserve la
décision et ses références, mais pas nécessairement le contenu complet des
trois versions.

## Contrat HTTP envisagé

Les routes suivantes expriment le cycle de vie sans remplacer la description
OpenAPI qui sera ajoutée avec leur implémentation :

| Méthode  | Route                                    | Rôle                                   |
| -------- | ---------------------------------------- | -------------------------------------- |
| `POST`   | `/gedcom-import-drafts`                  | Créer une prévisualisation.            |
| `GET`    | `/gedcom-import-drafts/:id`              | Lire son état et son rapport.          |
| `PATCH`  | `/gedcom-import-drafts/:id/resolutions`  | Enregistrer des décisions.             |
| `POST`   | `/gedcom-import-drafts/:id/confirmation` | Confirmer l'écriture transactionnelle. |
| `DELETE` | `/gedcom-import-drafts/:id`              | Annuler et supprimer le brouillon.     |

La création utilise `multipart/form-data` et reçoit le fichier ainsi que
l'identifiant d'une source ou le nom d'une nouvelle source. Une confirmation
répond avec l'exécution créée ou avec l'exécution existante lorsque l'empreinte
a déjà été confirmée.

La configuration multipart actuelle de `buildApp()` limite toutes les requêtes
à un fichier, aucun champ texte et une seule partie (`files: 1`, `fields: 0`,
`parts: 1`). Elle doit être élargie avant d'exposer cette route. Le premier
contrat du brouillon accepte exactement :

- un champ fichier `file` ;
- soit un champ texte `sourceId`, soit un champ texte `sourceName`.

Les limites globales deviennent donc au minimum `files: 1`, `fields: 1` et
`parts: 2`. Elles ne suffisent pas à valider le contrat de chaque route : le
schéma TypeBox du brouillon impose l'alternative entre `sourceId` et
`sourceName`, tandis que le schéma de `POST /gedcom-imports/analysis` continue
de refuser tout champ autre que `file`. La limite de taille du fichier reste
inchangée.

Une expiration, une révision obsolète, une modification concurrente et un
brouillon non résolu utilisent les erreurs RFC 9457 définies par l'API. Le choix
exact des statuts HTTP et des codes de problèmes sera fixé avec les schémas de
routes.

## Nettoyage et confidentialité

Le contenu GEDCOM, le plan et les résolutions sont des données familiales
privées. La première implémentation doit :

- limiter la taille du fichier avant son stockage ;
- appliquer les mêmes règles d'accès à la source et au brouillon ;
- ne jamais écrire le contenu du fichier ou du plan dans les logs ;
- supprimer immédiatement le brouillon après une confirmation ou une
  annulation réussie ;
- supprimer périodiquement les brouillons expirés ;
- rendre le nettoyage idempotent ;
- conserver uniquement les snapshots requis pour les prochains réimports.

L'utilisation avec de véritables données privées reste interdite avant la mise
en place des espaces familiaux, de l'authentification et des autorisations
prévus par la roadmap.

## Stratégie de tests

### Tests unitaires

- hiérarchie des niveaux de correspondance ;
- absence de fusion automatique pour un candidat biographique ;
- trois choix de résolution d'une personne ;
- nouvelle validation après rapprochement de deux clés du plan ;
- toutes les branches de la fusion à trois versions ;
- conservation d'une valeur absente du nouvel export ;
- déterminisme des compteurs et du rapport.

### Tests d'intégration PostgreSQL

- unicité d'une empreinte par source ;
- réutilisation d'une correspondance `(source_id, gedcom_id)` ;
- possibilité de lier plusieurs identifiants GEDCOM à la même personne ;
- intégrité des clés étrangères de toutes les correspondances ;
- annulation complète après une erreur au milieu des écritures ;
- rejet d'une confirmation fondée sur une entité modifiée ;
- sérialisation de deux confirmations concurrentes pour la même source ;
- conservation et signalement d'une entité absente du réimport ;
- suppression du brouillon et du fichier après succès.

### Scénarios fonctionnels

- analyse simple toujours limitée au seul champ `file` après l'élargissement
  de la configuration multipart globale ;
- création d'un brouillon avec `sourceId` ou `sourceName`, et rejet lorsque les
  deux champs ou aucun des deux sont fournis ;
- rejet d'une partie multipart supplémentaire ;
- confirmation d'un premier import ;
- second envoi strictement identique ;
- réimport avec les mêmes identifiants GEDCOM et de nouvelles valeurs ;
- identifiant GEDCOM renouvelé mais `UID` conservé ;
- homonymes partageant un nom et une date de naissance ;
- modification manuelle concurrente avec une modification GEDCOM ;
- deux familles ayant les mêmes partenaires ;
- deux enregistrements du fichier confirmés comme une seule personne ;
- brouillon bloqué, expiré, annulé et confirmé.

Les fichiers de ces tests restent synthétiques ou préalablement anonymisés.

## Ordre d'implémentation recommandé

1. persister les relations et événements de couple ;
2. créer les sources, exécutions et correspondances ;
3. créer les brouillons et leur nettoyage ;
4. construire la recherche de correspondances et la fusion à trois versions ;
5. adapter les limites multipart et exposer les routes de prévisualisation et
   de résolution ;
6. implémenter la confirmation transactionnelle et son rapport ;
7. ajouter les tests de concurrence, de rollback et d'idempotence ;
8. mesurer le stockage, la mémoire et le temps sur les grands fichiers.
