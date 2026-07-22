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
- journalisation native de Fastify ;
- route `GET /`, qui retourne `{ "hello": "world" }` ;
- route `GET /ping`, qui retourne `pong`.

### Prévues

Les fonctionnalités métier suivantes constituent des orientations envisagées. Elles ne sont pas encore implémentées :

- gestion des personnes et de leurs informations biographiques ;
- création et consultation des liens de parenté ;
- représentation et navigation dans l'arbre familial ;
- ajout de photos, documents, anecdotes et événements familiaux ;
- organisation de ces contenus sous la forme d'un album interactif ;
- persistance des données ;
- authentification et gestion des droits d'accès familiaux.

## Stack technique

- [Node.js](https://nodejs.org/) comme environnement d'exécution ;
- [TypeScript](https://www.typescriptlang.org/) avec une configuration stricte ;
- [Fastify](https://fastify.dev/) comme bibliothèque backend ;
- npm pour la gestion des dépendances et des scripts.

Le choix de Fastify et sa comparaison avec NestJS sont détaillés dans l'[ADR 0001](docs/adr/0001-use-fastify-as-backend-framework.md).

## Structure du projet

```text
.
├── docs/
│   └── adr/          # Décisions d'architecture
├── index.ts          # Création et démarrage du serveur Fastify
├── route.ts          # Routes HTTP actuellement disponibles
├── package.json      # Dépendances et scripts npm
├── package-lock.json # Verrouillage des versions des dépendances
└── tsconfig.json     # Configuration TypeScript
```

## Installation

### Prérequis

- Node.js ;
- npm.

Clonez le dépôt, puis installez les dépendances :

```bash
npm ci
```

## Compilation et lancement

Le workflow prévu par les scripts du projet est le suivant :

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

Kinfolio API est en phase d'initialisation. Le serveur, le routage minimal et la configuration TypeScript sont présents. En revanche, aucun modèle de domaine généalogique, stockage de données, mécanisme d'authentification, test automatisé ou contrat d'API n'existe encore.

La priorité immédiate est de stabiliser ce socle avant de commencer l'implémentation du domaine métier.

## Prochaines étapes envisagées

- fiabiliser les scripts de lancement ;
- structurer le code par responsabilités ;
- définir le modèle de données généalogique ;
- choisir et intégrer une solution de persistance ;
- concevoir les premières routes métier ;
- ajouter la validation des entrées, la gestion des erreurs et des tests automatisés ;
- documenter le contrat de l'API ;
- mettre en place l'authentification et les autorisations avant la gestion de données familiales privées.

## Licence

Ce projet est distribué sous licence MIT. Consultez le fichier [LICENSE](LICENSE) pour plus d'informations.
