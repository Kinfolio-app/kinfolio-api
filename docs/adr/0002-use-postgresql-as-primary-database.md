# ADR 0002 — Utiliser PostgreSQL comme base de données principale

- **Statut :** Accepté
- **Date :** 2026-07-22

## Contexte

Kinfolio a pour objectif de centraliser les personnes, les liens de parenté, les événements, les souvenirs et les documents d'une famille. Ces données doivent pouvoir être consultées et modifiées par plusieurs utilisateurs, depuis plusieurs appareils, tout en respectant les droits d'accès propres à chaque espace familial.

Le domaine contient de nombreuses relations structurées : une personne appartient à un arbre familial, peut être liée à plusieurs autres personnes, participer à des événements et être associée à des souvenirs ou à des médias. Certaines opérations devront modifier plusieurs éléments de manière atomique et garantir que les références entre eux restent cohérentes.

Un stockage uniquement local chez l'utilisateur offrirait davantage de contrôle sur les données personnelles, mais compliquerait fortement la synchronisation entre appareils, la collaboration familiale, la sauvegarde et la gestion des conflits. Un stockage dans des fichiers sur le serveur ne fournirait pas les garanties transactionnelles, les contraintes d'intégrité et les capacités de requête nécessaires au projet.

## Décision

J'utilise **PostgreSQL** comme base de données principale de Kinfolio API.

PostgreSQL stockera les données structurées et les métadonnées de l'application, notamment :

- les utilisateurs et les espaces familiaux ;
- les membres et leurs droits d'accès ;
- les personnes et leurs informations biographiques ;
- les relations entre les personnes ;
- les événements et les souvenirs ;
- les métadonnées et les références des photos et des documents.

Les fichiers volumineux, tels que les photos, les vidéos et les documents numérisés, ne seront pas stockés directement dans PostgreSQL. Ils seront placés dans une solution de stockage de fichiers adaptée. PostgreSQL conservera leur identifiant, leur emplacement, leurs métadonnées et les informations nécessaires au contrôle d'accès.

PostgreSQL est retenu pour les raisons suivantes :

- son modèle relationnel correspond aux liens structurés du domaine généalogique ;
- les clés étrangères et les contraintes permettent de protéger l'intégrité des données ;
- les transactions permettent d'appliquer de manière atomique les modifications portant sur plusieurs entités ;
- les requêtes récursives permettent de parcourir les ascendants et les descendants ;
- les types JSON offrent de la flexibilité pour des informations exceptionnelles sans abandonner un schéma relationnel ;
- il convient à une application centralisée utilisée simultanément par plusieurs familles et plusieurs appareils.

Le choix d'un outil de migration, d'un pilote PostgreSQL ou d'une bibliothèque d'accès aux données n'est pas couvert par cette décision et fera l'objet d'une évaluation séparée.

## Conséquences

### Conséquences positives

- Les relations entre les entités sont explicites et peuvent être validées par la base de données.
- Les modifications importantes peuvent être regroupées dans des transactions.
- Le modèle pourra prendre en charge la collaboration et la consultation depuis plusieurs appareils.
- Les parcours généalogiques peuvent être implémentés sans introduire immédiatement une base orientée graphe.
- Les fonctionnalités relationnelles et JSON permettent de combiner cohérence et flexibilité.

### Compromis et risques

- PostgreSQL doit être installé, configuré, supervisé et sauvegardé dans les environnements d'exécution.
- Le schéma devra évoluer au moyen de migrations versionnées.
- La modélisation des relations généalogiques et des cas particuliers demande un travail de conception initial.
- La centralisation de données familiales privées impose de mettre en place l'authentification, les autorisations, le chiffrement, les sauvegardes et des mécanismes d'export.
- Le stockage des fichiers devra être géré par un composant distinct et coordonné avec les enregistrements conservés dans PostgreSQL.

Ces compromis sont acceptés, car ils apportent les garanties de cohérence et les capacités de collaboration attendues pour Kinfolio.

## Alternatives envisagées

### Ne pas utiliser de base de données

Le stockage en mémoire ou dans des fichiers a été écarté. Il ne fournit pas de solution suffisamment robuste pour les requêtes, les écritures concurrentes, les transactions, l'intégrité référentielle et l'évolution du format des données.

### Stockage local chez l'utilisateur

Une architecture locale pourrait renforcer le contrôle de l'utilisateur sur ses données. Elle n'a pas été retenue comme architecture principale, car elle rendrait plus complexes la synchronisation, le partage familial, la sauvegarde et la résolution des conflits. La possibilité d'exporter et de récupérer les données devra néanmoins être préservée.

### SQLite

SQLite a été envisagé pour sa simplicité et son absence de serveur dédié. Il conviendrait à un prototype local ou mono-utilisateur, mais il est moins adapté à une application centralisée susceptible de recevoir plusieurs écritures simultanées.

### MongoDB

MongoDB a été envisagé pour la flexibilité de son modèle documentaire. Il n'a pas été retenu, car les données principales de Kinfolio possèdent de nombreuses relations et contraintes de cohérence. Les représenter par des documents imbriqués ou des références applicatives augmenterait la complexité du modèle sans apporter de bénéfice déterminant pour le projet.

### Neo4j

Neo4j a été envisagé, car un arbre familial peut naturellement être représenté sous la forme d'un graphe. Il n'a pas été retenu comme base principale, car une grande partie des données de Kinfolio reste relationnelle et les parcours généalogiques prévus peuvent être réalisés avec les requêtes récursives de PostgreSQL. Ce choix pourra être réévalué si l'analyse de graphes devient un besoin central et difficile à satisfaire avec PostgreSQL.

### MySQL

MySQL fournirait les principales fonctionnalités relationnelles nécessaires au projet. PostgreSQL a été préféré pour la richesse de ses types, de ses contraintes et de ses fonctionnalités de requête, ainsi que pour sa capacité à combiner un modèle relationnel avec des données JSON.
