# Stratégie de tests

Ce document décrit l'organisation générale des tests de Genealaine API. Les scénarios propres à une fonctionnalité restent documentés dans sa note technique, par exemple la [stratégie de tests de l'import GEDCOM](technical/gedcom-transactional-import.md#stratégie-de-tests).

## Objectifs

La suite de tests doit :

- protéger les comportements observables et les règles métier importantes ;
- détecter les écarts entre TypeScript, les requêtes SQL et PostgreSQL ;
- fournir un diagnostic précis lorsqu'une régression apparaît ;
- rester déterministe, suffisamment rapide et simple à maintenir ;
- ne jamais exposer de véritables données familiales privées.

Un comportement est testé au niveau le plus bas qui apporte une confiance suffisante. Un test de niveau supérieur n'est ajouté que lorsqu'il vérifie une intégration que les niveaux inférieurs ne peuvent pas couvrir.

## Choisir le niveau de test

| Besoin à vérifier                               | Niveau privilégié                | Exemple                                          |
| ----------------------------------------------- | -------------------------------- | ------------------------------------------------ |
| Calcul ou règle métier sans dépendance externe  | Test unitaire                    | Fusion à trois versions d'un champ importé       |
| Parsing ou transformation déterministe          | Test unitaire                    | Conversion d'un document GEDCOM en plan d'import |
| Requête SQL, conversion de ligne ou contrainte  | Test d'intégration de repository | Unicité d'une empreinte par source               |
| Validation et représentation HTTP               | Test d'intégration de route      | Refus d'un identifiant ou d'un corps invalide    |
| Parcours impliquant plusieurs requêtes ou états | Scénario fonctionnel             | Prévisualiser, résoudre puis confirmer un import |
| Temps, mémoire ou comportement à grande échelle | Benchmark dédié                  | Parcours d'un arbre proche de 500 personnes      |

Cette classification décrit la responsabilité du test plutôt que les outils qu'il utilise. Un test de service avec plusieurs objets métier réels peut rester unitaire tant qu'il ne traverse pas une frontière externe telle que PostgreSQL ou HTTP.

## Tests unitaires

Les tests unitaires couvrent en priorité :

- les branches des règles métier ;
- les valeurs limites et les erreurs attendues ;
- les parseurs, normalisations et mappings déterministes ;
- la production de rapports et de diagnostics ;
- les comportements de service indépendants de PostgreSQL.

Ils sont placés dans `test/modules/<module>/unit/` ou dans le dossier partagé
correspondant sous `test/shared/`.

Les dépendances sont remplacées uniquement lorsqu'elles représentent une vraie frontière. Il faut éviter de reproduire le comportement de PostgreSQL dans un mock : une imitation de la base ne valide ni le SQL, ni les contraintes, ni les transactions.

## Tests d'intégration des repositories

Les repositories sont testés avec une véritable instance PostgreSQL. Ces tests vérifient ce que TypeScript seul ne peut pas garantir :

- la validité et le résultat des requêtes SQL ;
- la conversion entre les lignes PostgreSQL et les types du domaine ;
- les clés étrangères, contraintes d'unicité et contraintes différées ;
- les opérations `ON CONFLICT` et l'idempotence ;
- les transactions, verrous et annulations complètes.

Ils sont placés dans `test/modules/<module>/integration/`. Lorsque cela est
possible, chaque test ouvre une transaction dans `beforeEach`, utilise le même
client PostgreSQL pour toutes ses écritures, puis exécute un `ROLLBACK` dans
`afterEach`. Cette isolation évite qu'un test dépende des données laissées par
un autre.

Un test de repository doit cibler un comportement persistant significatif. Il
n'est pas nécessaire de dupliquer mécaniquement chaque lecture triviale déjà
couverte par un parcours d'intégration plus utile.

## Tests d'intégration des routes

Les routes Fastify sont testées avec `app.inject()`. Cette méthode exerce le cycle HTTP de l'application sans ouvrir de port réseau.

Ces tests vérifient au minimum, selon le contrat de la route :

- le statut HTTP et le type de contenu ;
- la structure sérialisée de la réponse ;
- l'application des schémas TypeBox ;
- le refus des champs et paramètres inconnus ;
- les erreurs RFC 9457 sans détail interne sensible ;
- un cas nominal et les principales frontières HTTP.

Les variantes exhaustives d'une règle métier restent dans les tests unitaires du service. Les répéter à travers toutes les routes rendrait la suite plus lente et plus coûteuse à modifier sans apporter la même précision de diagnostic.

Les suites de routes qui partagent la base nettoient les tables dans l'ordre de dépendance avant et après leur exécution. Lorsqu'une migration ajoute une clé étrangère, les listes de nettoyage concernées doivent être adaptées dans le même changement.

## Scénarios fonctionnels et contrat OpenAPI

Un scénario fonctionnel couvre un parcours métier composé de plusieurs étapes et vérifie les transitions d'état importantes. Leur nombre doit rester limité aux parcours qui apportent une confiance supplémentaire par rapport aux tests de services, repositories et routes.

Lorsque le contrat OpenAPI sera publié, sa génération déterministe et sa compatibilité avec les réponses Fastify feront partie des vérifications. Le contrat ne remplacera pas les tests d'exécution des routes.

## Base PostgreSQL de test

Les tests d'intégration utilisent exclusivement la base configurée dans `.env.test`. Les gardes présentes dans les suites refusent une base portant un autre nom que la base de test attendue.

Préparer le schéma puis lancer les tests :

```bash
npm run migrate:test
npm run test:integration
```

Les tests d'intégration sont exécutés sans parallélisme entre fichiers afin de préserver l'isolation des suites qui partagent cette base.

Une instance PostgreSQL jetable avec Testcontainers pourra être envisagée si la configuration manuelle de la base devient une source d'écarts entre les machines locales et l'intégration continue. Ce n'est pas une dépendance actuelle du projet.

## Données de test et confidentialité

- Utiliser uniquement des personnes, familles et lieux synthétiques dans les tests versionnés.
- Ne jamais copier un fichier familial réel dans le repository, les logs, les snapshots ou les rapports de test.
- Un export représentatif provenant d'un logiciel tiers doit être anonymisé avant toute utilisation hors d'un environnement protégé.
- Les jeux privés destinés aux mesures locales restent dans un dossier ignoré par Git.
- Les assertions et noms de tests ne doivent contenir aucune donnée identifiable.

## Écriture et maintenance des tests

- Nommer les tests en anglais d'après le comportement attendu, et non d'après l'implémentation interne.
- Garder un comportement principal par test.
- Structurer clairement la préparation, l'action et les assertions sans ajouter de commentaires décoratifs lorsque la séparation visuelle suffit.
- Préférer des données minimales qui rendent la raison d'un échec évidente.
- Éviter les délais réels, l'heure courante non contrôlée et les dépendances à l'ordre d'exécution.
- Ne pas conserver de `.only` ou de `.skip` dans un changement terminé.
- Corriger une régression avec un test au niveau le plus précis capable de la reproduire.
- Éviter de tester plusieurs fois la même règle à tous les niveaux sans raison d'intégration explicite.

Le projet ne fixe pas actuellement de pourcentage minimal de couverture. Une augmentation du chiffre de couverture ne remplace pas des assertions portant sur les risques métier, les erreurs et les frontières techniques importantes.

## Commandes usuelles

Exécuter les tests unitaires :

```bash
npm test
```

Exécuter les tests en mode surveillance :

```bash
npm run test:watch
```

Exécuter les tests d'intégration PostgreSQL :

```bash
npm run migrate:test
npm run test:integration
```

Vérifier la compilation, le lint et le formatage :

```bash
npm run check
```

Avant de terminer un changement, lancer les tests ciblés pendant le développement, puis les suites concernées par les frontières modifiées. Une modification de migration, repository ou transaction nécessite les tests d'intégration PostgreSQL.

## Références externes

- [The Practical Test Pyramid](https://martinfowler.com/articles/practical-test-pyramid.html), pour raisonner sur la granularité et éviter la duplication entre niveaux.
- [Vitest — Testing in Practice](https://vitest.dev/guide/learn/testing-in-practice), pour structurer des tests centrés sur leur contrat et leur comportement.
- [Fastify — Testing](https://fastify.dev/docs/latest/Guides/Testing/), notamment pour la séparation de `buildApp()` et l'utilisation de `app.inject()`.
- [node-postgres — Transactions](https://node-postgres.com/features/transactions), pour l'utilisation d'un même client pendant toute une transaction.
- [Testcontainers for Node.js — PostgreSQL](https://node.testcontainers.org/modules/postgresql/), comme piste future pour une base de test reproductible et jetable.
