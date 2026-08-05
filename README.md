# Kinfolio API

Kinfolio API est le backend d'une application de généalogie pensée comme un **album familial interactif**. Le projet vise à réunir les personnes, les liens de parenté, les souvenirs et les documents d'une famille dans une expérience plus vivante qu'un arbre généalogique traditionnel.

Le dépôt est actuellement au stade de prototype fonctionnel. Le socle Fastify,
la gestion des personnes, les liens parent-enfant et la consultation bornée de
l'arbre familial sont opérationnels. Les fichiers GEDCOM 5.5.1 et 7.0.x peuvent
être détectés, analysés et projetés vers un plan d'import sans écriture en base.
La prochaine étape de ce parcours porte sur les doublons, le réimport et
l'idempotence.

## Vision du projet

Les informations familiales sont souvent dispersées entre albums photo, documents, souvenirs oraux et outils généalogiques parfois complexes. Il devient alors difficile de préserver ce patrimoine, de comprendre les liens entre les personnes et de le transmettre aux générations suivantes.

Kinfolio a pour ambition de centraliser cette histoire familiale et de permettre de la parcourir comme un album interactif : les membres d'une famille, leurs relations et leurs souvenirs doivent pouvoir être consultés dans un même espace, de manière simple et accessible.

## Fonctionnalités

### Déjà disponibles

Les fonctionnalités actuellement disponibles sont :

- démarrage d'un serveur HTTP Fastify sur le port `3000` ;
- écoute sur toutes les interfaces réseau (`0.0.0.0`) ;
- configuration de l'adresse et du port du serveur par variables d'environnement ;
- journalisation native de Fastify ;
- connexion à PostgreSQL au moyen d'un pool partagé par les plugins Fastify ;
- vérification de la disponibilité de PostgreSQL au démarrage ;
- infrastructure de migrations avec `node-pg-migrate` ;
- migration initiale de la table `persons` ;
- repository PostgreSQL et service métier initial du module `people` ;
- création, consultation, modification et suppression logique des personnes,
  avec prise en charge de leur genre ;
- création et consultation des liens parent-enfant directs, avec détection des
  doublons et des cycles, ainsi qu'un état de preuve ;
- consultation d'une branche familiale sous forme de graphe borné en profondeur
  et en nombre de personnes ;
- détection, parsing et analyse des fichiers GEDCOM 5.5.1 et 7.0.x en UTF-8 ;
- projection déterministe du document GEDCOM normalisé vers un plan contenant
  personnes, filiations, relations de couple, événements et diagnostics ;
- tests automatisés avec Vitest et l'injection HTTP de Fastify ;
- route de santé `GET /health`, qui retourne `{ "status": "ok" }`.

### Prévues

Les fonctionnalités métier suivantes constituent des orientations envisagées. Elles ne sont pas encore implémentées :

- détection des doublons, réimport et idempotence GEDCOM ;
- import transactionnel du plan GEDCOM avec un rapport final ;
- persistance et API des relations et événements de couple ;
- publication du contrat HTTP au format OpenAPI ;
- ajout de photos, documents, anecdotes et événements familiaux ;
- organisation de ces contenus sous la forme d'un album interactif ;
- évolution du schéma PostgreSQL avec les futurs domaines métier ;
- authentification et gestion des droits d'accès familiaux.

## Stack technique

- [Node.js](https://nodejs.org/) comme environnement d'exécution ;
- [TypeScript](https://www.typescriptlang.org/) avec une configuration stricte ;
- [Fastify](https://fastify.dev/) comme bibliothèque backend ;
- [PostgreSQL](https://www.postgresql.org/) comme base de données principale ;
- [`@fastify/postgres`](https://github.com/fastify/fastify-postgres) pour partager le pool de connexions dans l'application ;
- [`node-pg-migrate`](https://salsita.github.io/node-pg-migrate/) pour gérer les migrations PostgreSQL ;
- [Vitest](https://vitest.dev/) pour les tests automatisés ;
- npm pour la gestion des dépendances et des scripts.

Le choix de Fastify et sa comparaison avec NestJS sont détaillés dans l'[ADR 0001](docs/adr/0001-use-fastify-as-backend-framework.md).
Le choix de PostgreSQL est détaillé dans l'[ADR 0002](docs/adr/0002-use-postgresql-as-primary-database.md).
Le format standard des erreurs HTTP est détaillé dans l'[ADR 0003](docs/adr/0003-use-rfc-9457-for-api-errors.md).
Le choix initial du SQL direct dans les repositories, ainsi que les outils qui
pourront être réévalués plus tard, sont détaillés dans
l'[ADR 0004](docs/adr/0004-use-direct-sql-for-data-access.md).
L'organisation du code par modules métier est détaillée dans
l'[ADR 0005](docs/adr/0005-organize-code-by-business-modules.md).
Le format commun des réponses de collection est détaillé dans
l'[ADR 0006](docs/adr/0006-use-an-envelope-for-collection-responses.md).
La stratégie de suppression logique des personnes est détaillée dans
l'[ADR 0007](docs/adr/0007-use-soft-deletion-for-people.md).
La représentation des branches familiales est définie dans
l'[ADR 0008](docs/adr/0008-represent-family-branches-as-graphs.md).
La représentation des dates généalogiques est définie dans
l'[ADR 0009](docs/adr/0009-represent-genealogical-dates-as-structured-values.md).
Le support séparé de GEDCOM 5.5.1 et 7.0.x est défini dans
l'[ADR 0010](docs/adr/0010-support-gedcom-551-and-70-with-dedicated-parsers.md).
Les règles pratiques de conception des routes, schémas et DTO sont regroupées
dans les [conventions de l'API HTTP](docs/api-conventions.md).
La publication du contrat HTTP au format OpenAPI est définie dans
l'[ADR 0011](docs/adr/0011-publish-the-http-contract-as-openapi.md).

## Structure du projet

```text
.
├── src/
│   ├── config/
│   │   └── env.ts                  # Lecture et validation de l'environnement
│   ├── modules/
│   │   ├── health/
│   │   │   └── health.routes.ts    # Route de santé
│   │   ├── family-tree/             # Consultation bornée de l'arbre
│   │   ├── gedcom-import/           # Détection, parsing, analyse et mapping
│   │   ├── people/
│   │   │   ├── person.entity.ts     # Invariants et normalisation
│   │   │   ├── person.module.ts     # Assemblage du module Fastify
│   │   │   ├── person.repository.ts # Accès PostgreSQL
│   │   │   ├── person.routes.ts     # Routes HTTP des personnes
│   │   │   ├── person.schema.ts     # Schémas et DTO HTTP
│   │   │   ├── person.service.ts    # Logique métier
│   │   │   └── person.types.ts      # Types du domaine
│   │   └── relationships/           # Liens parent-enfant et types de couple
│   ├── plugins/
│   │   ├── database.ts             # Connexion et vérification de PostgreSQL
│   │   └── error-handler.ts        # Erreurs HTTP au format RFC 9457
│   ├── shared/
│   │   └── errors/                 # Erreurs partagées entre les modules
│   ├── app.ts                      # Construction de l'application Fastify
│   └── server.ts                   # Démarrage du serveur HTTP
├── migrations/                     # Migrations PostgreSQL
├── test/
│   ├── modules/
│   │   ├── gedcom-import/            # Tests des parseurs, analyses et mappings
│   │   ├── people/
│   │   │   ├── integration/        # Tests HTTP et PostgreSQL
│   │   │   └── unit/               # Tests du domaine
│   │   └── relationships/
│   │       ├── integration/        # Tests HTTP et PostgreSQL
│   │       └── unit/               # Tests du service métier
│   └── app.test.ts                 # Tests transversaux de l'application
├── docs/
│   ├── adr/                        # Décisions d'architecture
│   ├── domain/                     # Modèles et règles métier
│   ├── technical/                  # Contrats et notes d'implémentation
│   ├── api-conventions.md          # Conventions du contrat HTTP
│   └── roadmap.md                  # Roadmap du projet
├── .env.example                    # Exemple de configuration locale
├── package.json                    # Dépendances et scripts npm
├── package-lock.json               # Verrouillage des versions
└── tsconfig.json                   # Configuration TypeScript
```

Le code métier est organisé par modules fonctionnels. Chaque module regroupe
ses types, sa logique métier, son accès aux données et, lorsqu'elles existent,
ses routes HTTP. Le dossier `plugins/` contient uniquement les fonctionnalités
techniques partagées par l'ensemble de l'application.

La compilation génère le JavaScript dans `dist/`. Ce dossier n'est pas versionné.

## Installation

### Prérequis

- une version récente de Node.js prenant en charge l'option `--env-file` ;
- npm ;
- une instance PostgreSQL accessible localement.

Clonez le dépôt, puis installez les dépendances :

```bash
npm ci
```

Créez ensuite votre configuration locale à partir du fichier d'exemple :

```bash
cp .env.example .env
```

Adaptez la variable `DATABASE_URL` dans `.env` à votre instance PostgreSQL :

```dotenv
DATABASE_URL=postgresql://username:password@localhost:5432/database_name
PORT=3000
HOST=0.0.0.0
```

Le fichier `.env` peut contenir des informations sensibles et ne doit pas être versionné. Seul `.env.example`, qui contient des valeurs fictives, est conservé dans le dépôt.

## Compilation et lancement

Appliquez les migrations, compilez le TypeScript dans `dist/`, puis lancez
l'API en chargeant la configuration depuis `.env` :

```bash
npm run migrate
npm run build
npm start
```

Après compilation, l'API doit être accessible à l'adresse `http://localhost:3000`.

Une fois le serveur lancé, son état peut être vérifié avec :

```bash
curl http://localhost:3000/health
```

L'API doit répondre avec un statut HTTP `200` et le contenu suivant :

```json
{
    "status": "ok"
}
```

## Tests et vérifications

Lancez les tests automatisés :

```bash
npm test
```

Les tests d'intégration nécessitent une base configurée dans `.env.test` :

```bash
npm run migrate:test
npm run test:integration
```

Vérifiez ensuite la compilation, le lint et le formatage :

```bash
npm run check
```

## État du développement

Le socle technique, les personnes, les liens parent-enfant et la consultation
de l'arbre familial sont terminés. Le pipeline GEDCOM détecte et parse les deux
versions ciblées, produit une analyse commune puis un plan de correspondance
vers le domaine Kinfolio. Cette projection reste sans effet sur PostgreSQL.

Les relations de couple et leurs événements disposent de types métier et d'une
projection GEDCOM, mais pas encore de tables, repositories ou routes HTTP. Les
souvenirs, les médias persistés et l'authentification restent également à
implémenter.

La priorité immédiate de l'import est de définir la détection des doublons, le
réimport et l'idempotence avant toute écriture transactionnelle.

## Prochaines étapes envisagées

- définir la stratégie de détection des doublons et de réimport GEDCOM ;
- implémenter l'import transactionnel et son rapport final ;
- tester des exports représentatifs anonymisés et mesurer les performances ;
- publier le contrat HTTP OpenAPI ;
- persister et exposer les relations et événements de couple lorsque le
  parcours produit le nécessite ;
- mettre en place l'authentification et les autorisations avant la gestion de données familiales privées.

Le détail et l'ordre envisagé de ces étapes sont disponibles dans la [roadmap](docs/roadmap.md).

## Licence

Ce projet est distribué sous licence MIT. Consultez le fichier [LICENSE](LICENSE) pour plus d'informations.
