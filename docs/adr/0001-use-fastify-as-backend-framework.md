# ADR 0001 — Utiliser Fastify comme bibliothèque backend

- **Statut :** Accepté
- **Date :** 2026-07-22

## Contexte

Le projet Kinfolio API a notamment pour objectif de me permettre d'apprendre Node.js et de mieux comprendre le fonctionnement d'une application backend.

NestJS fournit un cadre très structuré et de nombreuses abstractions prêtes à l'emploi, notamment pour l'injection de dépendances, les contrôleurs, les modules, les gardes et les intercepteurs. Ces abstractions facilitent le développement d'une application, mais elles masquent aussi une partie des mécanismes sous-jacents de Node.js et du traitement d'une requête HTTP.

Pour ce projet d'apprentissage, je souhaite manipuler plus directement ces mécanismes : cycle de vie d'une requête, middleware, routage, validation, gestion des erreurs, configuration et organisation de l'application.

## Décision

J'utilise **Fastify** comme bibliothèque backend pour développer Kinfolio API.

Fastify fournit les éléments essentiels pour construire une API HTTP tout en restant moins prescriptif que NestJS. Ce choix me permet de définir moi-même l'architecture de l'application et d'implémenter explicitement ses différents composants. L'objectif est de comprendre leur rôle et leurs interactions plutôt que de les utiliser principalement au travers des abstractions d'un framework plus complet.

Fastify est préféré à NestJS dans ce contexte pour les raisons suivantes :

- il expose plus directement le cycle de vie des requêtes et des réponses ;
- il permet d'apprendre concrètement le fonctionnement des hooks, des plugins et des middleware ;
- il laisse davantage de liberté dans l'organisation du code et le choix des dépendances ;
- il offre un socle léger, performant et adapté à TypeScript ;
- il limite les conventions implicites afin de rendre les choix techniques plus visibles.

## Conséquences

### Conséquences positives

- Une meilleure compréhension de Node.js et des mécanismes HTTP sous-jacents.
- Un apprentissage plus approfondi de la composition d'une application backend.
- Des décisions d'architecture explicites et adaptées aux besoins du projet.
- Moins de dépendance aux conventions propres à un framework complet.

### Compromis et risques

- Davantage de décisions d'architecture doivent être prises et documentées dans le projet.
- Certaines fonctionnalités fournies nativement par NestJS devront être intégrées ou développées séparément.
- La cohérence du code dépendra davantage des conventions définies par le projet.
- La mise en place initiale peut demander plus de travail.

Ces compromis sont acceptables, car l'objectif principal est l'apprentissage. Le temps consacré à comprendre et à assembler ces mécanismes fait partie de la valeur recherchée.

## Alternatives envisagées

### NestJS

NestJS a été envisagé pour sa structure, son intégration avec TypeScript et son écosystème. Il n'a pas été retenu, car ses abstractions et ses conventions prennent en charge une part importante de l'architecture. Cela réduirait les occasions d'explorer directement les mécanismes que ce projet doit permettre d'apprendre.

Cette décision pourra être réévaluée si les objectifs du projet évoluent, notamment si la rapidité de développement, la standardisation de l'architecture ou la collaboration au sein d'une équipe deviennent prioritaires par rapport à l'apprentissage.
