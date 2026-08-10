# ADR 0004 — Utiliser du SQL direct pour l'accès aux données

- **Statut :** Accepté
- **Date :** 2026-07-24

## Contexte

Genealaine API utilise PostgreSQL comme base de données principale,
`node-pg-migrate` pour faire évoluer son schéma et `@fastify/postgres` pour
partager un pool de connexions dans l'application Fastify.

`@fastify/postgres` ne matérialise pas les tables PostgreSQL sous la forme de
classes ou d'objets TypeScript. Il expose principalement le pilote
`node-postgres`, l'exécution de requêtes et la gestion des transactions. Les
requêtes SQL, la conversion des lignes et les types du domaine restent donc à
la charge de l'application.

Des bibliothèques complémentaires permettraient de représenter le schéma de la
base dans le code, de construire des requêtes typées ou de générer un client.
Parmi les solutions envisageables figurent notamment Drizzle, Prisma, Kysely
et TypeORM.

## Décision

Dans un premier temps, Genealaine API utilise du **SQL direct** au sein de
repositories propres à chaque module métier.

Par exemple, le module `persons` contiendra un repository responsable des
requêtes sur la table `persons`. Les routes et les services métier
n'exécuteront pas directement de SQL.

Les responsabilités sont réparties ainsi :

- les migrations définissent et font évoluer le schéma PostgreSQL ;
- les repositories exécutent les requêtes SQL et convertissent les lignes ;
- les types TypeScript décrivent les données manipulées par l'application ;
- les services appliquent les règles métier ;
- les schémas Fastify valident les entrées et les réponses HTTP.

Les requêtes doivent être paramétrées. Les types TypeScript ne sont pas
considérés comme une source de vérité pour le schéma de la base : les
migrations versionnées remplissent ce rôle.

Cette décision permet de comprendre explicitement les échanges avec
PostgreSQL, conformément à l'objectif d'apprentissage du projet, tout en
évitant d'introduire une abstraction supplémentaire avant que sa valeur soit
démontrée.

## Conséquences

### Conséquences positives

- Les requêtes exécutées et leur coût restent visibles.
- Le projet conserve peu de dépendances et d'abstractions.
- Les fonctionnalités propres à PostgreSQL restent directement accessibles.
- La séparation par repositories évite de disperser le SQL dans les routes.
- L'apprentissage de PostgreSQL et de `node-postgres` fait partie du
  développement du projet.

### Compromis et risques

- Le schéma PostgreSQL et les types TypeScript doivent rester cohérents
  manuellement.
- Certaines conversions entre les lignes SQL et le domaine doivent être
  écrites explicitement.
- Les opérations courantes peuvent demander davantage de code qu'avec un ORM.
- Une requête incorrecte peut n'être détectée qu'à l'exécution si elle n'est
  pas couverte par les tests.
- Les tests d'intégration avec PostgreSQL sont importants pour valider les
  migrations et les repositories.

## Critères de réévaluation

Cette décision pourra être réévaluée si :

- le nombre de tables et de requêtes provoque trop de duplication ;
- les écarts entre les migrations et les types TypeScript deviennent fréquents ;
- les besoins de composition dynamique de requêtes augmentent fortement ;
- l'équipe souhaite générer automatiquement des types à partir du schéma ;
- la maintenance du SQL direct ralentit sensiblement le développement.

Dans ce cas, **Drizzle** ou **Kysely** seront évalués en priorité, car ils
conservent une approche proche du SQL tout en améliorant le typage. Prisma
pourra être considéré si la génération d'un client et un niveau d'abstraction
plus élevé deviennent préférables.

L'introduction d'un de ces outils devra faire l'objet d'un nouvel ADR qui
remplacera ou modifiera la présente décision.

## Alternatives envisagées

### Drizzle

Drizzle permet de définir un schéma en TypeScript et de construire des requêtes
typées tout en restant proche de SQL. Il n'est pas retenu immédiatement afin
d'éviter la coexistence prématurée de deux mécanismes de définition ou
d'évolution du schéma avec `node-pg-migrate`.

### Kysely

Kysely fournit un query builder TypeScript fortement typé et peu intrusif. Il
reste une option adaptée si la composition des requêtes devient plus complexe,
mais apporterait actuellement peu de valeur pour les premières opérations sur
les personnes.

### Prisma

Prisma fournit un schéma déclaratif, des migrations et un client généré. Il
n'est pas retenu, car il introduirait une abstraction et un workflow de schéma
plus importants que nécessaire à ce stade.

### TypeORM

TypeORM matérialise les entités sous forme de classes. Cette approche n'est pas
retenue, car elle masque davantage le SQL et introduit des mécanismes implicites
qui correspondent moins aux objectifs actuels du projet.
