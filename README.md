# Kinfolio API

Kinfolio API est le backend d'une application de généalogie pensée comme un **album familial interactif**. Le projet vise à réunir les personnes, les liens de parenté, les souvenirs et les documents d'une famille dans une expérience plus vivante qu'un arbre généalogique traditionnel.

Le dépôt est actuellement au stade de prototype technique. Il contient le socle minimal d'une API Fastify, mais ne propose pas encore de fonctionnalités métier liées à la généalogie.

## Vision du projet

Les informations familiales sont souvent dispersées entre albums photo, documents, souvenirs oraux et outils généalogiques parfois complexes. Il devient alors difficile de préserver ce patrimoine, de comprendre les liens entre les personnes et de le transmettre aux générations suivantes.

Kinfolio a pour ambition de centraliser cette histoire familiale et de permettre de la parcourir comme un album interactif : les membres d'une famille, leurs relations et leurs souvenirs doivent pouvoir être consultés dans un même espace, de manière simple et accessible.

## Fonctionnalités

### Déjà disponibles

Le périmètre actuellement implémenté est limité à la validation du socle backend :

- démarrage d'un serveur HTTP Fastify sur le port `3000` ;
- écoute sur toutes les interfaces réseau (`0.0.0.0`) ;
- configuration de l'adresse et du port du serveur par variables d'environnement ;
- journalisation native de Fastify ;
- connexion à PostgreSQL au moyen d'un pool partagé par les plugins Fastify ;
- route `GET /`, qui retourne `{ "hello": "world" }` ;
- route `GET /ping`, qui retourne `pong`.

### Prévues

Les fonctionnalités métier suivantes constituent des orientations envisagées. Elles ne sont pas encore implémentées :

- gestion des personnes et de leurs informations biographiques ;
- création et consultation des liens de parenté ;
- représentation et navigation dans l'arbre familial ;
- ajout de photos, documents, anecdotes et événements familiaux ;
- organisation de ces contenus sous la forme d'un album interactif ;
- définition du schéma PostgreSQL et persistance des données métier ;
- authentification et gestion des droits d'accès familiaux.

## Stack technique

- [Node.js](https://nodejs.org/) comme environnement d'exécution ;
- [TypeScript](https://www.typescriptlang.org/) avec une configuration stricte ;
- [Fastify](https://fastify.dev/) comme bibliothèque backend ;
- [PostgreSQL](https://www.postgresql.org/) comme base de données principale ;
- [`@fastify/postgres`](https://github.com/fastify/fastify-postgres) pour partager le pool de connexions dans l'application ;
- npm pour la gestion des dépendances et des scripts.

Le choix de Fastify et sa comparaison avec NestJS sont détaillés dans l'[ADR 0001](docs/adr/0001-use-fastify-as-backend-framework.md).
Le choix de PostgreSQL est détaillé dans l'[ADR 0002](docs/adr/0002-use-postgresql-as-primary-database.md).

## Structure du projet

```text
.
├── src/
│   ├── config/
│   │   └── db.ts      # Configuration du pool de connexions PostgreSQL
│   ├── index.ts       # Création et démarrage du serveur Fastify
│   └── route.ts       # Routes HTTP actuellement disponibles
├── docs/
│   └── adr/          # Décisions d'architecture
├── .env.example      # Exemple de configuration locale
├── package.json      # Dépendances et scripts npm
├── package-lock.json # Verrouillage des versions des dépendances
└── tsconfig.json     # Configuration TypeScript
```

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

Une fois le serveur lancé, les routes de démonstration peuvent être appelées ainsi :

```bash
curl http://localhost:3000/
curl http://localhost:3000/ping
```

## État du développement

Kinfolio API est en phase d'initialisation. Le serveur, le routage minimal, la configuration TypeScript et le connecteur PostgreSQL sont présents. En revanche, aucun schéma de données, modèle de domaine généalogique, accès métier à la base, mécanisme d'authentification, test automatisé ou contrat d'API n'existe encore.

La priorité immédiate est de stabiliser ce socle avant de commencer l'implémentation du domaine métier.

## Prochaines étapes envisagées

- valider la configuration au démarrage et vérifier la disponibilité de PostgreSQL ;
- définir le modèle de données généalogique ;
- créer le schéma PostgreSQL et mettre en place les migrations ;
- concevoir les premières routes métier ;
- ajouter la validation des entrées, la gestion des erreurs et des tests automatisés ;
- documenter le contrat de l'API ;
- mettre en place l'authentification et les autorisations avant la gestion de données familiales privées.

## Licence

Ce projet est distribué sous licence MIT. Consultez le fichier [LICENSE](LICENSE) pour plus d'informations.
