# Conventions de l'API HTTP

Ce document rassemble les conventions pratiques utilisées pour concevoir les
routes HTTP de Kinfolio API. Il constitue un guide vivant : il évolue lorsque
le contrat public de l'API évolue, contrairement aux ADR qui conservent
l'historique et la justification des décisions structurantes.

Les conventions décrites ici s'appliquent au contrat HTTP public. Elles ne
définissent ni l'organisation interne des modules, ni le schéma PostgreSQL, ni
les règles métier de la généalogie.

## Routes et ressources

Les chemins représentent des ressources et utilisent des noms anglais au
pluriel. Les routes suivantes sont des exemples représentatifs et ne
constituent pas une liste exhaustive de l'API :

```text
POST /people
GET  /people
GET  /people/:id
PATCH /people/:id
DELETE /people/:id
```

Un verbe d'action n'est pas ajouté au chemin lorsque la méthode HTTP exprime
déjà l'opération. Par exemple, la création utilise `POST /people` et non
`POST /people/create`.

Les identifiants publics sont des UUID représentés par des chaînes de
caractères.

## Méthodes et statuts HTTP

Les routes utilisent les statuts HTTP selon la sémantique de l'opération :

| Opération                        | Statut attendu              |
| -------------------------------- | --------------------------- |
| Consultation réussie             | `200 OK`                    |
| Création réussie                 | `201 Created`               |
| Suppression réussie sans contenu | `204 No Content`            |
| Requête invalide                 | `400 Bad Request`           |
| Ressource inexistante            | `404 Not Found`             |
| Conflit métier                   | `409 Conflict`              |
| Erreur inattendue                | `500 Internal Server Error` |

Les constantes partagées de `HttpStatus` sont utilisées dans le code afin
d'éviter de répéter directement les valeurs numériques.

## Schémas et DTO

TypeBox décrit les contrats HTTP. Un même objet fournit :

- un schéma disponible à l'exécution pour Fastify ;
- un type TypeScript dérivé avec `Type.Static`.

Le schéma constitue la source de vérité du DTO. Un type indépendant ne doit pas
dupliquer manuellement sa structure.

```ts
export const PersonIdParamsSchema = Type.Object(
    {
        id: Type.String({ format: 'uuid' }),
    },
    {
        additionalProperties: false,
    },
);

export type PersonIdParamsDto = Type.Static<typeof PersonIdParamsSchema>;
```

Les constantes de schéma se terminent par `Schema`. Les types représentant les
données du contrat HTTP se terminent par `Dto`. Le nom indique également le
rôle du contrat lorsque cela est nécessaire :

| Rôle                  | Exemple de schéma                | Exemple de DTO                |
| --------------------- | -------------------------------- | ----------------------------- |
| Corps de création     | `CreatePersonDtoSchema`          | `CreatePersonDto`             |
| Paramètres de `/:id`  | `PersonIdParamsSchema`           | `PersonIdParamsDto`           |
| Paramètres de liste   | `ListPeopleQuerySchema`          | `ListPeopleQueryDto`          |
| Réponse unitaire      | `PersonResponseDtoSchema`        | `PersonResponseDto`           |
| Réponse de collection | `PeopleCollectionResponseSchema` | `PeopleCollectionResponseDto` |

Les schémas d'un module sont regroupés dans un fichier dédié, par exemple
`src/modules/people/person.schema.ts`.

### Emplacement dans une route

Le contrat est attaché à la partie HTTP correspondante :

```ts
schema: {
    body: CreatePersonDtoSchema,
    params: PersonIdParamsSchema,
    querystring: ListPeopleQuerySchema,
    response: {
        [HttpStatus.Ok]: PersonResponseDtoSchema,
    },
}
```

Une route ne déclare que les parties qu'elle utilise. Par exemple,
`POST /people` possède un `body`, tandis que `GET /people/:id` possède des
`params`.

## Validation des entrées

Les objets reçus utilisent `additionalProperties: false`. Fastify est configuré
avec `removeAdditional: false` : une propriété inconnue provoque donc une
réponse `400 Bad Request` au lieu d'être supprimée silencieusement.

`Type.Optional` représente une propriété qui peut être absente :

```ts
firstName: Type.Optional(Type.String({ minLength: 1 }));
```

Une propriété obligatoire pouvant explicitement valoir `null` utilise une
union :

```ts
firstName: Type.Union([Type.String(), Type.Null()]);
```

Une propriété optionnelle et une propriété nullable ont des significations
différentes et ne sont pas interchangeables.

Les schémas valident la forme d'une requête : types, formats, propriétés
autorisées et contraintes simples. Les règles comparant plusieurs champs ou
portant une signification métier restent dans les services. PostgreSQL conserve
ses contraintes comme dernière protection de l'intégrité des données.

## Réponses réussies

Une route retournant une ressource unique envoie directement sa représentation,
sans enveloppe `data` :

```json
{
    "id": "8debb53d-f592-4a2f-8a9d-adc91263ef10",
    "firstName": "Alice",
    "middleNames": null,
    "lastName": "Martin",
    "birthName": null,
    "gender": "female",
    "birthDate": null,
    "birthPlace": null,
    "deathDate": null,
    "deathPlace": null,
    "livingStatus": "living",
    "biography": null,
    "createdAt": "2026-07-28T10:30:00.000Z",
    "updatedAt": "2026-07-28T10:30:00.000Z"
}
```

Chaque statut de succès possédant un contenu déclare un schéma de réponse. Les
propriétés internes non déclarées dans ce schéma ne doivent pas être exposées.

Les formats temporels sont :

- `date` au format `YYYY-MM-DD` pour une date civile ;
- `date-time` au format ISO 8601 pour un instant ;
- `null` lorsque l'information est connue comme absente et que le contrat
  l'autorise.

Les réponses JSON réussies utilisent le type de contenu `application/json`.

### Relations parent-enfant

Une relation parent-enfant est créée avec
`POST /parent-child-relationships`. Sa représentation contient les
identifiants des deux personnes, la nature du lien et les dates techniques :

```json
{
    "id": "d0de00b2-d823-4fb7-8b03-8b8ca86c4c29",
    "parentId": "9a802caf-c558-4451-8dc7-008a60d16a1d",
    "childId": "9eebc9d9-5532-4e9f-9a05-ceca73c633ae",
    "relationshipType": "biological",
    "createdAt": "2026-07-29T15:00:00.000Z",
    "updatedAt": "2026-07-29T15:00:00.000Z"
}
```

`GET /parent-child-relationships/:id` consulte une relation précise.
`GET /people/:id/parent-child-relationships` retourne une collection paginée
des relations directes dans lesquelles la personne est parent ou enfant.

Une auto-relation, un doublon ou une relation cyclique produit
`409 Conflict`. Une personne supprimée logiquement ne peut pas recevoir de
nouvelle relation, et ses relations existantes ne sont plus exposées.

### Consultation d'une branche familiale

`GET /people/:id/family-tree` retourne une branche familiale sous la forme du
graphe normalisé défini dans l'[ADR 0008](adr/0008-represent-family-branches-as-graphs.md).

La query accepte :

- `direction`, avec les valeurs `ancestors`, `descendants` ou `both` et
  `ancestors` par défaut ;
- `depth`, un entier compris entre `1` et `10`, avec `3` par défaut.

La personne désignée par `:id` constitue la racine à la profondeur `0`. La
réponse contient les personnes atteintes, les relations parent-enfant qui les
relient et les métadonnées du parcours :

```json
{
    "rootPersonId": "8debb53d-f592-4a2f-8a9d-adc91263ef10",
    "people": [],
    "relationships": [],
    "traversal": {
        "direction": "ancestors",
        "requestedDepth": 3,
        "reachedDepth": 0,
        "truncated": false
    }
}
```

`truncated` vaut `true` lorsqu'au moins une personne existe au-delà de la
profondeur demandée. Une personne racine inexistante ou supprimée produit
`404 Not Found`. Les personnes supprimées ne sont ni retournées ni traversées.

### Suppression des personnes

Les personnes utilisent une suppression logique. `DELETE /people/:id`
retourne `204 No Content` et la personne n'apparaît ensuite plus dans les
consultations ni les modifications publiques. Une personne inexistante ou déjà
supprimée produit `404 Not Found`.

La colonne interne utilisée pour cette suppression n'est jamais exposée dans
les DTO publics. La décision complète est décrite dans
l'[ADR 0007](adr/0007-use-soft-deletion-for-people.md).

### Collections et pagination

Une route retournant une collection utilise une enveloppe composée de `data`
et `pagination` :

```json
{
    "data": [],
    "pagination": {
        "page": 1,
        "limit": 20,
        "totalItems": 0,
        "totalPages": 0
    }
}
```

`data` est toujours un tableau. `page` commence à `1`, tandis qu'une collection
vide possède `totalItems: 0` et `totalPages: 0`. Une limite supérieure à `100`
est plafonnée à `100`, et la réponse expose cette limite effective.

Les liens de navigation sont volontairement absents du contrat initial. Ils
pourront être ajoutés ultérieurement sans modifier les membres existants. La
décision et les alternatives étudiées sont détaillées dans
l'[ADR 0006](adr/0006-use-an-envelope-for-collection-responses.md).

## Réponses d'erreur

Les erreurs suivent la RFC 9457 et utilisent le type de contenu
`application/problem+json`. Cette décision et ses implications sont détaillées
dans l'[ADR 0003](adr/0003-use-rfc-9457-for-api-errors.md).

Une réponse d'erreur peut notamment contenir :

```json
{
    "type": "about:blank",
    "title": "Not Found",
    "status": 404,
    "detail": "The requested person does not exist.",
    "requestId": "req-123"
}
```

Les détails techniques, les requêtes SQL et les traces d'exécution ne sont
jamais exposés au client. Le membre `requestId` permet de retrouver l'occurrence
dans les journaux.

## Séparation entre HTTP et domaine

Les DTO représentent le contrat HTTP. Les types du domaine représentent les
données et les règles manipulées par l'application. Ils peuvent avoir une forme
différente.

Par exemple, un DTO de réponse expose un instant sous forme de chaîne ISO 8601,
alors que le domaine peut le manipuler avec un objet `Date`.

Le flux général est :

```text
DTO d'entrée → service → domaine → DTO de réponse
```

Les services et repositories ne dépendent pas des objets `request`, `reply` ou
des types Fastify.

## Tests du contrat

Les tests d'intégration des routes vérifient au minimum :

- le statut HTTP ;
- la structure du corps ;
- les champs générés par le serveur ;
- le type de contenu des erreurs ;
- le refus des entrées invalides ;
- l'absence de détails internes dans les erreurs ;
- la consultation d'une ressource existante et inexistante.

Les tests des repositories utilisent PostgreSQL afin de vérifier les requêtes,
les conversions et les contraintes de la base.

## Sujets encore ouverts

Les conventions suivantes ne sont pas encore définies et ne doivent pas être
supposées par les nouvelles routes :

- filtres et tri ;
- liens de navigation des collections ;
- versionnement de l'API ;
- en-tête `Location` après une création ;
- représentation des relations et branches familiales.

Ces sujets seront ajoutés à ce document lorsqu'une décision aura été prise.
