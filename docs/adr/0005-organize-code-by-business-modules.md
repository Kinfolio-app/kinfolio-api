# ADR 0005 — Organiser le code par modules métier

- **Statut :** Accepté
- **Date :** 2026-07-25

## Contexte

Fastify laisse volontairement à l'application le choix de son organisation.
La structure initiale de Kinfolio API regroupait les fichiers par rôle
technique dans des dossiers globaux tels que `models`, `services`,
`repositories` et `controllers`.

Cette organisation reste lisible avec peu de fonctionnalités, mais elle
disperse progressivement le code d'un même domaine dans plusieurs dossiers.
Une évolution concernant les personnes, par exemple, oblige à naviguer entre
les types, les règles métier, l'accès aux données et les routes HTTP situés à
des endroits différents.

Kinfolio doit accueillir plusieurs domaines liés mais distincts, notamment les
personnes, les relations familiales, les souvenirs, les événements et les
médias. L'organisation du code doit rendre les frontières entre ces domaines
visibles, limiter les dépendances implicites et rester suffisamment simple pour
le stade actuel du projet.

## Décision

Le code applicatif de Kinfolio API est organisé en priorité par **modules
métier** sous `src/modules`.

Chaque module regroupe les éléments qui lui appartiennent, selon ses besoins :

- les types du domaine ;
- les services et les règles métier ;
- les repositories et la conversion des données persistées ;
- les schémas de validation et de sérialisation ;
- les routes ou plugins Fastify exposant le module.

Par exemple :

```text
src/
├── modules/
│   └── people/
│       ├── person.types.ts
│       ├── person.repository.ts
│       ├── person.service.ts
│       ├── person.schema.ts
│       └── person.routes.ts
├── plugins/
├── config/
└── shared/
```

Un fichier ou une couche n'est créé que lorsqu'il remplit une responsabilité
réelle. Un module simple peut donc rester peu profond. Lorsqu'un module devient
volumineux, il peut être subdivisé en dossiers tels que `api`, `domain` et
`infrastructure`, sans imposer cette granularité à tous les modules.

Les dossiers transversaux conservent des responsabilités limitées :

- `config` contient le chargement et la validation de la configuration ;
- `plugins` contient les fonctionnalités techniques Fastify partagées par
  l'ensemble de l'application ;
- `shared` contient uniquement les abstractions réellement communes à plusieurs
  modules, comme les erreurs applicatives.

Le dossier `shared` ne doit pas devenir un emplacement par défaut pour du code
dont le propriétaire métier est incertain. Un élément reste dans son module
tant qu'un besoin concret de partage n'est pas établi.

Les dépendances suivent le flux général `routes → services → repositories`.
Les services et les types métier ne dépendent pas des objets HTTP de Fastify.
Les tests reprennent la même organisation par modules afin de rendre leur
périmètre explicite.

## Conséquences

### Conséquences positives

- Le code nécessaire à une fonctionnalité est regroupé dans un même
  emplacement.
- Les frontières entre les domaines métier sont visibles dans l'arborescence.
- L'impact d'une modification est plus facile à identifier.
- Les modules peuvent évoluer avec une complexité interne adaptée à leurs
  besoins.
- L'encapsulation des plugins Fastify peut être utilisée au niveau d'un module.
- L'extraction future d'un module devient plus accessible si elle est un jour
  nécessaire.

### Compromis et risques

- Deux modules peuvent contenir des fichiers portant des rôles similaires,
  comme un service ou un repository.
- Certaines dépendances entre domaines devront être rendues explicites plutôt
  que résolues par des imports arbitraires.
- Le choix du bon propriétaire pour un concept partagé peut demander une
  décision métier.
- Une subdivision prématurée en `api`, `domain` et `infrastructure` ajouterait
  du bruit ; elle doit rester motivée par la taille réelle du module.
- Sans vigilance, le dossier `shared` pourrait devenir un ensemble hétérogène
  et recréer le problème initial.

## Critères de réévaluation

Cette décision pourra être réévaluée si :

- les modules deviennent trop couplés pour conserver des frontières utiles ;
- un domaine atteint une taille justifiant une architecture interne plus
  stricte ;
- l'application évolue vers plusieurs services ou un monorepo ;
- des règles de dépendances automatisées deviennent nécessaires ;
- l'organisation ralentit la compréhension du code au lieu de l'améliorer.

Une réévaluation pourra introduire des interfaces plus strictes entre modules,
des points d'entrée publics, une architecture hexagonale ciblée ou une
séparation physique de certains domaines.

## Alternatives envisagées

### Dossiers globaux par couche technique

Cette structure regroupe tous les contrôleurs, services, repositories et types
dans des dossiers distincts. Elle a été écartée comme organisation principale,
car une fonctionnalité métier se retrouve dispersée dans toute l'application à
mesure que le nombre de domaines augmente.

### Architecture hexagonale complète

Une séparation systématique entre domaine, cas d'utilisation, ports et
adaptateurs offrirait des frontières plus strictes. Elle n'est pas retenue à ce
stade, car elle introduirait davantage d'interfaces, de dossiers et de code
d'assemblage que ne le justifie la complexité actuelle. Certains de ses
principes pourront être appliqués localement lorsqu'un module en bénéficiera.

### Structure limitée à `plugins` et `routes`

Cette organisation suit un modèle courant dans les applications Fastify
simples. Elle n'est pas suffisante comme seule convention pour Kinfolio, car les
modules métier contiendront également des types, des règles métier et un accès
aux données qui ne doivent pas être assimilés aux routes HTTP.
