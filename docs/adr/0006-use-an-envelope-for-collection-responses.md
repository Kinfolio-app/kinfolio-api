# ADR 0006 — Utiliser une enveloppe pour les réponses de collection

- **Statut :** Accepté
- **Date :** 2026-07-29

## Contexte

Les routes retournant une collection doivent exposer les ressources demandées
ainsi que les informations nécessaires à la pagination. Un tableau JSON seul
permet de représenter les ressources, mais ne fournit aucun emplacement pour
indiquer la page courante, la limite ou le nombre total de résultats.

HTTP ne définit pas de structure JSON standard pour les réponses de collection.
La RFC 8288 standardise les liens entre ressources, notamment au moyen de
l'en-tête HTTP `Link`, mais n'impose pas la forme du corps d'une liste.
JSON:API définit une structure plus complète avec `data`, `meta` et `links`,
mais son adoption impliquerait également de suivre ses autres conventions de
représentation des ressources.

Genealaine n'a pas besoin de l'ensemble de JSON:API à ce stade. Le contrat doit
rester simple tout en pouvant accueillir ultérieurement des liens de
navigation.

## Décision

Les réponses réussies représentant une collection utilisent une enveloppe JSON
composée de `data` et `pagination` :

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

Le membre `data` contient toujours un tableau, y compris lorsque la collection
est vide.

Le membre `pagination` contient :

- `page`, le numéro de la page demandée, à partir de `1` ;
- `limit`, le nombre maximal de ressources par page ;
- `totalItems`, le nombre total de ressources correspondant à la requête avant
  pagination ;
- `totalPages`, le nombre de pages calculé à partir de `totalItems` et `limit`.

Une collection vide possède `totalItems: 0` et `totalPages: 0`.
La limite effective est plafonnée à `100` afin de protéger l'API contre des
réponses excessivement volumineuses. Lorsqu'un client demande une limite
supérieure, `pagination.limit` contient `100`.

Les réponses représentant une ressource unique restent envoyées directement,
sans enveloppe `data`.

Les liens de navigation ne font pas partie du contrat initial. Un membre
`links` pourra être ajouté à l'enveloppe lorsque leur forme, la construction des
URL et l'utilisation éventuelle de la RFC 8288 auront été définies.

Les schémas et types partagés de l'enveloppe sont placés dans
`src/shared/http`. Chaque module compose ensuite son propre schéma de
collection à partir du schéma de ses ressources.

## Conséquences

### Conséquences positives

- Les clients disposent d'une structure identique pour toutes les collections.
- Les métadonnées de pagination ne sont pas mélangées aux ressources.
- Le contrat peut évoluer avec un membre `links` sans modifier la forme de
  `data` ou de `pagination`.
- Les réponses vides conservent la même structure que les réponses contenant
  des ressources.

### Compromis et risques

- Chaque liste demande une requête de comptage afin de calculer `totalItems` et
  `totalPages`.
- L'enveloppe est une convention propre à Genealaine et non un format défini par
  une RFC.
- Les requêtes de comptage pourront devenir coûteuses sur de grandes
  collections ou avec des filtres complexes.
- Une pagination par curseur pourrait devenir préférable si les volumes ou les
  exigences de stabilité augmentent fortement.

## Alternatives envisagées

### Tableau JSON sans enveloppe

Retourner directement un tableau est plus simple, mais ne fournit pas
d'emplacement extensible pour les métadonnées de pagination.

### En-têtes HTTP uniquement

Les informations de navigation pourraient être placées dans des en-têtes,
notamment `Link` conformément à la RFC 8288. Cette solution a été reportée afin
de garder une première version simple et de rendre les informations de
pagination directement accessibles dans le corps JSON.

### JSON:API

JSON:API définit une convention complète pour les collections, les métadonnées
et les liens. Cette solution n'est pas retenue, car Genealaine ne souhaite pas
adopter à ce stade l'ensemble de ses contraintes de représentation.
