# ADR 0008 — Représenter les branches familiales sous forme de graphes

- **Statut :** Accepté
- **Date :** 2026-07-29

## Contexte

La consultation d'une branche familiale doit permettre de parcourir les liens
parent-enfant à partir d'une personne racine. Bien que le résultat soit
généralement présenté visuellement comme un arbre, le modèle métier de
Kinfolio n'est pas un arbre strict.

Une personne peut avoir plusieurs parents et plusieurs types de filiation. Une
même personne peut également être atteinte par plusieurs chemins lorsque deux
branches familiales se rejoignent. Une représentation JSON récursive, dans
laquelle chaque personne contient directement ses parents ou ses enfants,
dupliquerait alors les personnes et potentiellement toute leur ascendance ou
leur descendance.

Le format transporté par l'API ne doit pas imposer la manière dont les clients
disposent visuellement les personnes. Il doit aussi pouvoir prendre en charge
les parcours des ancêtres, des descendants ou des deux directions.

Les relations de couple ne font pas encore partie du modèle. La première
version représente donc une branche de filiation et non l'intégralité des liens
qui pourront à terme composer un arbre familial.

## Décision

L'API représente une branche familiale sous la forme d'un graphe normalisé
composé :

- de l'identifiant de la personne racine ;
- d'une liste de personnes, dans laquelle chaque personne apparaît au plus une
  fois ;
- d'une liste de relations parent-enfant reliant ces personnes ;
- de métadonnées décrivant le parcours effectué et son éventuelle troncature.

La forme initiale de la réponse est la suivante :

```json
{
    "rootPersonId": "8debb53d-f592-4a2f-8a9d-adc91263ef10",
    "people": [
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
            "createdAt": "2026-07-30T10:30:00.000Z",
            "updatedAt": "2026-07-30T10:30:00.000Z"
        }
    ],
    "relationships": [],
    "traversal": {
        "direction": "ancestors",
        "requestedDepth": 3,
        "reachedDepth": 0,
        "truncated": false,
        "truncationReasons": [],
        "returnedPeople": 1
    }
}
```

`people` contient la personne racine ainsi que les personnes actives atteintes
par le parcours. Les représentations publiques existantes des personnes sont
réutilisées afin de conserver un contrat cohérent avec les routes dédiées aux
personnes.

`relationships` contient uniquement les relations dont les deux extrémités
figurent dans `people`. Les représentations publiques existantes des relations
parent-enfant sont réutilisées.

`traversal.direction` indique le sens du parcours :

- `ancestors` parcourt les parents de manière récursive ;
- `descendants` parcourt les enfants de manière récursive ;
- `both` parcourt les deux directions à partir de la personne racine.

La personne racine se trouve à la profondeur `0` et ses voisins directs à la
profondeur `1`. `requestedDepth` indique la profondeur demandée et
`reachedDepth` la profondeur maximale effectivement atteinte.

`truncated` vaut `true` lorsque des limites de sécurité empêchent de retourner
la totalité du parcours demandé. `truncationReasons` précise si la coupure est
causée par la profondeur, la taille du graphe ou les deux. `returnedPeople`
indique le nombre de personnes effectivement retournées. Les valeurs précises
des limites relèvent du contrat de la route et peuvent évoluer indépendamment
du principe de représentation du graphe.

Les personnes supprimées logiquement et les relations qui les impliquent ne
sont pas exposées. L'ordre des personnes et des relations est déterministe afin
de produire des réponses et des tests stables.

Cette réponse est une ressource composée et non une collection paginée
classique. Elle n'utilise donc pas l'enveloppe `data` et `pagination` définie
pour les routes de collection. Une pagination par numéro de page n'est pas
appliquée au graphe, car elle pourrait séparer arbitrairement des personnes de
leurs relations. La profondeur, les limites de taille et l'indicateur de
troncature encadrent la première version du parcours.

Les clients restent responsables de la présentation. Ils peuvent notamment
transformer le graphe en arbre visuel, regrouper les personnes par génération
ou proposer plusieurs vues sans nécessiter un autre format de réponse.

Le fonctionnement du parcours récursif PostgreSQL est détaillé dans la
[note technique associée](../technical/family-tree-traversal.md).

## Conséquences

### Conséquences positives

- Une personne n'est pas dupliquée lorsque plusieurs branches se rejoignent.
- Le format représente naturellement plusieurs parents et types de filiation.
- La même structure prend en charge les ancêtres, les descendants et un
  parcours dans les deux directions.
- Les clients peuvent choisir librement leur disposition visuelle.
- Les relations de couple pourront être ajoutées ultérieurement sans remplacer
  le principe général de représentation.
- Les limites du parcours sont explicites dans la réponse.

### Compromis et risques

- Les clients doivent reconstruire la hiérarchie ou la disposition visuelle à
  partir des personnes et des relations.
- Une structure normalisée est moins immédiatement lisible qu'un petit arbre
  JSON imbriqué.
- Le sens exact d'un affichage avec `direction: both` dépendra des choix de
  présentation du client.
- Une pagination ou une reprise de parcours plus avancée pourra devenir
  nécessaire pour les graphes très volumineux.
- L'ajout futur des relations de couple demandera de préciser leur
  représentation et leur interaction avec les parcours.

## Alternatives envisagées

### Arbre JSON imbriqué

Chaque personne aurait pu contenir directement une liste `parents` ou
`children`. Cette forme est simple pour une branche sans intersection, mais
elle duplique une personne et ses sous-branches lorsqu'elle est atteinte par
plusieurs chemins. Elle lie également le contrat au sens du parcours et devient
difficile à limiter ou à paginer proprement.

### Liste plate de personnes sans relations

Retourner uniquement les personnes atteintes simplifierait la réponse, mais ne
permettrait pas aux clients de reconstruire les liens ni de distinguer les
types de filiation.

### Un endpoint par représentation visuelle

Des routes distinctes auraient pu retourner un arbre ascendant, un arbre
descendant ou une vue familiale étendue. Cette approche multiplierait les
contrats et ferait dépendre l'API de choix d'interface qui peuvent varier selon
les clients.
