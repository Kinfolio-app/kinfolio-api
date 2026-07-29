# Kinfolio API

Kinfolio API est le backend d'une application de généalogie pensée comme un **album familial interactif**. Le projet vise à réunir les personnes, les liens de parenté, les souvenirs et les documents d'une famille dans une expérience plus vivante qu'un arbre généalogique traditionnel.

Le dépôt est actuellement au stade de prototype fonctionnel. Le socle technique
de l'API Fastify et la première tranche métier consacrée à la gestion des
personnes sont terminés. Les liens parent-enfant directs sont également pris en
charge. La prochaine étape porte sur la consultation de l'arbre familial.

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
  doublons et des cycles ;
- tests automatisés avec Vitest et l'injection HTTP de Fastify ;
- route de santé `GET /health`, qui retourne `{ "status": "ok" }`.

### Prévues

Les fonctionnalités métier suivantes constituent des orientations envisagées. Elles ne sont pas encore implémentées :

- représentation et navigation dans l'arbre familial ;
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
Les règles pratiques de conception des routes, schémas et DTO sont regroupées
dans les [conventions de l'API HTTP](docs/api-conventions.md).

## Structure du projet

```text
.
├── src/
│   ├── config/
│   │   └── env.ts                  # Lecture et validation de l'environnement
│   ├── modules/
│   │   ├── health/
│   │   │   └── health.routes.ts    # Route de santé
│   │   ├── people/
│   │   │   ├── person.entity.ts     # Invariants et normalisation
│   │   │   ├── person.module.ts     # Assemblage du module Fastify
│   │   │   ├── person.repository.ts # Accès PostgreSQL
│   │   │   ├── person.routes.ts     # Routes HTTP des personnes
│   │   │   ├── person.schema.ts     # Schémas et DTO HTTP
│   │   │   ├── person.service.ts    # Logique métier
│   │   │   └── person.types.ts      # Types du domaine
│   │   └── relationships/           # Liens parent-enfant
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

Compilez le TypeScript dans `dist/`, puis lancez l'API en chargeant la configuration depuis `.env` :

```bash
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

Vérifiez ensuite la compilation, le lint et le formatage :

```bash
npm run check
```

## État du développement

Le socle technique, la gestion des personnes et la première version des liens
parent-enfant sont terminés. L'API permet de créer et consulter des relations
directes tout en empêchant les doublons, les auto-relations et les cycles. Ces
comportements sont couverts par des tests unitaires et des tests d'intégration
avec PostgreSQL. La navigation dans l'arbre, les relations de couple, les
souvenirs, les médias et le mécanisme d'authentification restent à implémenter.

La priorité immédiate est de concevoir la consultation de l'arbre familial.

## Prochaines étapes envisagées

- définir le format de représentation d'un arbre ou d'une branche familiale ;
- ajouter une route de consultation des proches d'une personne ;
- gérer la profondeur de parcours et la pagination ;
- évaluer les performances sur des arbres de taille importante ;
- concevoir ultérieurement les relations de couple ;
- mettre en place l'authentification et les autorisations avant la gestion de données familiales privées.

Le détail et l'ordre envisagé de ces étapes sont disponibles dans la [roadmap](docs/roadmap.md).

## Licence

Ce projet est distribué sous licence MIT. Consultez le fichier [LICENSE](LICENSE) pour plus d'informations.
