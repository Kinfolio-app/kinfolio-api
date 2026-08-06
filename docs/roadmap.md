# Roadmap de Kinfolio API

Cette roadmap présente l'ordre de développement actuellement envisagé pour
Kinfolio API. Elle sert de guide et pourra évoluer à mesure que les besoins
métier seront précisés.

## Phase 1 — Stabiliser le socle technique

Avant d'implémenter les fonctionnalités de généalogie, le socle de l'API doit
être fiable et facilement testable.

- [x] Valider les variables d'environnement au démarrage :
    - `DATABASE_URL` doit être définie et valide ;
    - `PORT` doit représenter un port valide ;
    - `HOST` doit avoir une valeur exploitable.
- [x] Vérifier réellement la disponibilité de PostgreSQL au démarrage, par
      exemple avec une requête `SELECT 1`.
- [x] Mettre en place un outil de migrations PostgreSQL.
- [x] Ajouter une infrastructure minimale de tests autour de `buildApp()`.
- [x] Remplacer les routes de démonstration par un endpoint de santé
      `GET /health`.
- [x] Définir une gestion cohérente des erreurs de l'API.

### Publication du contrat HTTP

- [x] Publier le choix d'OpenAPI conformément à
      l'[ADR 0011](adr/0011-publish-the-http-contract-as-openapi.md).
- [ ] Générer le contrat OpenAPI depuis les schémas TypeBox avec
      `@fastify/swagger`.
- [ ] Compléter les routes avec des `operationId`, des tags et leurs réponses
      d'erreur RFC 9457.
- [ ] Décrire correctement les paramètres de collection, les réponses sans
      contenu et le transfert des fichiers GEDCOM.
- [ ] Ajouter une commande produisant un `openapi.json` déterministe.
- [ ] Valider en CI que `openapi.json` est valide et à jour.
- [ ] Publier le contrat avec les tags ou releases de Kinfolio API afin que les
      clients puissent sélectionner une version immuable.
- [ ] Vérifier la génération des types du client web avec
      `openapi-typescript`.

## Phase 2 — Première tranche métier : les personnes

La première fonctionnalité sera développée de manière verticale : schéma de
base de données, accès aux données, logique métier, routes, validation et tests.

### Modèle actuel

La table `persons` contient actuellement :

- `id` ;
- `first_name` ;
- `middle_names` ;
- `last_name` ;
- `birth_name` ;
- `gender` ;
- `birth_date` ;
- `death_date` ;
- `birth_place` ;
- `death_place` ;
- `living_status` ;
- `biography` ;
- `deleted_at` ;
- `created_at` ;
- `updated_at`.

Ce modèle pourra encore évoluer avec la persistance des dates généalogiques
structurées et les futurs contenus familiaux.

### Implémentation

- [x] Créer la migration initiale de la table `persons`.
- [x] Créer la couche d'accès aux données des personnes.
- [x] Ajouter la logique métier associée.
- [x] Définir les schémas de validation des entrées et des réponses.
- [x] Implémenter `POST /people`.
- [x] Implémenter `GET /people/:id`.
- [x] Ajouter les tests d'intégration de ces deux routes.
- [x] Implémenter `GET /people`.
- [x] Implémenter `PATCH /people/:id`.
- [x] Implémenter la suppression logique avec `DELETE /people/:id`.

La stratégie de suppression logique et ses implications sont décrites dans
l'[ADR 0007](adr/0007-use-soft-deletion-for-people.md). Les règles de purge
définitive devront prendre en compte les futures relations, photos, documents
et souvenirs associés à une personne.

## Phase 3 — Liens de parenté

Une fois la gestion des personnes stabilisée, ajouter les relations familiales.

La table `parent_child_relationships` contient notamment :

- `parent_id` ;
- `child_id` ;
- `relationship_type` ;
- `evidence_status`.

Une table de relations distincte est préférée à des colonnes `father_id` et
`mother_id` dans `persons`. Elle permet de représenter plus facilement les
familles adoptives ou recomposées ainsi que les informations incomplètes.

Le [modèle métier des relations de couple](domain/couple-relationships.md) et
leurs événements est défini séparément. Sa persistance et ses routes restent à
implémenter avec les étapes qui en auront besoin.

- [x] Préciser les différents types de relations pris en charge dans le
      [modèle métier des liens parent-enfant](domain/parent-child-relationships.md).
- [x] Définir les contraintes et règles métier des liens de parenté.
- [x] Créer la migration correspondante.
- [x] Ajouter les opérations de création et de consultation des relations.
- [x] Empêcher les relations incohérentes ou cycliques lorsque cela est
      nécessaire.
- [x] Ajouter les tests métier et les tests d'intégration.

## Phase 4 — Consultation de l'arbre familial

- [x] Définir le format de représentation d'une branche familiale sous forme
      de graphe normalisé, conformément à l'[ADR 0008](adr/0008-represent-family-branches-as-graphs.md).
- [x] Ajouter une route permettant de consulter les proches d'une personne.
- [x] Borner le parcours par profondeur et par nombre de personnes, sans
      pagination classique qui séparerait les éléments du graphe.
- [x] Évaluer les performances sur des arbres de taille importante.

## Phase 5 — Import de données généalogiques

L'import GEDCOM constitue un parcours d'adoption essentiel pour les familles
qui disposent déjà d'un arbre contenant plusieurs milliers de personnes. La
première version devra privilégier un import contrôlable et vérifiable plutôt
qu'une prise en charge silencieuse et partielle du format.

- [x] Définir les versions de GEDCOM prises en charge et le
      [périmètre initial de l'import](domain/gedcom-import.md) : personnes,
      filiations, relations de couple, événements, sources et médias,
      conformément à l'[ADR 0010](adr/0010-support-gedcom-551-and-70-with-dedicated-parsers.md).
- [x] Concevoir les modèles métier encore nécessaires à un import fidèle,
      notamment les [relations de couple](domain/couple-relationships.md) et
      les [dates généalogiques structurées](adr/0009-represent-genealogical-dates-as-structured-values.md).
- [x] Définir le
      [modèle GEDCOM intermédiaire normalisé et l'interface commune des parseurs](technical/gedcom-normalized-model.md).
- [x] Détecter la
      [version, le conteneur et l'encodage d'un fichier GEDCOM](technical/gedcom-file-detection.md).
- [x] Parser et valider un fichier GEDCOM 5.5.1 sans modifier la base de données, conformément à la [note technique du parseur](technical/gedcom-551-parser.md).
- [x] Parser et valider un fichier GEDCOM 7.0.x sans modifier la base de données, conformément à la [note technique du parseur](technical/gedcom-7-parser.md).
- [x] Fournir une [analyse commune aux deux versions](technical/gedcom-import-analysis.md) avec les éléments reconnus, ignorés, ambigus ou invalides.
- [x] Définir les correspondances entre les individus et familles GEDCOM et les personnes et relations Kinfolio.
- [x] Définir la stratégie de détection des doublons, de réimport et d'idempotence conformément à l'[ADR 0012](adr/0012-preview-and-reimport-gedcom-from-persistent-sources.md).
- [ ] Réaliser l'import de manière transactionnelle avec un rapport final, conformément à la [note technique dédiée](technical/gedcom-transactional-import.md), après la persistance des dates généalogiques structurées et des relations et événements de couple.
- [ ] Ajouter des tests pour les deux versions avec des fichiers synthétiques, des exports représentatifs anonymisés et un graphe réel volumineux préalablement anonymisé.
- [ ] Mesurer les performances et la consommation mémoire sur un arbre de plusieurs milliers de personnes.

Les fichiers contenant de véritables données familiales privées ne devront pas
être utilisés hors d'un environnement protégé. Le développement et les tests
précédant la phase de sécurité utiliseront uniquement des données synthétiques
ou anonymisées.

## Phase 6 — Contenus familiaux

- [ ] Concevoir la gestion des événements familiaux.
- [ ] Concevoir la gestion des anecdotes et souvenirs.
- [ ] Concevoir la gestion des photos et documents.
- [ ] Définir les règles d'association de ces contenus aux personnes et aux
      événements.
- [ ] Organiser ces contenus sous la forme d'un album interactif.

## Phase 7 — Sécurité et accès

L'authentification et les autorisations devront être en place avant d'utiliser
Kinfolio avec de véritables données familiales privées.

- [ ] Définir les comptes utilisateurs et le mécanisme d'authentification.
- [ ] Définir la notion de famille ou d'espace familial.
- [ ] Définir les rôles et permissions.
- [ ] Isoler les données entre les différents espaces familiaux.
- [ ] Protéger les photos, documents et informations personnelles.
- [ ] Prévoir la traçabilité des actions sensibles.

## Ordre recommandé des prochains tickets

À partir de l'état actuel du projet :

1. Réaliser l'import transactionnel et produire son rapport final.
2. Ajouter des exports représentatifs anonymisés et un graphe synthétique
   volumineux aux tests d'import.
3. Mesurer les performances et la consommation mémoire de l'import.
4. Publier le contrat OpenAPI et vérifier la génération du client web.
5. Mettre en place l'authentification, les espaces familiaux et les
   autorisations avant l'utilisation de données privées.
6. Concevoir puis implémenter les contenus de l'album familial.

## Décisions à revoir

Les sujets suivants restent volontairement ouverts :

- persistance des dates généalogiques structurées, alors que les colonnes des
  personnes utilisent encore PostgreSQL `DATE` ;
- persistance et API des relations et événements de couple ;
- stratégie de restauration et de purge définitive ;
- structure des espaces familiaux et modèle d'autorisation ;
- stockage des photos et documents.
