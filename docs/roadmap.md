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

## Phase 2 — Première tranche métier : les personnes

La première fonctionnalité sera développée de manière verticale : schéma de
base de données, accès aux données, logique métier, routes, validation et tests.

### Modèle initial envisagé

Créer une table `persons` contenant au minimum :

- `id` ;
- `first_name` ;
- `middle_names` ;
- `last_name` ;
- `birth_date` ;
- `death_date` ;
- `birth_place` ;
- `biography` ;
- `created_at` ;
- `updated_at`.

La liste exacte des champs et leurs contraintes seront revues avant la création
de la migration.

### Implémentation

- [x] Créer la migration initiale de la table `persons`.
- [x] Créer la couche d'accès aux données des personnes.
- [x] Ajouter la logique métier associée.
- [ ] Définir les schémas de validation des entrées et des réponses.
- [x] Implémenter `POST /people`.
- [x] Implémenter `GET /people/:id`.
- [x] Ajouter les tests d'intégration de ces deux routes.
- [ ] Implémenter `GET /people`.
- [ ] Implémenter `PATCH /people/:id`.
- [ ] Décider de la stratégie de suppression avant d'ajouter
      `DELETE /people/:id`.

La suppression devra notamment prendre en compte les futures relations, photos,
documents et souvenirs associés à une personne.

## Phase 3 — Liens de parenté

Une fois la gestion des personnes stabilisée, ajouter les relations familiales.

Le modèle initial envisagé est une table `parent_child_relationships` contenant
notamment :

- `parent_id` ;
- `child_id` ;
- `relationship_type`.

Une table de relations distincte est préférée à des colonnes `father_id` et
`mother_id` dans `persons`. Elle permet de représenter plus facilement les
familles adoptives ou recomposées ainsi que les informations incomplètes.

- [ ] Préciser les différents types de relations pris en charge.
- [ ] Définir les contraintes et règles métier des liens de parenté.
- [ ] Créer la migration correspondante.
- [ ] Ajouter les opérations de création et de consultation des relations.
- [ ] Empêcher les relations incohérentes ou cycliques lorsque cela est
      nécessaire.
- [ ] Ajouter les tests métier et les tests d'intégration.

## Phase 4 — Consultation de l'arbre familial

- [ ] Définir le format de représentation d'un arbre ou d'une branche familiale.
- [ ] Ajouter une route permettant de consulter les proches d'une personne.
- [ ] Gérer la profondeur de parcours et la pagination si nécessaire.
- [ ] Évaluer les performances sur des arbres de taille importante.

## Phase 5 — Contenus familiaux

- [ ] Concevoir la gestion des événements familiaux.
- [ ] Concevoir la gestion des anecdotes et souvenirs.
- [ ] Concevoir la gestion des photos et documents.
- [ ] Définir les règles d'association de ces contenus aux personnes et aux
      événements.
- [ ] Organiser ces contenus sous la forme d'un album interactif.

## Phase 6 — Sécurité et accès

L'authentification et les autorisations devront être en place avant d'utiliser
Kinfolio avec de véritables données familiales privées.

- [ ] Définir les comptes utilisateurs et le mécanisme d'authentification.
- [ ] Définir la notion de famille ou d'espace familial.
- [ ] Définir les rôles et permissions.
- [ ] Isoler les données entre les différents espaces familiaux.
- [ ] Protéger les photos, documents et informations personnelles.
- [ ] Prévoir la traçabilité des actions sensibles.

## Ordre recommandé des prochains tickets

1. Validation de la configuration et vérification de PostgreSQL.
2. Mise en place des migrations.
3. Infrastructure minimale de tests.
4. Endpoint `GET /health`.
5. Migration `create_persons`.
6. Route `POST /people` avec validation.
7. Route `GET /people/:id`.
8. Tests d'intégration des premières routes métier.
9. Liste et modification des personnes.
10. Relations parent-enfant.
11. Consultation de l'arbre familial.
12. Authentification et autorisations avant l'utilisation de données privées.

## Décisions à revoir

Les sujets suivants restent volontairement ouverts :

- choix de l'outil de migrations ;
- utilisation de SQL direct, d'un query builder ou d'un ORM ;
- champs définitifs du modèle `persons` ;
- représentation des noms, lieux et dates incertaines ;
- types de liens familiaux pris en charge ;
- stratégie de suppression et d'archivage ;
- structure des espaces familiaux et modèle d'autorisation ;
- stockage des photos et documents.
